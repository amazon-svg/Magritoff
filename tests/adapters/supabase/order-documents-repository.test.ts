/**
 * `SupabaseOrderDocumentsRepository.store()` (E10.19b) — qa-review B1
 * (BLOQUANT, corrige) : preuve que l objet UPLOADE avant un echec
 * d enregistrement en base est SUPPRIME, pour que le REJEU (contrat §8.20
 * §5, decision C2 : "rejouable tant qu elle n a pas reussi") ne butte plus
 * ETERNELLEMENT sur "resource already exists" au chemin de stockage
 * DETERMINISTE (`storagePathFor`).
 *
 * Deuxieme scenario : la GARDE — une invocation qui decouvre qu une ligne
 * `order_documents` existe DEJA pour cette commande (le gagnant d une course
 * reelle, ou plus simplement le cas `order.document_already_generated`) ne
 * doit JAMAIS supprimer l objet au chemin deterministe, qui peut etre celui
 * du gagnant.
 */
import { describe, expect, it } from 'vitest';
import { SupabaseOrderDocumentsRepository } from '@/adapters/supabase/order-documents-repository';
import {
  OrderDocumentAlreadyGeneratedError,
  OrderDocumentGenerationFailedError,
} from '@/modules/order-documents/application/order-documents-repository';
import type { TenantId, UserId } from '@/kernel';

const TENANT = 'tenant-1' as TenantId;
const ACTOR = 'user-1' as UserId;
const ORDER_ID = 'order-1';
const TEMPLATE_ID = 'template-1';
const PATH = `${TENANT}/${ORDER_ID}.pdf`;

type RpcOutcome = Readonly<{ error: { message: string } | null }>;

/** Faux client PostgREST (table `order_documents` + RPC) et Storage, en memoire, avec ETAT PERSISTANT entre deux appels de `store()` — necessaire pour prouver le REJEU. */
function createFakeSupabase(rpcOutcomes: readonly RpcOutcome[]) {
  const bucket = new Map<string, Uint8Array>();
  const rows = new Map<string, Record<string, unknown>>();
  const removedPaths: string[] = [];
  let rpcCallIndex = 0;

  const authenticatedClient = {
    from(table: string) {
      if (table !== 'order_documents') throw new Error(`table inattendue dans ce faux : ${table}`);
      let filterOrderId: string | undefined;
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          if (column === 'order_id') filterOrderId = String(value);
          return builder;
        },
        maybeSingle: async () => ({ data: (filterOrderId ? (rows.get(filterOrderId) ?? null) : null), error: null }),
      };
      return builder;
    },
    rpc: async (name: string, params: Record<string, unknown>) => {
      if (name !== 'api_register_order_document') throw new Error(`RPC inattendue dans ce faux : ${name}`);
      const outcome = rpcOutcomes[rpcCallIndex] ?? { error: null };
      rpcCallIndex += 1;
      if (outcome.error) return { data: null, error: outcome.error };

      const row = {
        order_id: params.p_order_id,
        template_id: params.p_template_id,
        generated_at: params.p_generated_at,
        generated_by: ACTOR,
        generated_by_label: 'commercial@example.test',
        byte_size: params.p_byte_size,
        sha256: params.p_sha256,
        content_type: 'application/pdf',
        page_count: params.p_page_count,
        storage_path: params.p_storage_path,
      };
      rows.set(String(params.p_order_id), row);
      return { data: [row], error: null };
    },
  };

  const privilegedClient = {
    storage: {
      from(_bucket: string) {
        return {
          upload: async (path: string, bytes: Uint8Array) => {
            // MEME comportement que Supabase Storage SANS `upsert` : un
            // depot sur un chemin DEJA occupe echoue explicitement.
            if (bucket.has(path)) return { data: null, error: { message: 'The resource already exists' } };
            bucket.set(path, bytes);
            return { data: { path }, error: null };
          },
          remove: async (paths: string[]) => {
            for (const path of paths) {
              bucket.delete(path);
              removedPaths.push(path);
            }
            return { data: null, error: null };
          },
          createSignedUrl: async (path: string) => ({
            data: { signedUrl: `https://storage.test/${path}` },
            error: null,
          }),
        };
      },
    },
  };

  return { authenticatedClient, privilegedClient, bucket, rows, removedPaths };
}

function storeParams(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    orderId: ORDER_ID,
    templateId: TEMPLATE_ID,
    bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    pageCount: 1,
    generatedAt: '2026-09-10T10:00:00.000Z',
    ...overrides,
  } as any;
}

describe('SupabaseOrderDocumentsRepository.store() — qa-review B1 (BLOQUANT, corrige)', () => {
  it('REJEU apres un ECHEC d enregistrement : objet ABSENT du bucket apres l echec, second appel REUSSIT en 201-equivalent (contrat §8.20 §5, "rejouable tant qu elle n a pas reussi")', async () => {
    // 1er appel : upload REUSSIT, RPC echoue (panne transitoire generique,
    // AUCUN des codes metier connus — le scenario le plus courant : timeout,
    // coupure reseau, 5xx PostgREST).
    const fakes = createFakeSupabase([{ error: { message: 'PGRST: connection reset by peer' } }, { error: null }]);
    const repository = new SupabaseOrderDocumentsRepository(fakes.authenticatedClient as any, fakes.privilegedClient as any);

    await expect(repository.store(TENANT, ACTOR, storeParams())).rejects.toBeInstanceOf(
      OrderDocumentGenerationFailedError,
    );

    // L objet UPLOADE par cette invocation perdante a ete NETTOYE : aucun
    // orphelin ne doit survivre au chemin deterministe.
    expect(fakes.bucket.has(PATH)).toBe(false);
    expect(fakes.removedPaths).toContain(PATH);
    // Aucune ligne n a ete enregistree (la RPC a echoue AVANT l insert).
    expect(fakes.rows.has(ORDER_ID)).toBe(false);

    // 2e appel (REJEU, meme commande, nouveau rendu) : l objet n est plus
    // "deja present" -> l upload REUSSIT, la RPC REUSSIT cette fois.
    const result = await repository.store(TENANT, ACTOR, storeParams());

    expect(result.order_id).toBe(ORDER_ID);
    expect(fakes.bucket.has(PATH)).toBe(true);
    expect(fakes.rows.has(ORDER_ID)).toBe(true);
  });

  it('GARDE — une ligne order_documents existe DEJA (le gagnant d une course reelle) : l objet uploade par CETTE invocation perdante n est JAMAIS supprime, 409 order.document_already_generated', async () => {
    const fakes = createFakeSupabase([
      { error: { message: 'order.document_already_generated: commande deja porteuse de son document' } },
    ]);
    // Simule le GAGNANT : une ligne existe deja pour cette commande, AVANT
    // meme que cette invocation-ci n uploade quoi que ce soit — le bucket,
    // lui, ne porte PAS encore l objet de cette invocation (sinon l upload
    // lui-meme aurait echoue avant d atteindre la RPC).
    fakes.rows.set(ORDER_ID, {
      order_id: ORDER_ID,
      template_id: TEMPLATE_ID,
      generated_at: '2026-09-10T09:00:00.000Z',
      generated_by: 'user-winner',
      generated_by_label: 'gagnant@example.test',
      byte_size: 999,
      sha256: 'f'.repeat(64),
      content_type: 'application/pdf',
      page_count: 1,
      storage_path: PATH,
    });

    const repository = new SupabaseOrderDocumentsRepository(fakes.authenticatedClient as any, fakes.privilegedClient as any);

    await expect(repository.store(TENANT, ACTOR, storeParams())).rejects.toBeInstanceOf(
      OrderDocumentAlreadyGeneratedError,
    );

    // La GARDE a fonctionne : l objet (potentiellement celui du gagnant, au
    // MEME chemin deterministe) n a PAS ete supprime par l invocation
    // perdante.
    expect(fakes.removedPaths).not.toContain(PATH);
    expect(fakes.bucket.has(PATH)).toBe(true);
  });
});
