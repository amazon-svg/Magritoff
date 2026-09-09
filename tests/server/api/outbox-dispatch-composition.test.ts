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
}) {
  const outboxUpdates: Array<{ patch: Record<string, unknown>; id: string }> = [];
  const rpcCalls: Array<{ fn: string; args: unknown }> = [];

  const client = {
    rpcCalls,
    outboxUpdates,
    async rpc(fn: string, args: unknown) {
      rpcCalls.push({ fn, args });
      if (fn === 'api_claim_outbox_events') return { data: options.claimedRows, error: null };
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
