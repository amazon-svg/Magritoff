/**
 * `GET /notification-logs` contre le contrat (story E10.15c).
 *
 * Exerce reellement `createNotificationLogsRoutes()` via
 * `createGescomApiHandler`, avec un `NotificationLogsRepository` en memoire
 * (`InMemoryNotificationLogsRepository`, aucune dependance a Supabase).
 * Chaque reponse est confrontee au contrat via `checkResponseAgainstContract`.
 *
 * Ce que ce fichier NE couvre PAS : la mise en file reelle
 * (`NotificationDispatchConsumer`, tests unitaires dedies,
 * `tests/modules/notifications/notification-dispatch-consumer.test.ts`) et
 * le comportement reel en base (RLS, trigger d immuabilite,
 * `api_enqueue_notification_message`/`api_claim_notification_messages`,
 * `tests/sql/gescom-e10-15c-notification-dispatch.sql`).
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { parseId, type TenantId, type UserId } from '@/kernel';
import { InMemoryIdempotencyStore, type ApiPrincipal, type PrincipalVerifier } from '@/modules/_shared/application';
import { NotificationLogsService } from '@/modules/notifications/application/notification-logs-service';
import type { NotificationLogDto } from '@/modules/notifications/api/contracts';
import { createNotificationLogsRoutes } from '@/server/api/notification-logs-routes';
import { createGescomApiHandler } from '@/server/api';
import { InMemoryNotificationLogsRepository } from './_fakes/notification-logs-repository.fake.ts';
import { checkResponseAgainstContract } from './_harness.ts';

const TENANT = brand<TenantId>('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9012');
const USER = brand<UserId>('a1b2c3d4-e5f6-4708-8910-1a2b3c4d5e6f');

function brand<T extends string>(value: string): T {
  const parsed = parseId(value);
  if (!parsed.ok) throw new Error('identifiant de test invalide');
  return parsed.value as T;
}

const userPrincipal: ApiPrincipal = Object.freeze({ kind: 'user', userId: USER, tenantId: TENANT });

const verifier: PrincipalVerifier = {
  async verify(credential) {
    if (credential.kind === 'bearer') {
      return credential.token === 'jeton-valide' ? userPrincipal : null;
    }
    return null;
  },
};

let repository: InMemoryNotificationLogsRepository;
let handler: (request: Request) => Promise<Response>;
let sequence = 0;

function fakeUuid(): string {
  sequence += 1;
  return `00000000-0000-4000-9400-${String(sequence).padStart(12, '0')}`;
}

beforeEach(() => {
  repository = new InMemoryNotificationLogsRepository();
  const service = new NotificationLogsService({ repository });
  handler = createGescomApiHandler({
    routes: createNotificationLogsRoutes(service),
    principalVerifier: verifier,
    idempotencyStore: new InMemoryIdempotencyStore(),
    requestIdFactory: () => 'req-e10-15c',
  });
});

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return handler(new Request(`https://magrit.test${path}`, init));
}

const asUser = { Authorization: 'Bearer jeton-valide' };

async function expectContract(
  response: Response,
  expectation: Readonly<{ status: number; dataSchema?: string }>,
): Promise<void> {
  const check = await checkResponseAgainstContract(response, expectation);
  expect(check.errors, check.errors.join(' | ')).toEqual([]);
}

function seedLog(overrides: Partial<NotificationLogDto> = {}): NotificationLogDto {
  const now = new Date().toISOString();
  const log: NotificationLogDto = {
    id: fakeUuid(),
    event_id: fakeUuid(),
    event_name: 'order.step_changed',
    template_id: fakeUuid(),
    channel: 'email',
    status: 'pending',
    aggregate_type: 'order',
    aggregate_id: fakeUuid(),
    recipient: 'client@example.test',
    subject: 'Votre commande a avancé',
    body: 'Étape atteinte : En cours de production.',
    attempts: 0,
    occurrence_count: 1,
    provider_message_id: null,
    last_error: null,
    created_at: now,
    sent_at: null,
    ...overrides,
  };
  repository.seedForTest(TENANT, log);
  return log;
}

describe('GET /notification-logs (E10.15c) contre le contrat', () => {
  it('CA9 — liste le journal, du plus recent au plus ancien, forme NotificationLog', async () => {
    seedLog({ created_at: '2026-09-12T08:00:00.000Z' });
    seedLog({ created_at: '2026-09-12T09:00:00.000Z' });

    const response = await call('/api/v1/notification-logs', { headers: asUser });
    await expectContract(response, { status: 200 });
    const { data } = (await response.json()) as { data: NotificationLogDto[] };
    expect(data).toHaveLength(2);
    expect(data[0]?.created_at).toBe('2026-09-12T09:00:00.000Z');
  });

  it('filtre par event_name/channel/status/template_id/aggregate_id', async () => {
    const template = seedLog({ event_name: 'order.step_changed', channel: 'email', status: 'sent' });
    seedLog({ event_name: 'customer.created', channel: 'email', status: 'pending' });

    const byEvent = await call('/api/v1/notification-logs?event_name=order.step_changed', { headers: asUser });
    const { data: byEventData } = (await byEvent.json()) as { data: NotificationLogDto[] };
    expect(byEventData).toHaveLength(1);

    const byStatus = await call('/api/v1/notification-logs?status=sent', { headers: asUser });
    const { data: byStatusData } = (await byStatus.json()) as { data: NotificationLogDto[] };
    expect(byStatusData).toHaveLength(1);
    expect(byStatusData[0]?.id).toBe(template.id);

    const byTemplate = await call(`/api/v1/notification-logs?template_id=${template.template_id}`, { headers: asUser });
    const { data: byTemplateData } = (await byTemplate.json()) as { data: NotificationLogDto[] };
    expect(byTemplateData).toHaveLength(1);

    const byAggregate = await call(`/api/v1/notification-logs?aggregate_id=${template.aggregate_id}`, { headers: asUser });
    const { data: byAggregateData } = (await byAggregate.json()) as { data: NotificationLogDto[] };
    expect(byAggregateData).toHaveLength(1);
  });

  it('400 sur un template_id/aggregate_id qui n est pas un UUID', async () => {
    const response = await call('/api/v1/notification-logs?template_id=pas-un-uuid', { headers: asUser });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('api.validation_failed');
  });

  it('422 sur un status invalide', async () => {
    const response = await call('/api/v1/notification-logs?status=en-cours', { headers: asUser });
    expect(response.status).toBe(422);
  });

  it('pagination par curseur — page[size] borne la page, meta.next_cursor present', async () => {
    seedLog();
    seedLog();

    const paged = await call('/api/v1/notification-logs?page[size]=1', { headers: asUser });
    await expectContract(paged, { status: 200 });
    const body = (await paged.json()) as { data: NotificationLogDto[]; meta: { next_cursor: string | null } };
    expect(body.data).toHaveLength(1);
    expect(body.meta.next_cursor).not.toBeNull();
  });

  it('une entree dropped porte recipient=null et un last_error explicite (visibilite du silence, §8.23)', async () => {
    seedLog({ status: 'dropped', recipient: null, last_error: 'notification.no_recipient: aucun compte boutique.' });

    const response = await call('/api/v1/notification-logs?status=dropped', { headers: asUser });
    await expectContract(response, { status: 200 });
    const { data } = (await response.json()) as { data: NotificationLogDto[] };
    expect(data).toHaveLength(1);
    expect(data[0]?.recipient).toBeNull();
    expect(data[0]?.last_error).toContain('notification.no_recipient');
  });

  it('401 sans jeton', async () => {
    const response = await call('/api/v1/notification-logs');
    expect(response.status).toBe(401);
  });
});
