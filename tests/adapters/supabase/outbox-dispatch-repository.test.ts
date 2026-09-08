import { describe, expect, it } from 'vitest';
import { SupabaseOutboxDispatchRepository } from '@/adapters/supabase/outbox-dispatch-repository';
import { DEFAULT_OUTBOX_DISPATCH_SETTINGS } from '@/modules/_shared/application';

function fakeClient(options: { rpcResult?: { data: unknown; error: { message: string } | null }; updateError?: { message: string } | null }) {
  return {
    rpcCalls: [] as Array<{ fn: string; args: unknown }>,
    updateCalls: [] as Array<{ table: string; patch: Record<string, unknown>; id: string }>,
    async rpc(fn: string, args: unknown) {
      this.rpcCalls.push({ fn, args });
      return options.rpcResult ?? { data: [], error: null };
    },
    from(table: string) {
      return {
        update: (patch: Record<string, unknown>) => ({
          eq: async (_col: string, id: string) => {
            this.updateCalls.push({ table, patch, id });
            return { error: options.updateError ?? null };
          },
        }),
      };
    },
  };
}

describe('SupabaseOutboxDispatchRepository', () => {
  it('claim() transmet p_limit/p_max_attempts/p_max_age (secondes converties en intervalle texte) et mappe les lignes', async () => {
    const client = fakeClient({
      rpcResult: {
        data: [
          {
            id: 'event-1',
            tenant_id: 'tenant-1',
            event_name: 'quote.sent',
            event_version: 1,
            aggregate_type: 'quote',
            aggregate_id: 'quote-1',
            payload: { quote_id: 'quote-1' },
            occurred_at: '2026-09-08T10:00:00.000Z',
            delivery_attempts: 2,
          },
        ],
        error: null,
      },
    });
    const repository = new SupabaseOutboxDispatchRepository(client as any);

    const events = await repository.claim(DEFAULT_OUTBOX_DISPATCH_SETTINGS);

    expect(client.rpcCalls).toEqual([
      { fn: 'api_claim_outbox_events', args: { p_limit: 25, p_max_attempts: 5, p_max_age: '86400 seconds' } },
    ]);
    expect(events).toEqual([
      {
        id: 'event-1',
        tenantId: 'tenant-1',
        name: 'quote.sent',
        version: 1,
        aggregateType: 'quote',
        aggregateId: 'quote-1',
        payload: { quote_id: 'quote-1' },
        occurredAt: '2026-09-08T10:00:00.000Z',
        deliveryAttempts: 2,
      },
    ]);
  });

  it('claim() lève une erreur explicite si la RPC échoue (pas de silence)', async () => {
    const client = fakeClient({ rpcResult: { data: null, error: { message: 'permission denied' } } });
    const repository = new SupabaseOutboxDispatchRepository(client as any);

    await expect(repository.claim(DEFAULT_OUTBOX_DISPATCH_SETTINGS)).rejects.toThrow('permission denied');
  });

  it('markDelivered() écrit published_at et rien d autre', async () => {
    const client = fakeClient({});
    const repository = new SupabaseOutboxDispatchRepository(client as any);

    await repository.markDelivered('event-1');

    expect(client.updateCalls).toEqual([
      { table: 'outbox_events', patch: { published_at: expect.any(String) }, id: 'event-1' },
    ]);
  });

  it('markFailed() écrit last_error et rien d autre, tronqué à 2000 caractères', async () => {
    const client = fakeClient({});
    const repository = new SupabaseOutboxDispatchRepository(client as any);
    const longReason = 'x'.repeat(3000);

    await repository.markFailed('event-1', longReason);

    expect(client.updateCalls).toHaveLength(1);
    expect(client.updateCalls[0]?.patch['last_error']).toHaveLength(2000);
  });

  it('markDelivered() lève une erreur explicite si le UPDATE échoue', async () => {
    const client = fakeClient({ updateError: { message: 'row not found' } });
    const repository = new SupabaseOutboxDispatchRepository(client as any);

    await expect(repository.markDelivered('event-1')).rejects.toThrow('row not found');
  });
});
