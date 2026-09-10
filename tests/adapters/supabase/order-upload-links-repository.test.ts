/**
 * `SupabaseOrderUploadLinksRepository.issueFileUploadUrl` (E10.20b).
 *
 * Correctif securite Arnaud (2026-09-10), dette M3 signalee en qa-review
 * d E10.20b (non bloquante a l epoque, corrigee ici) : `createSignedUploadUrl()`
 * n accepte AUCUN parametre de duree (`@supabase/storage-js@2.104.1`) — le
 * billet reste valide ~2h. AVANT ce correctif, `upsert: true` permettait au
 * porteur du lien public — par construction anonyme, moins de confiance que
 * l atelier — de rejouer un SECOND `PUT` sur LE MEME billet apres un premier
 * depot deja confirme, et d en remplacer le contenu. Un fichier existant ne
 * se remplace pas (decision Arnaud) : il se supprime (`api_delete_order_file`,
 * deja disponible) puis un NOUVEAU billet (donc un NOUVEAU `file_id`, donc un
 * NOUVEAU chemin de stockage) permet d en deposer un autre.
 */
import { describe, expect, it } from 'vitest';
import { SupabaseOrderUploadLinksRepository } from '@/adapters/supabase/order-upload-links-repository';

const TENANT = 'tenant-1';
const ORDER_ID = 'order-1';
const LINK_ID = 'link-1';
const TOKEN = 'a-token';

function fakeClients() {
  const createSignedUploadUrlCalls: Array<{ path: string; options: unknown }> = [];

  // `client` (JWT membre) n est PAS sollicite par `issueFileUploadUrl` — voir
  // l en-tete du fichier de production, `resolveLinkForDeposit` passe par
  // `anonClient`.
  const client = {
    from() {
      throw new Error('client (JWT membre) ne doit pas etre sollicite par issueFileUploadUrl');
    },
  };

  const anonClient = {
    rpc: async (fn: string, params: Record<string, unknown>) => {
      if (fn === 'api_resolve_order_upload_link_principal') {
        expect(params['p_token']).toBe(TOKEN);
        return { data: [{ link_id: LINK_ID, order_id: ORDER_ID, tenant_id: TENANT }], error: null };
      }
      throw new Error(`RPC inattendue dans ce faux: ${fn}`);
    },
  };

  const storageClient = {
    from(table: string) {
      if (table === 'commercial_order_files') {
        return {
          select: () => ({
            eq: () => ({
              is: async () => ({ count: 0, error: null }),
            }),
          }),
        };
      }
      if (table === 'commercial_order_upload_links') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { max_files: 10, deposited_count: 0 }, error: null }),
            }),
          }),
        };
      }
      throw new Error(`table inattendue dans ce faux: ${table}`);
    },
    storage: {
      from(_bucket: string) {
        return {
          createSignedUploadUrl: async (path: string, options: unknown) => {
            createSignedUploadUrlCalls.push({ path, options });
            return { data: { signedUrl: 'https://storage.test/signed', token: 'a.b.c', path }, error: null };
          },
        };
      },
    },
  };

  return { client, anonClient, storageClient, createSignedUploadUrlCalls };
}

describe('SupabaseOrderUploadLinksRepository.issueFileUploadUrl — billet SANS upsert (correctif securite 2026-09-10)', () => {
  it('appelle createSignedUploadUrl avec { upsert: false } : un second PUT sur le MEME billet ne doit plus pouvoir ecraser un fichier deja depose', async () => {
    const { client, anonClient, storageClient, createSignedUploadUrlCalls } = fakeClients();
    const repository = new SupabaseOrderUploadLinksRepository(client as any, anonClient as any, storageClient as any);

    const ticket = await repository.issueFileUploadUrl(TOKEN);

    expect(ticket.file_id).toBeTruthy();
    expect(createSignedUploadUrlCalls).toHaveLength(1);
    // AVANT ce correctif : `{ upsert: true }` — un second PUT sur ce meme
    // billet aurait ete ACCEPTE et aurait ecrase l objet deja depose/confirme.
    expect(createSignedUploadUrlCalls[0]!.options).toEqual({ upsert: false });
    expect(createSignedUploadUrlCalls[0]!.path).toBe(`${TENANT}/${ORDER_ID}/${ticket.file_id}`);
  });
});
