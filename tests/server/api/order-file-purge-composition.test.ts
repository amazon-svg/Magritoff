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
  purgedRows?: readonly Record<string, unknown>[];
  orphanRows?: readonly Record<string, unknown>[];
  blockedRows?: readonly Record<string, unknown>[];
  /** N2 (qa-review round 1) : simule un echec de consignation pour CE tenant. */
  recordPurgedErrorForTenant?: string;
  /** removeObjects best-effort : force une erreur de retrait storage (N1). */
  removeError?: boolean;
  /** E10.22d, etape 0 — nombre de fichiers dont un pointeur perime a ete remis a null. */
  resetStaleCount?: number;
}) {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const removeCalls: Array<{ bucket: string; paths: readonly string[] }> = [];

  return {
    rpcCalls,
    removeCalls,
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
      // E10.22b — reclamation des fichiers a purger.
      if (fn === 'api_claim_order_files_for_purge') {
        return { data: options.purgedRows ?? [], error: null };
      }
      // E10.22b — consignation de order_files.purged (un appel PAR ESPACE).
      if (fn === 'api_record_order_files_purged') {
        if (options.recordPurgedErrorForTenant && args['p_tenant_id'] === options.recordPurgedErrorForTenant) {
          return { data: null, error: { message: 'panne simulee (N2)' } };
        }
        return { data: null, error: null };
      }
      // E10.22c — reclamation des objets orphelins.
      if (fn === 'api_claim_orphan_order_file_objects') {
        return { data: options.orphanRows ?? [], error: null };
      }
      // B1 (qa-review round 1) — comptage des blocages.
      if (fn === 'api_count_blocked_order_file_purges') {
        return { data: options.blockedRows ?? [], error: null };
      }
      // E10.22d, etape 0 — vivacite (remise a zero des rappels perimes).
      if (fn === 'api_reset_stale_order_file_purge_notices') {
        return { data: options.resetStaleCount ?? 0, error: null };
      }
      throw new Error(`rpc inattendu dans ce faux: ${fn}`);
    },
    storage: {
      from(bucket: string) {
        return {
          async remove(paths: readonly string[]) {
            removeCalls.push({ bucket, paths });
            if (options.removeError) return { data: null, error: { message: 'panne storage simulee (N1)' } };
            return { data: paths.map((path) => ({ name: path })), error: null };
          },
        };
      },
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

    expect(report).toEqual({
      staleNoticesReset: 0,
      noticesCreated: 1,
      noticesExpired: 0,
      deliveriesChecked: 0,
      deliveriesConfirmed: 0,
      filesPurged: 0,
      purgeEventsEmitted: 0,
      orphanObjectsRemoved: 0,
      blockedFiles: [],
    });
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
      staleNoticesReset: 0,
      noticesCreated: 0,
      noticesExpired: 0,
      deliveriesChecked: 0,
      deliveriesConfirmed: 0,
      filesPurged: 0,
      purgeEventsEmitted: 0,
      orphanObjectsRemoved: 0,
      blockedFiles: [],
    });
  });

  it('(E10.22b/E10.22c) purge les fichiers echus, retire les objets par lot, et nettoie les orphelins', async () => {
    const client = buildFakeServiceRoleClient({
      claimedByStage: { first: [], second: [] },
      expiredRows: [],
      pendingDeliveries: [],
      purgedRows: [
        { purged_file_id: 'f1', purged_order_id: 'o1', purged_tenant_id: 't1', purged_byte_size: 100 },
        { purged_file_id: 'f2', purged_order_id: 'o1', purged_tenant_id: 't1', purged_byte_size: 200 },
        { purged_file_id: 'f3', purged_order_id: 'o2', purged_tenant_id: 't2', purged_byte_size: 50 },
      ],
      orphanRows: [{ orphan_object_id: 'obj-1', orphan_object_path: 't1/o1/orphan-1' }],
    });

    const app = createOrderFilePurgeSweepApplication({
      serviceRoleClient: client as any,
      resendApiKey: null,
    });

    const report = await app.runOnce();

    expect(report.filesPurged).toBe(3);
    expect(report.purgeEventsEmitted).toBe(2); // un par espace (t1, t2)
    expect(report.orphanObjectsRemoved).toBe(1);

    expect(client.rpcCalls).toEqual(
      expect.arrayContaining([
        { fn: 'api_claim_order_files_for_purge', args: { p_limit: 500 } },
        {
          fn: 'api_record_order_files_purged',
          args: { p_tenant_id: 't1', p_file_count: 2, p_order_count: 1, p_byte_size_freed: 300, p_order_ids: ['o1'] },
        },
        {
          fn: 'api_record_order_files_purged',
          args: { p_tenant_id: 't2', p_file_count: 1, p_order_count: 1, p_byte_size_freed: 50, p_order_ids: ['o2'] },
        },
        { fn: 'api_claim_orphan_order_file_objects', args: { p_older_than: '24 hours', p_limit: 200 } },
      ]),
    );
    // Retrait des objets purges (chemins recalcules, JAMAIS un storage_path
    // transporte) PUIS retrait des orphelins, deux appels distincts.
    expect(client.removeCalls).toEqual([
      { bucket: 'commercial_order_files', paths: ['t1/o1/f1', 't1/o1/f2', 't2/o2/f3'] },
      { bucket: 'commercial_order_files', paths: ['t1/o1/orphan-1'] },
    ]);
  });

  it('(B1, qa-review round 1) rend le compte des blocages par tenant/motif', async () => {
    const client = buildFakeServiceRoleClient({
      claimedByStage: { first: [], second: [] },
      expiredRows: [],
      pendingDeliveries: [],
      blockedRows: [
        { blocked_tenant_id: 't1', blocked_reason: 'rappel_non_confirme', blocked_count: 4000 },
        { blocked_tenant_id: 't1', blocked_reason: 'rappel_en_echec', blocked_count: 2 },
      ],
    });

    const app = createOrderFilePurgeSweepApplication({ serviceRoleClient: client as any, resendApiKey: null });

    const report = await app.runOnce();

    expect(report.blockedFiles).toEqual([
      { tenantId: 't1', reason: 'rappel_non_confirme', count: 4000 },
      { tenantId: 't1', reason: 'rappel_en_echec', count: 2 },
    ]);
    expect(client.rpcCalls.map((call) => call.fn)).toContain('api_count_blocked_order_file_purges');
  });

  it('(N2, qa-review round 1) un echec de consignation order_files.purged POUR UN TENANT n avorte pas le tour', async () => {
    const client = buildFakeServiceRoleClient({
      claimedByStage: { first: [], second: [] },
      expiredRows: [],
      pendingDeliveries: [],
      purgedRows: [
        { purged_file_id: 'f1', purged_order_id: 'o1', purged_tenant_id: 't1', purged_byte_size: 100 },
        { purged_file_id: 'f2', purged_order_id: 'o2', purged_tenant_id: 't2', purged_byte_size: 200 },
      ],
      orphanRows: [{ orphan_object_id: 'obj-1', orphan_object_path: 't3/o3/orphan-1' }],
      recordPurgedErrorForTenant: 't1',
    });

    const app = createOrderFilePurgeSweepApplication({ serviceRoleClient: client as any, resendApiKey: null });

    // Ne doit JAMAIS rejeter : la panne de consignation pour t1 est
    // journalisee, pas remontee -- le tour continue (t2 consigne, etape 5
    // orphelins executee).
    const report = await app.runOnce();

    expect(report.purgeEventsEmitted).toBe(1); // seul t2 a un evenement consigne
    expect(report.orphanObjectsRemoved).toBe(1); // etape 5 A BIEN tourne malgre l echec de t1
    expect(client.rpcCalls.filter((c) => c.fn === 'api_record_order_files_purged')).toHaveLength(2);
  });

  it('(E10.22d) appelle api_reset_stale_order_file_purge_notices et rend son compte dans staleNoticesReset', async () => {
    const client = buildFakeServiceRoleClient({
      claimedByStage: { first: [], second: [] },
      expiredRows: [],
      pendingDeliveries: [],
      resetStaleCount: 3,
    });

    const app = createOrderFilePurgeSweepApplication({ serviceRoleClient: client as any, resendApiKey: null });

    const report = await app.runOnce();

    expect(report.staleNoticesReset).toBe(3);
    expect(client.rpcCalls.map((call) => call.fn)).toContain('api_reset_stale_order_file_purge_notices');
  });

  it('(N1, qa-review round 1) un echec de retrait storage des orphelins ne rend PAS un compte de retraits reussis', async () => {
    const client = buildFakeServiceRoleClient({
      claimedByStage: { first: [], second: [] },
      expiredRows: [],
      pendingDeliveries: [],
      orphanRows: [{ orphan_object_id: 'obj-1', orphan_object_path: 't1/o1/orphan-1' }],
      removeError: true,
    });

    const app = createOrderFilePurgeSweepApplication({ serviceRoleClient: client as any, resendApiKey: null });

    const report = await app.runOnce();

    expect(report.orphanObjectsRemoved).toBe(0);
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
