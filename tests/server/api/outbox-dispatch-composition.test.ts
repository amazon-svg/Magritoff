/**
 * Composition REELLE du drain outbox (E10.10b-3) — meme raisonnement que
 * `magrit-api-composition.test.ts` pour la facade E10 : verifie que
 * `createOutboxDispatchApplication()` cable correctement les adaptateurs
 * (reclamation, resolution des destinataires, envoi Resend, marquage du
 * verdict), PAS que l Edge Function `magrit-outbox-dispatcher` fonctionne en
 * conditions reelles (hors tsconfig, Deno + Docker absents — voir
 * docs/api/CONVENTIONS.md §8.1/§8.13sexies).
 *
 * Le "client Supabase" ci-dessous est un FAUX minimal, suffisant pour
 * exercer les deux chaines PostgREST reellement appelees par les adaptateurs
 * (`.rpc()` pour la reclamation, `.from().select()...`/`.from().update()...`
 * pour la resolution et le marquage) — pas un mock generique.
 */
import { describe, expect, it, vi } from 'vitest';
import { createOutboxDispatchApplication } from '@/server/api/outbox-dispatch-composition';

type FakeQuoteRow = Readonly<{ valid_until: string | null }> | null;
type FakeRecipientRow = Readonly<{
  email: string;
  full_name: string | null;
  status: string;
  shops: Readonly<{ slug: string; name: string | null; tenant_id: string }>;
}>;

function buildFakeServiceRoleClient(options: {
  claimedRows: readonly Record<string, unknown>[];
  quoteRow: FakeQuoteRow;
  recipientRows: readonly FakeRecipientRow[];
  /** E10.10b-4c — `null` = cas NOMINAL (aucun gabarit configure), la piece jointe de `SupabaseQuoteDocumentAttachmentGateway` reste absente. */
  documentRow?: Readonly<{ storage_path: string }> | null;
  /**
   * E10.15d-1 — modeles ACTIFS de `notification_templates` lus par
   * `notificationDispatchConsumer`, DESORMAIS COMPOSE EN PREMIER sur
   * `quote.sent` (§8.23 §3(a)). Vide par defaut (cas NOMINAL des quatre
   * premiers tests, deja ecrits avant ce lot).
   */
  activeTemplateRows?: readonly Record<string, unknown>[];
  tenantRow?: Readonly<{ name: string }> | null;
  customerRow?: Readonly<{ type: string; company_name: string | null; first_name: string | null; last_name: string | null }> | null;
  primaryContactRow?: Readonly<{ first_name: string; last_name: string }> | null;
}) {
  const outboxUpdates: Array<{ patch: Record<string, unknown>; id: string }> = [];
  const rpcCalls: Array<{ fn: string; args: unknown }> = [];

  const client = {
    rpcCalls,
    outboxUpdates,
    async rpc(fn: string, args: unknown) {
      rpcCalls.push({ fn, args });
      if (fn === 'api_claim_outbox_events') return { data: options.claimedRows, error: null };
      if (fn === 'api_enqueue_notification_message') return { data: null, error: null };
      throw new Error(`rpc inattendu dans ce faux: ${fn}`);
    },
    from(table: string) {
      if (table === 'outbox_events') {
        return {
          update(patch: Record<string, unknown>) {
            return {
              eq: async (_column: string, id: string) => {
                outboxUpdates.push({ patch, id });
                return { error: null };
              },
            };
          },
        };
      }
      if (table === 'commercial_quotes') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          maybeSingle: async () => ({ data: options.quoteRow, error: null }),
        };
        return builder;
      }
      if (table === 'shop_customer_accounts') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          in: async () => ({ data: options.recipientRows, error: null }),
        };
        return builder;
      }
      if (table === 'quote_documents') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          maybeSingle: async () => ({ data: options.documentRow ?? null, error: null }),
        };
        return builder;
      }
      if (table === 'notification_templates') {
        // E10.15d-1 — `notificationDispatchConsumer` passe DESORMAIS EN
        // PREMIER dans le composite `quote.sent` (§8.23 §3(a)) : il
        // interroge TOUJOURS les modeles actifs, meme quand ce test n en
        // configure aucun. Liste vide = cas NOMINAL (`findActiveTemplates`),
        // `quoteSentConsumer` (le courriel non configurable) reste seul a
        // produire un effet observable dans ces scenarios. Builder THENABLE
        // (pas de `.maybeSingle()`/`.in()` terminal ici, contrairement aux
        // autres tables de ce faux) : `findActiveTemplates` awaite
        // directement la chaine `.eq()`/`.or()`, comme le vrai client
        // Supabase.
        const result = { data: options.activeTemplateRows ?? [], error: null as { message: string } | null };
        const builder: any = {
          select: () => builder,
          eq: () => builder,
          or: () => builder,
          then: (resolve: (value: typeof result) => void) => resolve(result),
        };
        return builder;
      }
      if (table === 'tenants') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          maybeSingle: async () => ({ data: options.tenantRow ?? null, error: null }),
        };
        return builder;
      }
      if (table === 'customers') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          maybeSingle: async () => ({ data: options.customerRow ?? null, error: null }),
        };
        return builder;
      }
      if (table === 'customer_contacts') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          maybeSingle: async () => ({ data: options.primaryContactRow ?? null, error: null }),
        };
        return builder;
      }
      throw new Error(`table inattendue dans ce faux: ${table}`);
    },
    storage: {
      from(bucket: string) {
        return {
          async download(path: string) {
            if (bucket !== 'quote_documents' || !options.documentRow || path !== options.documentRow.storage_path) {
              return { data: null, error: { message: 'objet absent (faux de test)' } };
            }
            return { data: new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])]), error: null }; // "%PDF"
          },
        };
      },
    },
  };

  return client;
}

describe('createOutboxDispatchApplication — composition réelle', () => {
  it("livre un quote.sent sans consommateur alternatif enregistré : marque delivered", async () => {
    const client = buildFakeServiceRoleClient({
      claimedRows: [
        {
          id: 'event-1',
          tenant_id: 'tenant-1',
          event_name: 'quote.sent',
          event_version: 1,
          aggregate_type: 'quote',
          aggregate_id: 'quote-1',
          payload: { quote_id: 'quote-1', customer_id: 'customer-1', number: 'DEV-2026-00042', is_resend: false },
          occurred_at: '2026-09-08T10:00:00.000Z',
          delivery_attempts: 1,
        },
      ],
      quoteRow: { valid_until: '2026-09-12' },
      recipientRows: [
        {
          email: 'client@example.com',
          full_name: 'Jean Dupont',
          status: 'active',
          shops: { slug: 'atelier-test', name: 'Atelier Test', tenant_id: 'tenant-1' },
        },
      ],
    });

    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));

    const app = createOutboxDispatchApplication({
      serviceRoleClient: client as any,
      resendApiKey: 'secret',
      fromEmail: 'Magrit <devis@magritapp.com>',
      publicAppUrl: 'https://magritapp.com',
      fetchImplementation: fetchMock as unknown as typeof fetch,
    });

    const report = await app.runOnce();

    expect(report).toEqual({ claimed: 1, delivered: 1, failed: 0, errors: [] });
    expect(client.rpcCalls[0]?.fn).toBe('api_claim_outbox_events');
    expect(client.rpcCalls[0]?.args).toMatchObject({ p_limit: 25, p_max_attempts: 5 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const emailPayload = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(emailPayload.to).toEqual(['client@example.com']);
    expect(emailPayload.subject).toBe('Atelier Test vous a transmis un devis');
    expect(client.outboxUpdates).toEqual([{ patch: expect.objectContaining({ published_at: expect.any(String) }), id: 'event-1' }]);
  });

  it("livre un evenement d un event_name sans consommateur (ex. quote.created), sans appeler Resend", async () => {
    const client = buildFakeServiceRoleClient({
      claimedRows: [
        {
          id: 'event-2',
          tenant_id: 'tenant-1',
          event_name: 'quote.created',
          event_version: 1,
          aggregate_type: 'quote',
          aggregate_id: 'quote-2',
          payload: {},
          occurred_at: '2026-09-08T10:00:00.000Z',
          delivery_attempts: 1,
        },
      ],
      quoteRow: null,
      recipientRows: [],
    });
    const fetchMock = vi.fn();

    const app = createOutboxDispatchApplication({
      serviceRoleClient: client as any,
      resendApiKey: 'secret',
      fromEmail: 'Magrit <devis@magritapp.com>',
      publicAppUrl: 'https://magritapp.com',
      fetchImplementation: fetchMock as unknown as typeof fetch,
    });

    const report = await app.runOnce();

    expect(report).toEqual({ claimed: 1, delivered: 1, failed: 0, errors: [] });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.outboxUpdates).toEqual([{ patch: expect.objectContaining({ published_at: expect.any(String) }), id: 'event-2' }]);
  });

  it("échoue explicitement (last_error) quand MAGRIT_PUBLIC_APP_URL est absente, sans appeler Resend", async () => {
    const client = buildFakeServiceRoleClient({
      claimedRows: [
        {
          id: 'event-3',
          tenant_id: 'tenant-1',
          event_name: 'quote.sent',
          event_version: 1,
          aggregate_type: 'quote',
          aggregate_id: 'quote-3',
          payload: { quote_id: 'quote-3', customer_id: 'customer-1', number: 'DEV-2026-00043', is_resend: false },
          occurred_at: '2026-09-08T10:00:00.000Z',
          delivery_attempts: 1,
        },
      ],
      quoteRow: { valid_until: null },
      recipientRows: [],
    });
    const fetchMock = vi.fn();

    const app = createOutboxDispatchApplication({
      serviceRoleClient: client as any,
      resendApiKey: 'secret',
      fromEmail: 'Magrit <devis@magritapp.com>',
      publicAppUrl: null,
      fetchImplementation: fetchMock as unknown as typeof fetch,
    });

    const report = await app.runOnce();

    expect(report.failed).toBe(1);
    expect(report.errors[0]?.reason).toContain('MAGRIT_PUBLIC_APP_URL');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.outboxUpdates).toEqual([{ patch: { last_error: expect.stringContaining('MAGRIT_PUBLIC_APP_URL') }, id: 'event-3' }]);
  });

  it("E10.10b-4c — un devis avec document produit joint le PDF a l e-mail, corps distinct du cas sans document", async () => {
    const client = buildFakeServiceRoleClient({
      claimedRows: [
        {
          id: 'event-4',
          tenant_id: 'tenant-1',
          event_name: 'quote.sent',
          event_version: 1,
          aggregate_type: 'quote',
          aggregate_id: 'quote-4',
          payload: { quote_id: 'quote-4', customer_id: 'customer-1', number: 'DEV-2026-00044', is_resend: false },
          occurred_at: '2026-09-09T10:00:00.000Z',
          delivery_attempts: 1,
        },
      ],
      quoteRow: { valid_until: '2026-09-12' },
      recipientRows: [
        {
          email: 'client@example.com',
          full_name: 'Jean Dupont',
          status: 'active',
          shops: { slug: 'atelier-test', name: 'Atelier Test', tenant_id: 'tenant-1' },
        },
      ],
      documentRow: { storage_path: 'tenant-1/quote-4.pdf' },
    });

    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));

    const app = createOutboxDispatchApplication({
      serviceRoleClient: client as any,
      resendApiKey: 'secret',
      fromEmail: 'Magrit <devis@magritapp.com>',
      publicAppUrl: 'https://magritapp.com',
      fetchImplementation: fetchMock as unknown as typeof fetch,
    });

    const report = await app.runOnce();

    expect(report).toEqual({ claimed: 1, delivered: 1, failed: 0, errors: [] });
    const emailPayload = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(emailPayload.attachments).toEqual([
      { filename: 'DEV-2026-00044.pdf', content: 'JVBERg==', content_type: 'application/pdf' },
    ]);
    expect(emailPayload.subject).toBe('Atelier Test vous a transmis votre devis, en pièce jointe');
  });

  it('E10.15d-1 — un modele actif sur quote.sent met EN FILE (rpc) ET le courriel non configurable part TOUJOURS, dans cet ordre (§8.23 §3(a))', async () => {
    const client = buildFakeServiceRoleClient({
      claimedRows: [
        {
          id: 'event-5',
          tenant_id: 'tenant-1',
          event_name: 'quote.sent',
          event_version: 1,
          aggregate_type: 'quote',
          aggregate_id: 'quote-5',
          payload: { quote_id: 'quote-5', customer_id: 'customer-1', number: 'DEV-2026-00045', is_resend: false },
          occurred_at: '2026-09-12T10:00:00.000Z',
          delivery_attempts: 1,
        },
      ],
      quoteRow: { valid_until: '2026-12-31' },
      recipientRows: [
        {
          email: 'client@example.com',
          full_name: 'Jean Dupont',
          status: 'active',
          shops: { slug: 'atelier-test', name: 'Atelier Test', tenant_id: 'tenant-1' },
        },
      ],
      activeTemplateRows: [
        {
          id: 'template-quote-sent',
          channel: 'email',
          audience: 'customer',
          recipients: null,
          subject: 'Votre devis {{quote.number}}',
          body: 'Valable jusqu’au {{quote.valid_until}}.',
        },
      ],
      tenantRow: { name: 'Atelier Test' },
      customerRow: { type: 'company', company_name: 'Client Exemple SARL', first_name: null, last_name: null },
      primaryContactRow: { first_name: 'Jean', last_name: 'Dupont' },
    });

    // qa-review round 1 (B1) — le test devait verrouiller l ORDRE
    // d invocation entre les deux consommateurs du composite `quote.sent`
    // (`notificationDispatchConsumer` EN PREMIER, `quoteSentConsumer` EN
    // SECOND, §8.23 §3(a)), pas seulement leurs effets finaux respectifs :
    // sans cela le test restait vert meme si `outbox-dispatch-composition.ts`
    // inversait l ordre du tableau du `CompositeOutboxConsumer`. On intercepte
    // le SEUL point d entree reseau/rpc reellement traverse par chacun des
    // deux consommateurs (`client.rpc('api_enqueue_notification_message', ...)`
    // pour le premier, `fetch(...)` pour le second) et on empile un jeton
    // dans un tableau PARTAGE, dans l ordre reel d appel.
    const invocationOrder: string[] = [];
    const originalRpc = client.rpc.bind(client);
    client.rpc = (async (fn: string, args: unknown) => {
      if (fn === 'api_enqueue_notification_message') invocationOrder.push('enqueue');
      return originalRpc(fn, args);
    }) as typeof client.rpc;

    const fetchMock = vi.fn(async () => {
      invocationOrder.push('email');
      return new Response('{}', { status: 200 });
    });

    const app = createOutboxDispatchApplication({
      serviceRoleClient: client as any,
      resendApiKey: 'secret',
      fromEmail: 'Magrit <devis@magritapp.com>',
      publicAppUrl: 'https://magritapp.com',
      fetchImplementation: fetchMock as unknown as typeof fetch,
    });

    const report = await app.runOnce();

    expect(report).toEqual({ claimed: 1, delivered: 1, failed: 0, errors: [] });
    // Le modele configure a bien ete mis en file (jamais un envoi reseau,
    // §8.23 §3(b)) — c est le SEUL effet observable de
    // `notificationDispatchConsumer` sur cet evenement.
    const enqueueCall = client.rpcCalls.find((call) => call.fn === 'api_enqueue_notification_message');
    expect(enqueueCall).toBeDefined();
    expect(enqueueCall?.args).toMatchObject({
      p_event_name: 'quote.sent',
      p_channel: 'email',
      p_status: 'pending',
      p_recipient: 'client@example.com',
      p_subject: 'Votre devis DEV-2026-00045',
      p_body: 'Valable jusqu’au 2026-12-31.',
      p_coalescing_window_minutes: 0,
    });
    // ET le courriel non configurable (E10.10b-3/4c) part TOUJOURS — le
    // modele configure s AJOUTE a lui, il ne le remplace pas (§8.23 §9(c)).
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const emailPayload = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(emailPayload.subject).toBe('Atelier Test vous a transmis un devis');
    expect(client.outboxUpdates).toEqual([{ patch: expect.objectContaining({ published_at: expect.any(String) }), id: 'event-5' }]);
    // ORDRE reellement observe : `enqueue` (notificationDispatchConsumer)
    // AVANT `email` (quoteSentConsumer) — verrou du bloquant qa-review B1.
    expect(invocationOrder).toEqual(['enqueue', 'email']);
  });

  it('rend un rapport vide sans effet de bord quand rien n est réclamé', async () => {
    const client = buildFakeServiceRoleClient({ claimedRows: [], quoteRow: null, recipientRows: [] });

    const app = createOutboxDispatchApplication({
      serviceRoleClient: client as any,
      resendApiKey: null,
      fromEmail: 'Magrit <devis@magritapp.com>',
      publicAppUrl: 'https://magritapp.com',
    });

    await expect(app.runOnce()).resolves.toEqual({ claimed: 0, delivered: 0, failed: 0, errors: [] });
    expect(client.outboxUpdates).toEqual([]);
  });
});

// ── E10.22a — consommateur order_files.purge_scheduled, branche dans le
// registre du drain EXISTANT (§3 du contrat : "le courriel ne passe pas par
// la nouvelle fonction"). Faux DEDIE (rpc de resolution des destinataires +
// de consignation des tentatives), distinct du faux quote.sent ci-dessus.
function buildFakePurgeServiceRoleClient(options: {
  claimedRows: readonly Record<string, unknown>[];
  recipientRows: readonly Readonly<{ recipient_user_id: string | null; recipient_email: string }>[];
}) {
  const outboxUpdates: Array<{ patch: Record<string, unknown>; id: string }> = [];
  const rpcCalls: Array<{ fn: string; args: unknown }> = [];
  const deliveryAttempts: Array<Record<string, unknown>> = [];

  const client = {
    rpcCalls,
    outboxUpdates,
    deliveryAttempts,
    async rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      if (fn === 'api_claim_outbox_events') return { data: options.claimedRows, error: null };
      if (fn === 'api_resolve_order_file_purge_recipients') return { data: options.recipientRows, error: null };
      if (fn === 'api_record_order_file_purge_notice_delivery_attempt') {
        deliveryAttempts.push(args);
        return {
          data: { id: 'delivery-1', accepted_at: args['p_provider_message_id'] ? new Date().toISOString() : null },
          error: null,
        };
      }
      throw new Error(`rpc inattendu dans ce faux: ${fn}`);
    },
    from(table: string) {
      if (table === 'outbox_events') {
        return {
          update(patch: Record<string, unknown>) {
            return {
              eq: async (_column: string, id: string) => {
                outboxUpdates.push({ patch, id });
                return { error: null };
              },
            };
          },
        };
      }
      if (table === 'tenants') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          maybeSingle: async () => ({ data: { slug: 'atelier-test' }, error: null }),
        };
        return builder;
      }
      throw new Error(`table inattendue dans ce faux: ${table}`);
    },
  };

  return client;
}

describe('createOutboxDispatchApplication — E10.22a order_files.purge_scheduled', () => {
  it('resout les destinataires A LA REMISE, envoie un courriel par destinataire, consigne chaque tentative', async () => {
    const client = buildFakePurgeServiceRoleClient({
      claimedRows: [
        {
          id: 'event-purge-1',
          tenant_id: 'tenant-1',
          event_name: 'order_files.purge_scheduled',
          event_version: 1,
          aggregate_type: 'tenant',
          aggregate_id: 'tenant-1',
          payload: {
            notice_id: 'notice-1',
            stage: 'first',
            file_count: 2,
            order_count: 1,
            purge_at: '2026-10-12T00:00:00Z',
            days_before_purge: 20,
            order_ids: ['order-1'],
          },
          occurred_at: '2026-09-10T05:00:00.000Z',
          delivery_attempts: 1,
        },
      ],
      recipientRows: [{ recipient_user_id: 'user-1', recipient_email: 'admin@example.com' }],
    });

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'resend-msg-1' }), { status: 200 }));

    const app = createOutboxDispatchApplication({
      serviceRoleClient: client as any,
      resendApiKey: 'secret',
      fromEmail: 'Magrit <devis@magritapp.com>',
      publicAppUrl: 'https://magritapp.com',
      fetchImplementation: fetchMock as unknown as typeof fetch,
    });

    const report = await app.runOnce();

    expect(report).toEqual({ claimed: 1, delivered: 1, failed: 0, errors: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const emailPayload = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(emailPayload.to).toEqual(['admin@example.com']);
    expect(emailPayload.html).toContain('https://magritapp.com/t/atelier-test/dashboard/commercial-orders/order-1');
    expect(client.deliveryAttempts).toEqual([
      expect.objectContaining({
        p_notice_id: 'notice-1',
        p_recipient_user_id: 'user-1',
        p_recipient_email: 'admin@example.com',
        p_provider_message_id: 'resend-msg-1',
      }),
    ]);
    expect(client.outboxUpdates).toEqual([
      { patch: expect.objectContaining({ published_at: expect.any(String) }), id: 'event-purge-1' },
    ]);
  });

  it('aucun destinataire a la remise -> livre SANS envoyer (cas nominal, le proprietaire a change)', async () => {
    const client = buildFakePurgeServiceRoleClient({
      claimedRows: [
        {
          id: 'event-purge-2',
          tenant_id: 'tenant-1',
          event_name: 'order_files.purge_scheduled',
          event_version: 1,
          aggregate_type: 'tenant',
          aggregate_id: 'tenant-1',
          payload: {
            notice_id: 'notice-2',
            stage: 'second',
            file_count: 1,
            order_count: 1,
            purge_at: '2026-10-12T00:00:00Z',
            days_before_purge: 15,
            order_ids: ['order-1'],
          },
          occurred_at: '2026-09-10T05:00:00.000Z',
          delivery_attempts: 1,
        },
      ],
      recipientRows: [],
    });
    const fetchMock = vi.fn();

    const app = createOutboxDispatchApplication({
      serviceRoleClient: client as any,
      resendApiKey: 'secret',
      fromEmail: 'Magrit <devis@magritapp.com>',
      publicAppUrl: 'https://magritapp.com',
      fetchImplementation: fetchMock as unknown as typeof fetch,
    });

    const report = await app.runOnce();

    expect(report).toEqual({ claimed: 1, delivered: 1, failed: 0, errors: [] });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.deliveryAttempts).toEqual([]);
  });
});
