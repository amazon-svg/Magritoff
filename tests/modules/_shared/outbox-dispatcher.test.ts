import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_OUTBOX_DISPATCH_SETTINGS,
  OutboxDispatcher,
  type ClaimedOutboxEvent,
  type OutboxConsumerRegistry,
  type OutboxDispatchRepository,
} from '@/modules/_shared/application';
import type { TenantId } from '@/kernel';

const TENANT = 'tenant-1' as TenantId;

function event(overrides: Partial<ClaimedOutboxEvent> = {}): ClaimedOutboxEvent {
  return Object.freeze({
    id: 'event-1',
    tenantId: TENANT,
    name: 'quote.sent',
    version: 1,
    aggregateType: 'quote',
    aggregateId: 'quote-1',
    payload: {},
    occurredAt: '2026-09-08T10:00:00.000Z',
    deliveryAttempts: 1,
    ...overrides,
  });
}

function fakeRepository(events: readonly ClaimedOutboxEvent[]): OutboxDispatchRepository & {
  delivered: string[];
  failed: Array<{ id: string; reason: string }>;
} {
  return {
    delivered: [],
    failed: [],
    async claim() {
      return events;
    },
    async markDelivered(id: string) {
      this.delivered.push(id);
    },
    async markFailed(id: string, reason: string) {
      this.failed.push({ id, reason });
    },
  };
}

describe('OutboxDispatcher', () => {
  it('livre un evenement sans consommateur enregistre, ce n est PAS un echec', async () => {
    const repository = fakeRepository([event({ name: 'quote.created' })]);
    const dispatcher = new OutboxDispatcher({ repository, consumers: {} });

    const report = await dispatcher.runOnce();

    expect(report).toEqual({ claimed: 1, delivered: 1, failed: 0, errors: [] });
    expect(repository.delivered).toEqual(['event-1']);
    expect(repository.failed).toEqual([]);
  });

  it('remet un evenement au consommateur enregistre pour son event_name', async () => {
    const consume = vi.fn(async () => ({ delivered: true as const }));
    const repository = fakeRepository([event()]);
    const consumers: OutboxConsumerRegistry = { 'quote.sent': { consume } };
    const dispatcher = new OutboxDispatcher({ repository, consumers });

    const report = await dispatcher.runOnce();

    expect(consume).toHaveBeenCalledTimes(1);
    expect(consume).toHaveBeenCalledWith(event());
    expect(report.delivered).toBe(1);
    expect(repository.delivered).toEqual(['event-1']);
  });

  it('marque en echec (last_error) un consommateur qui rend delivered:false, sans toucher a published_at', async () => {
    const consume = vi.fn(async () => ({ delivered: false as const, reason: 'Resend indisponible' }));
    const repository = fakeRepository([event()]);
    const consumers: OutboxConsumerRegistry = { 'quote.sent': { consume } };
    const dispatcher = new OutboxDispatcher({ repository, consumers });

    const report = await dispatcher.runOnce();

    expect(report).toEqual({
      claimed: 1,
      delivered: 0,
      failed: 1,
      errors: [{ eventId: 'event-1', eventName: 'quote.sent', reason: 'Resend indisponible' }],
    });
    expect(repository.delivered).toEqual([]);
    expect(repository.failed).toEqual([{ id: 'event-1', reason: 'Resend indisponible' }]);
  });

  it('traite un consommateur qui leve comme un echec (defense en profondeur)', async () => {
    const consume = vi.fn(async () => {
      throw new Error('boom');
    });
    const repository = fakeRepository([event()]);
    const consumers: OutboxConsumerRegistry = { 'quote.sent': { consume } };
    const onUnhandledError = vi.fn();
    const dispatcher = new OutboxDispatcher({ repository, consumers, onUnhandledError });

    const report = await dispatcher.runOnce();

    expect(report.failed).toBe(1);
    expect(repository.failed).toEqual([{ id: 'event-1', reason: 'boom' }]);
    expect(onUnhandledError).toHaveBeenCalledTimes(1);
  });

  it('traite un lot de plusieurs evenements independamment', async () => {
    const consume = vi
      .fn()
      .mockResolvedValueOnce({ delivered: true })
      .mockResolvedValueOnce({ delivered: false, reason: 'echec' });
    const repository = fakeRepository([
      event({ id: 'a' }),
      event({ id: 'b' }),
      event({ id: 'c', name: 'quote.created' }),
    ]);
    const consumers: OutboxConsumerRegistry = { 'quote.sent': { consume } };
    const dispatcher = new OutboxDispatcher({ repository, consumers });

    const report = await dispatcher.runOnce();

    expect(report.claimed).toBe(3);
    expect(report.delivered).toBe(2); // 'a' (consommateur) + 'c' (sans consommateur)
    expect(report.failed).toBe(1); // 'b'
    expect(repository.delivered.sort()).toEqual(['a', 'c']);
    expect(repository.failed).toEqual([{ id: 'b', reason: 'echec' }]);
  });

  it('rend un rapport vide sans appeler le repository de marquage si aucun evenement n est reclame', async () => {
    const repository = fakeRepository([]);
    const dispatcher = new OutboxDispatcher({ repository, consumers: {} });

    const report = await dispatcher.runOnce();

    expect(report).toEqual({ claimed: 0, delivered: 0, failed: 0, errors: [] });
  });

  it('transmet les reglages par defaut (25 / 5 / 24h) au repository si aucun reglage n est fourni', async () => {
    const claim = vi.fn(async () => []);
    const repository: OutboxDispatchRepository = {
      claim,
      async markDelivered() {},
      async markFailed() {},
    };
    const dispatcher = new OutboxDispatcher({ repository, consumers: {} });

    await dispatcher.runOnce();

    expect(claim).toHaveBeenCalledWith(DEFAULT_OUTBOX_DISPATCH_SETTINGS);
    expect(DEFAULT_OUTBOX_DISPATCH_SETTINGS).toEqual({ limit: 25, maxAttempts: 5, maxAgeSeconds: 86_400 });
  });
});
