/**
 * Confrontation du CODE au contrat (story E10.0, CA12).
 *
 * Les schemas Zod du socle et le contrat OpenAPI decrivent la meme chose. Ce
 * test verifie qu ils ne disent pas deux choses differentes : chaque valeur
 * produite par le code est validee contre le JSON Schema du contrat. Si l un
 * des deux derive, la CI bloque.
 */
import { describe, expect, it } from 'vitest';
import { parseId, type TenantId } from '@/kernel';
import {
  auditSchema,
  eventEnvelopeSchema,
  eventSignatureSchema,
  metaSchema,
  moneySchema,
  problemSchema,
  rateSchema,
  timestampSchema,
  uuidSchema,
} from '@/modules/_shared/api';
import {
  computeEntityTag,
  encodeCursor,
  OutboxPublisher,
  problem,
  resourceConflict,
  signEventBody,
  toEventEnvelope,
  validationFailed,
  type OutboxEvent,
  type OutboxRepository,
} from '@/modules/_shared/application';
import { buildEnvelope } from '@/server/api';
import { checkAgainstSchema } from './_harness.ts';

const TENANT = tenantId('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9012');
const AGGREGATE = 'b1c2d3e4-5f60-4a7b-8c9d-0e1f2a3b4c5d';
const EVENT_ID = 'c3d4e5f6-0718-4293-8a4b-5c6d7e8f9a0b';

function tenantId(value: string): TenantId {
  const parsed = parseId<'TenantId'>(value);
  if (!parsed.ok) throw new Error('tenant de test invalide');
  return parsed.value;
}

function expectValid(schema: string, value: unknown): void {
  const check = checkAgainstSchema(schema, value);
  expect(check.errors, check.errors.join(' | ')).toEqual([]);
  expect(check.valid).toBe(true);
}

function expectInvalid(schema: string, value: unknown): void {
  expect(checkAgainstSchema(schema, value).valid).toBe(false);
}

describe('composants partages : code contre contrat', () => {
  it('Money — montant en chaine decimale, jamais un flottant JSON', () => {
    for (const valid of ['1234.50', '0.00', '-89.90']) {
      expect(moneySchema.safeParse(valid).success).toBe(true);
      expectValid('Money', valid);
    }
    for (const invalid of [1234.5, '1234.5', '1234', '1234.500', 'abc']) {
      expect(moneySchema.safeParse(invalid).success).toBe(false);
      expectInvalid('Money', invalid);
    }
  });

  it('Rate — taux en chaine a quatre decimales, "0.5000" vaut 50 %', () => {
    for (const valid of ['0.5000', '0.2000', '-0.1000']) {
      expect(rateSchema.safeParse(valid).success).toBe(true);
      expectValid('Rate', valid);
    }
    for (const invalid of [0.5, '0.5', '0.50000', '123.4567']) {
      expect(rateSchema.safeParse(invalid).success).toBe(false);
      expectInvalid('Rate', invalid);
    }
  });

  it('Timestamp — ISO 8601 UTC, et Uuid — UUID v4', () => {
    const instant = '2026-09-01T08:30:00.000Z';
    expect(timestampSchema.safeParse(instant).success).toBe(true);
    expectValid('Timestamp', instant);
    expect(timestampSchema.safeParse('2026-09-01T08:30:00+02:00').success).toBe(false);

    expect(uuidSchema.safeParse(AGGREGATE).success).toBe(true);
    expectValid('Uuid', AGGREGATE);
    expectInvalid('Uuid', 'DEV-2026-00042');
    expect(uuidSchema.safeParse('DEV-2026-00042').success).toBe(false);
  });

  it('Audit — tracabilite complete, acteur systeme admis en null', () => {
    const audit = auditSchema.parse({
      created_at: '2026-09-01T08:30:00.000Z',
      created_by: AGGREGATE,
      updated_at: '2026-09-01T09:00:00.000Z',
      updated_by: null,
    });
    expectValid('Audit', audit);
  });

  it('Meta — request_id obligatoire, next_cursor porte la page suivante', () => {
    const cursor = encodeCursor({ sort: '2026-09-01T08:30:00.000Z', id: AGGREGATE });
    const meta = metaSchema.parse({
      request_id: 'req-e10-0',
      next_cursor: cursor,
      page_size: 50,
    });
    expectValid('Meta', meta);
    expectValid('Meta', { request_id: 'req-e10-0', next_cursor: null });
    expectInvalid('Meta', { next_cursor: null });
  });

  it('SuccessEnvelope — toute reponse de succes rendue par la facade', () => {
    const envelope = buildEnvelope(
      { status: 200, data: { id: AGGREGATE }, meta: { page_size: 25 } },
      'req-e10-0',
    );
    expectValid('SuccessEnvelope', envelope);
    expect(envelope.meta.next_cursor).toBeNull();
    expectInvalid('SuccessEnvelope', { data: { id: AGGREGATE } });
  });

  it('Problem — RFC 7807 avec code metier stable et request_id', () => {
    const rendered = problem({
      status: 422,
      title: 'Requete invalide',
      code: 'price_rule.value_out_of_range',
      detail: 'La remise depasse 100 %.',
    }).toProblem('req-e10-0');

    expect(problemSchema.safeParse(rendered).success).toBe(true);
    expectValid('Problem', rendered);
    expect(rendered.type).toBe('about:blank');
    expectInvalid('Problem', { ...rendered, code: 'PriceRuleValueOutOfRange' });
    expectInvalid('Problem', { ...rendered, request_id: undefined });
  });

  it('Problem — un 409 de conflit porte l etat courant pour rejouer sans relire', () => {
    const current = { id: AGGREGATE, name: 'Grands comptes', version: 4 };
    const rendered = resourceConflict(current).toProblem('req-e10-0');
    expectValid('Problem', rendered);
    expect(rendered.status).toBe(409);
    expect(rendered.code).toBe('api.resource_conflict');
    expect(rendered.current_state).toEqual(current);
  });

  it('Problem — les erreurs de validation sont rendues champ par champ', () => {
    const rendered = validationFailed([{ field: 'value', message: 'Nombre attendu.' }]).toProblem(
      'req-e10-0',
    );
    expectValid('Problem', rendered);
    expect(rendered.errors).toEqual([{ field: 'value', message: 'Nombre attendu.' }]);
  });

  it('EventEnvelope — le publisher produit une enveloppe conforme et versionnee', async () => {
    const appended: OutboxEvent[] = [];
    const repository: OutboxRepository = {
      async append(events) {
        appended.push(...events);
      },
    };
    const publisher = new OutboxPublisher({
      repository,
      now: () => new Date('2026-09-01T08:30:00.000Z'),
      newEventId: () => EVENT_ID,
    });

    const [event] = await publisher.publish({
      name: 'quote.converted',
      tenantId: TENANT,
      aggregateType: 'quote',
      aggregateId: AGGREGATE,
      payload: { quote_number: 'DEV-2026-00042', total_ht: '1234.50' },
    });
    expect(event).toBeDefined();
    expect(appended).toHaveLength(1);

    const envelope = toEventEnvelope(event as OutboxEvent);
    expect(eventEnvelopeSchema.safeParse(envelope).success).toBe(true);
    expectValid('EventEnvelope', envelope);
    expect(envelope.event_version).toBe(1);
    expect(envelope.tenant_id).toBe(TENANT);
    expectInvalid('EventEnvelope', { ...envelope, event_name: 'quote.transformed' });
  });

  it('la signature de livraison respecte le format sha256=<hmac>', async () => {
    const signature = await signEventBody('secret-de-test', '{"event_id":"x"}');
    expect(eventSignatureSchema.safeParse(signature).success).toBe(true);
    expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('l ETag est stable au tri des cles et change avec le contenu', async () => {
    const first = await computeEntityTag({ b: 2, a: 1 });
    const second = await computeEntityTag({ a: 1, b: 2 });
    const third = await computeEntityTag({ a: 1, b: 3 });
    expect(first).toBe(second);
    expect(third).not.toBe(first);
    expect(first).toMatch(/^"[0-9a-f]{32}"$/);
  });
});
