/**
 * Composition REELLE du balayage quotidien de purge (E10.22a/E10.22a-bis) --
 * meme raisonnement que `outbox-dispatch-composition.test.ts` : verifie que
 * `createOrderFilePurgeSweepApplication()` cable correctement les
 * adaptateurs (reclamation des DEUX paliers, expiration, relecture de
 * statut), PAS que l Edge Function `magrit-order-file-purge` fonctionne en
 * conditions reelles (hors tsconfig, Deno + Docker absents).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  createOrderFilePurgeNoticeConsumer,
  createOrderFilePurgeSweepApplication,
} from '@/server/api/order-file-purge-composition';

function buildFakeServiceRoleClient(options: {
  claimedByStage: Readonly<Record<string, readonly Record<string, unknown>[]>>;
  expiredRows: readonly Record<string, unknown>[];
  pendingDeliveries: readonly Record<string, unknown>[];
}) {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];

  return {
    rpcCalls,
    async rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      if (fn === 'api_claim_order_file_purge_notices') {
        return { data: options.claimedByStage[String(args['p_stage'])] ?? [], error: null };
      }
      if (fn === 'api_expire_order_file_purge_notices') {
        return { data: options.expiredRows, error: null };
      }
      if (fn === 'api_claim_order_file_purge_notice_deliveries_for_check') {
        return { data: options.pendingDeliveries, error: null };
      }
      if (fn === 'api_record_order_file_purge_notice_delivery_check') {
        return { data: null, error: null };
      }
      throw new Error(`rpc inattendu dans ce faux: ${fn}`);
    },
  };
}

describe('createOrderFilePurgeSweepApplication — composition réelle', () => {
  it('reclame les DEUX paliers avec les reglages exacts (first=20j, second=15j), N ENVOIE AUCUN COURRIEL', async () => {
    const client = buildFakeServiceRoleClient({
      claimedByStage: {
        first: [{ claimed_notice_id: 'n1', claimed_tenant_id: 't1', claimed_file_count: 2, claimed_order_count: 1 }],
        second: [],
      },
      expiredRows: [],
      pendingDeliveries: [],
    });
    const fetchMock = vi.fn();

    const app = createOrderFilePurgeSweepApplication({
      serviceRoleClient: client as any,
      resendApiKey: 'secret',
      fetchImplementation: fetchMock as unknown as typeof fetch,
    });

    const report = await app.runOnce();

    expect(report).toEqual({ noticesCreated: 1, noticesExpired: 0, deliveriesChecked: 0, deliveriesConfirmed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.rpcCalls).toEqual(
      expect.arrayContaining([
        { fn: 'api_claim_order_file_purge_notices', args: { p_stage: 'first', p_lead_days: 20 } },
        { fn: 'api_claim_order_file_purge_notices', args: { p_stage: 'second', p_lead_days: 15 } },
      ]),
    );
  });

  it('relit le statut des livraisons ACCEPTEES pas encore CONFIRMEES et consigne "delivered"', async () => {
    const client = buildFakeServiceRoleClient({
      claimedByStage: { first: [], second: [] },
      expiredRows: [],
      pendingDeliveries: [{ delivery_id: 'd1', notice_id: 'n1', provider_message_id: 'msg-1' }],
    });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ last_event: 'delivered' }), { status: 200 }));

    const app = createOrderFilePurgeSweepApplication({
      serviceRoleClient: client as any,
      resendApiKey: 'secret',
      fetchImplementation: fetchMock as unknown as typeof fetch,
    });

    const report = await app.runOnce();

    expect(report.deliveriesChecked).toBe(1);
    expect(report.deliveriesConfirmed).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails/msg-1', expect.anything());
    expect(client.rpcCalls).toEqual(
      expect.arrayContaining([
        { fn: 'api_record_order_file_purge_notice_delivery_check', args: { p_delivery_id: 'd1', p_last_status: 'delivered' } },
      ]),
    );
  });

  it('rend un rapport vide sans effet de bord quand rien n est du', async () => {
    const client = buildFakeServiceRoleClient({
      claimedByStage: { first: [], second: [] },
      expiredRows: [],
      pendingDeliveries: [],
    });

    const app = createOrderFilePurgeSweepApplication({
      serviceRoleClient: client as any,
      resendApiKey: null,
    });

    await expect(app.runOnce()).resolves.toEqual({
      noticesCreated: 0,
      noticesExpired: 0,
      deliveriesChecked: 0,
      deliveriesConfirmed: 0,
    });
  });
});

describe('createOrderFilePurgeNoticeConsumer — composition réelle', () => {
  it('produit un consommateur qui resout le slug du tenant, les destinataires, puis appelle Resend avec les liens de commande', async () => {
    const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const fromCalls: string[] = [];
    const client = {
      async rpc(fn: string, args: Record<string, unknown>) {
        rpcCalls.push({ fn, args });
        if (fn === 'api_resolve_order_file_purge_recipients') {
          return { data: [{ recipient_user_id: 'user-1', recipient_email: 'admin@example.com' }], error: null };
        }
        if (fn === 'api_record_order_file_purge_notice_delivery_attempt') {
          return { data: { id: 'delivery-1', accepted_at: new Date().toISOString() }, error: null };
        }
        throw new Error(`rpc inattendu: ${fn}`);
      },
      from(table: string) {
        fromCalls.push(table);
        if (table === 'tenants') {
          const builder = {
            select: () => builder,
            eq: () => builder,
            maybeSingle: async () => ({ data: { slug: 'atelier-test' }, error: null }),
          };
          return builder;
        }
        throw new Error(`table inattendue: ${table}`);
      },
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'resend-msg-1' }), { status: 200 }));

    const consumer = createOrderFilePurgeNoticeConsumer({
      serviceRoleClient: client as any,
      resendApiKey: 'secret',
      fromEmail: 'Magrit <devis@magritapp.com>',
      publicAppUrl: 'https://magritapp.com',
      fetchImplementation: fetchMock as unknown as typeof fetch,
    });

    const result = await consumer.consume({
      id: 'event-1',
      tenantId: 'tenant-1' as any,
      name: 'order_files.purge_scheduled' as any,
      version: 1,
      aggregateType: 'tenant',
      aggregateId: 'tenant-1',
      occurredAt: '2026-09-10T05:00:00.000Z',
      deliveryAttempts: 1,
      payload: {
        notice_id: 'notice-1',
        stage: 'first',
        file_count: 1,
        order_count: 1,
        purge_at: '2026-10-12T00:00:00Z',
        days_before_purge: 20,
        order_ids: ['order-1'],
      },
    });

    expect(result).toEqual({ delivered: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fromCalls).toEqual(['tenants']);
    expect(rpcCalls.map((call) => call.fn)).toEqual([
      'api_resolve_order_file_purge_recipients',
      'api_record_order_file_purge_notice_delivery_attempt',
    ]);
    const emailPayload = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(emailPayload.html).toContain('https://magritapp.com/t/atelier-test/dashboard/commercial-orders/order-1');
  });
});
