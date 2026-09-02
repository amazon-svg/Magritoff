/**
 * Tests unitaires de `PriceRulesService` (E10.6, CA1/CA2/CA4) : CRUD basique
 * et contraintes de coherence scope/cibles, en dehors de toute couche HTTP.
 * Complementaire de `tests/contract/price-rules.contract.test.ts`, qui
 * exerce le meme service via la facade complete (Zod + Problem RFC 7807).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { parseId, type TenantId, type UserId } from '@/kernel';
import { OutboxPublisher, type OutboxEvent, type OutboxRepository } from '@/modules/_shared/application';
import { PriceRulesService } from '@/modules/pricing/application/price-rules-service';
import {
  PriceRuleCommandRejectedError,
  PriceRuleNotFoundError,
  ProductRangeNotFoundError,
} from '@/modules/pricing/application/price-rules-repository';
import { InMemoryCustomersRepository } from '../../contract/_fakes/customers-repository.fake.ts';
import { InMemoryPriceRulesRepository } from '../../contract/_fakes/price-rules-repository.fake.ts';

const TENANT = brand<TenantId>('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9012');
const USER = brand<UserId>('a1b2c3d4-e5f6-4708-8910-1a2b3c4d5e6f');
const RANGE_ID = '11111111-1111-4111-8111-111111111100';

function brand<T extends string>(value: string): T {
  const parsed = parseId(value);
  if (!parsed.ok) throw new Error('identifiant de test invalide');
  return parsed.value as T;
}

class InMemoryOutboxRepository implements OutboxRepository {
  readonly events: OutboxEvent[] = [];
  async append(events: readonly OutboxEvent[]): Promise<void> {
    this.events.push(...events);
  }
}

let repository: InMemoryPriceRulesRepository;
let customers: InMemoryCustomersRepository;
let outboxRepository: InMemoryOutboxRepository;
let service: PriceRulesService;
let customerId: string;

beforeEach(async () => {
  repository = new InMemoryPriceRulesRepository();
  repository.knownProductRanges.add(RANGE_ID);
  customers = new InMemoryCustomersRepository();
  outboxRepository = new InMemoryOutboxRepository();
  service = new PriceRulesService({
    repository,
    customers,
    outbox: new OutboxPublisher({
      repository: outboxRepository,
      now: () => new Date('2026-09-02T10:00:00.000Z'),
      newEventId: () => '00000000-0000-4000-9200-000000000001',
    }),
  });
  const created = await customers.create(TENANT, USER, {
    type: 'individual',
    civility: 'mr',
    first_name: 'Jean',
    last_name: 'Dupont',
  });
  customerId = created.id;
});

const baseCommand = {
  name: 'Marge standard',
  value_type: 'margin_rate' as const,
  value: '0.5000',
  starts_on: '2026-09-01',
  is_active: true,
};

describe('PriceRulesService — creation (CA1, CA2)', () => {
  it('cree une regle globale et publie price_rule.changed(created)', async () => {
    const created = await service.create(TENANT, USER, { ...baseCommand, scope: 'global' });
    expect(created.scope).toBe('global');
    expect(created.customer_id).toBeNull();
    expect(created.product_range_id).toBeNull();
    expect(outboxRepository.events).toHaveLength(1);
    expect(outboxRepository.events[0]?.payload).toEqual({ rule_id: created.id, action: 'created' });
  });

  it('rejette scope=customer sans customer_id (price_rule.invalid_scope)', async () => {
    await expect(
      service.create(TENANT, USER, { ...baseCommand, scope: 'customer', customer_id: null, product_range_id: null }),
    ).rejects.toMatchObject({ code: 'price_rule.invalid_scope' });
  });

  it('rejette scope=range sans product_range_id (price_rule.invalid_scope)', async () => {
    await expect(
      service.create(TENANT, USER, { ...baseCommand, scope: 'range', customer_id: null, product_range_id: null }),
    ).rejects.toMatchObject({ code: 'price_rule.invalid_scope' });
  });

  it('rejette une cible fournie HORS de sa portee (global + customer_id)', async () => {
    await expect(
      service.create(TENANT, USER, { ...baseCommand, scope: 'global', customer_id: customerId, product_range_id: null }),
    ).rejects.toMatchObject({ code: 'price_rule.invalid_scope' });
  });

  it('rejette un customer_id inconnu du tenant (price_rule.customer_unknown)', async () => {
    await expect(
      service.create(TENANT, USER, {
        ...baseCommand,
        scope: 'customer',
        customer_id: '00000000-0000-4000-9000-999999999999',
        product_range_id: null,
      }),
    ).rejects.toMatchObject({ code: 'price_rule.customer_unknown' });
  });

  it('rejette un product_range_id inconnu du catalogue (price_rule.product_range_unknown)', async () => {
    await expect(
      service.create(TENANT, USER, {
        ...baseCommand,
        scope: 'range',
        customer_id: null,
        product_range_id: '00000000-0000-4000-9000-888888888888',
      }),
    ).rejects.toMatchObject({ code: 'price_rule.product_range_unknown' });
  });

  it('accepte scope=customer_range avec les deux cibles connues', async () => {
    const created = await service.create(TENANT, USER, {
      ...baseCommand,
      scope: 'customer_range',
      customer_id: customerId,
      product_range_id: RANGE_ID,
    });
    expect(created.customer_id).toBe(customerId);
    expect(created.product_range_id).toBe(RANGE_ID);
  });

  it('rejette ends_on strictement anterieure a starts_on (price_rule.invalid_period)', async () => {
    await expect(
      service.create(TENANT, USER, {
        ...baseCommand,
        scope: 'global',
        starts_on: '2026-09-10',
        ends_on: '2026-09-01',
      }),
    ).rejects.toMatchObject({ code: 'price_rule.invalid_period' });
  });

  it('accepte ends_on egale a starts_on - regle d un seul jour, borne inclusive', async () => {
    const created = await service.create(TENANT, USER, {
      ...baseCommand,
      scope: 'global',
      starts_on: '2026-09-01',
      ends_on: '2026-09-01',
    });
    expect(created.ends_on).toBe('2026-09-01');
  });

  it('accepte ends_on posterieure a starts_on', async () => {
    const created = await service.create(TENANT, USER, {
      ...baseCommand,
      scope: 'global',
      starts_on: '2026-09-01',
      ends_on: '2026-09-02',
    });
    expect(created.ends_on).toBe('2026-09-02');
  });
});

describe('PriceRulesService — modification (CA1)', () => {
  it('modifie le nom et la valeur, publie updated', async () => {
    const created = await service.create(TENANT, USER, { ...baseCommand, scope: 'global' });
    outboxRepository.events.length = 0;

    const updated = await service.update(TENANT, created.id, { name: 'Renommee', value: '0.6000' });
    expect(updated.name).toBe('Renommee');
    expect(updated.value).toBe('0.6000');
    expect(outboxRepository.events[0]?.payload).toMatchObject({ action: 'updated' });
  });

  it('un PATCH ne portant QUE is_active publie activated/deactivated', async () => {
    const created = await service.create(TENANT, USER, { ...baseCommand, scope: 'global' });
    outboxRepository.events.length = 0;

    await service.update(TENANT, created.id, { is_active: false });
    expect(outboxRepository.events[0]?.payload).toMatchObject({ action: 'deactivated' });

    outboxRepository.events.length = 0;
    await service.update(TENANT, created.id, { is_active: true });
    expect(outboxRepository.events[0]?.payload).toMatchObject({ action: 'activated' });
  });

  it('un PATCH qui porte is_active ET un autre champ publie updated, pas activated', async () => {
    const created = await service.create(TENANT, USER, { ...baseCommand, scope: 'global' });
    outboxRepository.events.length = 0;

    await service.update(TENANT, created.id, { is_active: false, name: 'Autre nom' });
    expect(outboxRepository.events[0]?.payload).toMatchObject({ action: 'updated' });
  });

  it('rejette une periode resultante invalide en fusionnant avec les valeurs courantes', async () => {
    const created = await service.create(TENANT, USER, {
      ...baseCommand,
      scope: 'global',
      starts_on: '2026-09-05',
    });
    // ends_on seul, anterieur au starts_on COURANT (non fourni dans ce PATCH).
    await expect(service.update(TENANT, created.id, { ends_on: '2026-09-01' })).rejects.toMatchObject({
      code: 'price_rule.invalid_period',
    });
  });

  it('leve PriceRuleNotFoundError sur un identifiant inconnu du tenant', async () => {
    await expect(service.update(TENANT, '00000000-0000-4000-9000-000000000042', { name: 'X' })).rejects.toBeInstanceOf(
      PriceRuleNotFoundError,
    );
    await expect(service.getById(TENANT, '00000000-0000-4000-9000-000000000042')).rejects.toBeInstanceOf(
      PriceRuleNotFoundError,
    );
  });
});

describe('PriceRulesService — marge publique standard (CA4)', () => {
  it('rend margin_rate: null tant que non definie, sans publier price_rule.changed', async () => {
    const margin = await service.getDefaultMargin(TENANT, RANGE_ID);
    expect(margin).toEqual({
      tenant_id: TENANT,
      product_range_id: RANGE_ID,
      margin_rate: null,
      updated_at: null,
      updated_by: null,
    });
    expect(outboxRepository.events).toEqual([]);
  });

  it('pose puis relit la marge, sans jamais publier price_rule.changed (CA — pas une regle de prix)', async () => {
    const set = await service.setDefaultMargin(TENANT, RANGE_ID, USER, '0.4000');
    expect(set.margin_rate).toBe('0.4000');
    expect(outboxRepository.events).toEqual([]);

    const reread = await service.getDefaultMargin(TENANT, RANGE_ID);
    expect(reread.margin_rate).toBe('0.4000');
  });

  it('leve ProductRangeNotFoundError sur une gamme inconnue, en lecture comme en ecriture', async () => {
    const unknown = '00000000-0000-4000-9000-777777777777';
    await expect(service.getDefaultMargin(TENANT, unknown)).rejects.toBeInstanceOf(ProductRangeNotFoundError);
    await expect(service.setDefaultMargin(TENANT, unknown, USER, '0.1000')).rejects.toBeInstanceOf(
      ProductRangeNotFoundError,
    );
  });
});

describe('PriceRulesService — liste (CA5)', () => {
  it('liste uniquement les regles du tenant demande', async () => {
    await service.create(TENANT, USER, { ...baseCommand, scope: 'global' });
    const otherTenant = brand<TenantId>('11111111-1111-4111-8111-111111111111');
    await service.create(otherTenant, USER, { ...baseCommand, scope: 'global', name: 'Autre tenant' });

    const result = await service.list(TENANT, {
      q: null,
      status: null,
      sort: { field: 'created_at', direction: 'desc' },
      size: 50,
      cursor: null,
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.tenant_id).toBe(TENANT);
  });
});

// Garde-fou : toute erreur de coherence est bien une PriceRuleCommandRejectedError
// (pas une Error generique), condition necessaire pour que la route la
// traduise en 422 plutot qu en 500.
describe('PriceRulesService — nature des erreurs', () => {
  it('toute erreur de coherence est une PriceRuleCommandRejectedError', async () => {
    await expect(
      service.create(TENANT, USER, { ...baseCommand, scope: 'customer', customer_id: null, product_range_id: null }),
    ).rejects.toBeInstanceOf(PriceRuleCommandRejectedError);
  });
});

/**
 * `resolve()` (E10.7) : le service ne fait que valider le contexte avant de
 * deleguer l algorithme au repository (`InMemoryPriceRulesRepository.resolve()`,
 * qui reimplemente specificite + recence a l identique de la fonction SQL —
 * voir tests/contract/price-rules.contract.test.ts pour l algorithme
 * complet bout en bout via la facade HTTP). Ces tests-ci couvrent la couche
 * de VALIDATION propre au service, absente du fake lui-meme.
 */
describe('PriceRulesService — resolve (E10.7)', () => {
  it('rend rule: null et reason: null quand aucune regle ne couvre le contexte', async () => {
    const result = await service.resolve(TENANT, { customerId: null, productRangeId: null, at: '2026-09-01' });
    expect(result).toEqual({ rule: null, reason: null });
  });

  it('un customer_id inconnu du tenant est refuse en price_rule.customer_unknown, AVANT toute resolution', async () => {
    const otherTenant = brand<TenantId>('11111111-1111-4111-8111-111111111111');
    const foreignCustomer = await customers.create(otherTenant, USER, {
      type: 'individual',
      civility: 'mr',
      first_name: 'Autre',
      last_name: 'Tenant',
    });
    await expect(
      service.resolve(TENANT, { customerId: foreignCustomer.id, productRangeId: null, at: '2026-09-01' }),
    ).rejects.toMatchObject({ code: 'price_rule.customer_unknown' });
  });

  it('un product_range_id inconnu du catalogue est refuse en price_rule.product_range_unknown', async () => {
    await expect(
      service.resolve(TENANT, { customerId: null, productRangeId: 'unknown-range', at: '2026-09-01' }),
    ).rejects.toMatchObject({ code: 'price_rule.product_range_unknown' });
  });

  it('delegue au repository et rend la regle retenue avec son motif', async () => {
    const created = await service.create(TENANT, USER, { ...baseCommand, scope: 'global' });
    const result = await service.resolve(TENANT, { customerId: null, productRangeId: null, at: '2026-09-01' });
    expect(result.rule?.id).toBe(created.id);
    expect(result.reason).toBe('specificity');
  });

  it('n emet aucun evenement outbox (operation de lecture pure)', async () => {
    await service.create(TENANT, USER, { ...baseCommand, scope: 'global' });
    outboxRepository.events.length = 0;
    await service.resolve(TENANT, { customerId: null, productRangeId: null, at: '2026-09-01' });
    expect(outboxRepository.events).toHaveLength(0);
  });
});
