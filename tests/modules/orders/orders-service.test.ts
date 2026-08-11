import { describe, expect, it, vi } from 'vitest';
import { parseId, type UserId } from '../../../src/kernel';
import {
  OrdersService,
  type OrdersRepository,
} from '../../../src/modules/orders';

describe('OrdersService', () => {
  it('agrège les cohortes tenant et legacy sans exposer leurs rows', async () => {
    const repository = repositoryStub();
    const service = new OrdersService(repository);

    const result = await service.listTenantOrders('tenant-1', ['shop-1']);

    expect(result.orders.map((order) => order.id)).toEqual(['v11-1', 'legacy-1']);
    expect(result.orders[0]).toMatchObject({
      source: 'v1_1', shopId: 'shop-1', totalHt: 100, totalTtc: 108.5,
      items: [{ name: 'Affiche', quantity: 2, unitPriceHt: 50 }],
    });
    expect(repository.listLegacyOrders).toHaveBeenCalledWith(['shop-1']);
  });

  it('compose les quatre vues portail et réserve le legacy à mine', async () => {
    const service = new OrdersService(repositoryStub());

    const result = await service.listPortalOrders('shop-1', id('user-1'));

    expect(result.counters).toEqual({ mine: 2, to_validate: 1, to_approve: 0, to_produce: 0 });
    expect(result.datasets.mine.map((order) => order.id)).toEqual(['v11-1', 'legacy-1']);
    expect(result.datasets.to_validate.map((order) => order.id)).toEqual(['v11-1']);
    expect(result.datasets.to_approve).toEqual([]);
  });

  it('normalise le trail d audit au format HTTP camelCase', async () => {
    const service = new OrdersService(repositoryStub());
    await expect(service.getAuditTrail('v11-1')).resolves.toEqual({
      events: [{
        eventId: 'event-1', orderId: 'v11-1', kind: 'status', eventType: 'status_transition',
        actorId: 'user-1', actorEmail: 'buyer@magrit.test', roleName: null,
        payload: { from_status: 'draft', to_status: 'validated' }, occurredAt: '2026-08-11T12:01:00.000Z',
      }],
    });
  });

  it('ne notifie une transition qu au premier traitement idempotent', async () => {
    const repository = repositoryStub();
    const service = new OrdersService(repository);
    const command = { toStatus: 'validated' as const, reason: null, idempotencyKey: 'transition-af5-1' };

    await expect(service.transition('v11-1', command, id('user-1'), 'https://magrit.test'))
      .resolves.toMatchObject({ fromStatus: 'draft', toStatus: 'validated', replayed: false });
    expect(repository.notifyTransition).toHaveBeenCalledOnce();
  });

  it('délègue la création atomique et notifie hors transaction', async () => {
    const repository = repositoryStub();
    const service = new OrdersService(repository);
    const command = {
      shopId: '11111111-1111-4111-8111-111111111111',
      currency: 'EUR', notes: '', idempotencyKey: 'create-af5-2a',
      items: [{
        productId: null, productLabel: 'Flyers', clariprintOptions: null,
        quantity: 2, unitPriceHt: 75,
      }],
    };

    await expect(service.create(command, 'https://magrit.test')).resolves.toMatchObject({
      totalHt: 150, replayed: false,
    });
    expect(repository.notifyOrderCreated).toHaveBeenCalledOnce();
  });

  it('délègue lecture et édition atomique du brouillon', async () => {
    const repository = repositoryStub();
    const service = new OrdersService(repository);

    await expect(service.getDraft('22222222-2222-4222-8222-222222222222'))
      .resolves.toMatchObject({ status: 'draft', items: [{ productLabel: 'Flyers' }] });
    await expect(service.updateDraft('22222222-2222-4222-8222-222222222222', {
      items: [{
        id: '44444444-4444-4444-8444-444444444444',
        productLabel: 'Flyers premium', quantity: 3, unitPriceHt: 60,
      }],
      idempotencyKey: 'update-af5-2b',
    })).resolves.toMatchObject({ totalHt: 180, replayed: false });
  });
});

function repositoryStub(): OrdersRepository & Record<'listLegacyOrders', ReturnType<typeof vi.fn>> {
  const v11 = {
    id: 'v11-1', shopId: 'shop-1', createdAt: '2026-08-11T12:00:00.000Z',
    items: [{ name: 'Affiche', quantity: 2, unitPriceHt: 50 }], totalHt: 100, status: 'draft',
  };
  return {
    getTenantTaxRegime: vi.fn(async () => 'dom_tom' as const),
    getShopTaxRegime: vi.fn(async () => 'dom_tom' as const),
    listTenantOrders: vi.fn(async () => [v11]),
    listTenantOrdersByIds: vi.fn(async (ids) => ids.includes(v11.id) ? [v11] : []),
    listLegacyOrders: vi.fn(async () => [{
      id: 'legacy-1', shopId: 'shop-1', createdAt: '2026-08-11T11:00:00.000Z',
      customerName: 'Client', customerEmail: 'buyer@magrit.test', items: [],
      totalHt: 20, totalTtc: 24, status: 'pending',
    }]),
    getPortalCounters: vi.fn(async () => ({ mine: 2, to_validate: 1, to_approve: 0, to_produce: 0 })),
    getPortalOrderIds: vi.fn(async (_shopId, _userId, tab) => tab === 'mine' || tab === 'to_validate' ? ['v11-1'] : []),
    getAuthenticatedUserEmail: vi.fn(async () => 'buyer@magrit.test'),
    listAuditEvents: vi.fn(async () => [{
      eventId: 'event-1', orderId: 'v11-1', kind: 'status', eventType: 'status_transition',
      actorId: 'user-1', actorEmail: 'buyer@magrit.test', roleName: null,
      payload: { from_status: 'draft', to_status: 'validated' }, occurredAt: '2026-08-11T12:01:00.000Z',
    }]),
    transitionOrder: vi.fn(async (orderId, command) => ({
      orderId, fromStatus: 'draft', toStatus: command.toStatus, replayed: false,
    })),
    notifyTransition: vi.fn(async () => undefined),
    createOrder: vi.fn(async (command) => ({
      orderId: '22222222-2222-4222-8222-222222222222',
      tenantId: '33333333-3333-4333-8333-333333333333',
      shopId: command.shopId,
      totalHt: command.items.reduce((sum, item) => sum + item.quantity * item.unitPriceHt, 0),
      currency: command.currency,
      replayed: false,
    })),
    notifyOrderCreated: vi.fn(async () => undefined),
    getDraftOrder: vi.fn(async (orderId) => ({
      orderId, status: 'draft', totalHt: 150,
      items: [{
        id: '44444444-4444-4444-8444-444444444444', productId: null,
        productLabel: 'Flyers', clariprintOptions: null, quantity: 2,
        unitPriceHt: 75, lineTotalHt: 150,
      }],
    })),
    updateDraftOrder: vi.fn(async (orderId, command) => ({
      orderId,
      totalHt: command.items.reduce((sum, item) => sum + item.quantity * item.unitPriceHt, 0),
      replayed: false,
    })),
  };
}

function id(value: string): UserId {
  const parsed = parseId<'UserId'>(value);
  if (!parsed.ok) throw new Error('ID invalide');
  return parsed.value;
}
