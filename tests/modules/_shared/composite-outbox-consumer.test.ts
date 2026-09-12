import { describe, expect, it, vi } from 'vitest';
import { CompositeOutboxConsumer, type ClaimedOutboxEvent, type OutboxEventConsumer } from '@/modules/_shared/application';
import type { TenantId } from '@/kernel';

const TENANT = 'tenant-1' as TenantId;

function event(): ClaimedOutboxEvent {
  return Object.freeze({
    id: 'event-1',
    tenantId: TENANT,
    name: 'order.step_changed',
    version: 1,
    aggregateType: 'order',
    aggregateId: 'order-1',
    payload: {},
    occurredAt: '2026-09-12T10:00:00.000Z',
    deliveryAttempts: 1,
  });
}

function consumer(result: Awaited<ReturnType<OutboxEventConsumer['consume']>>): OutboxEventConsumer & { consume: ReturnType<typeof vi.fn> } {
  return { consume: vi.fn(async () => result) };
}

describe('CompositeOutboxConsumer', () => {
  it('leve si construit sans aucun consommateur', () => {
    expect(() => new CompositeOutboxConsumer([])).toThrow();
  });

  it('rend delivered:true si TOUS les consommateurs delivrent', async () => {
    const first = consumer({ delivered: true });
    const second = consumer({ delivered: true });
    const composite = new CompositeOutboxConsumer([first, second]);

    const result = await composite.consume(event());

    expect(result).toEqual({ delivered: true });
    expect(first.consume).toHaveBeenCalledTimes(1);
    expect(second.consume).toHaveBeenCalledTimes(1);
  });

  it('EXECUTE DANS L ORDRE, et s arrete au PREMIER echec — le suivant n est jamais invoque', async () => {
    const first = consumer({ delivered: false, reason: 'echec du premier' });
    const second = consumer({ delivered: true });
    const composite = new CompositeOutboxConsumer([first, second]);

    const result = await composite.consume(event());

    expect(result).toEqual({ delivered: false, reason: 'echec du premier' });
    expect(first.consume).toHaveBeenCalledTimes(1);
    expect(second.consume).not.toHaveBeenCalled();
  });

  it('un echec du SECOND consommateur ne masque pas que le premier a deja reussi (le composite rend quand meme l echec)', async () => {
    const first = consumer({ delivered: true });
    const second = consumer({ delivered: false, reason: 'echec du second' });
    const composite = new CompositeOutboxConsumer([first, second]);

    const result = await composite.consume(event());

    expect(result).toEqual({ delivered: false, reason: 'echec du second' });
    expect(first.consume).toHaveBeenCalledTimes(1);
    expect(second.consume).toHaveBeenCalledTimes(1);
  });
});
