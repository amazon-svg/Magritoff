/**
 * `SupabaseOrderFilesRepository` (E10.17a) — le chemin de stockage est
 * TOUJOURS RECALCULE `<tenant_id>/<order_id>/<file_id>`, JAMAIS lu depuis une
 * valeur fournie par l appelant. C est exactement la lecon de la faille B1
 * trouvee en qa-review sur E10.10b-4a (un parametre de chemin, meme sur une
 * fonction `security definer`, reste une DONNEE que l appelant choisit) :
 * ce test la reproduit ICI, AVANT qu elle soit reapprise une seconde fois.
 *
 * `ConfirmOrderFileUploadCommand` ne porte structurellement AUCUN champ de
 * chemin (ni `path`, ni `storage_path`) — le schema Zod `.strict()` rejette
 * deja toute propriete supplementaire au niveau HTTP (voir
 * `order-files.contract.test.ts`). Ce fichier verifie la COUCHE SUIVANTE,
 * INDEPENDANTE du schema : meme si un objet malveillant construit hors
 * TypeScript (`as any`) portait un chemin forge, l adaptateur ne le lit
 * jamais — il RECALCULE le chemin depuis `tenantId`/`orderId`/`command.file_id`
 * uniquement, et c est CE chemin recalcule qui est passe a `info()` (lecture
 * de metadonnee) et implicitement a la fonction RPC (qui le recalcule
 * elle-meme cote SQL, sans jamais recevoir de parametre `p_storage_path` —
 * verifie separement par `tests/sql/gescom-e10-17a-order-files.sql`, scenario
 * qa-review B1).
 */
import { describe, expect, it } from 'vitest';
import { SupabaseOrderFilesRepository } from '@/adapters/supabase/order-files-repository';
import type { TenantId } from '@/kernel';
import type { ConfirmOrderFileUploadCommand } from '@/modules/order-files/api/contracts';
import { OrderFileUploadMissingError } from '@/modules/order-files/application/order-files-repository';

const TENANT = 'tenant-1' as TenantId;
const ORDER_ID = 'order-1';
const FILE_ID = 'file-1';

/** Faux client PostgREST + Storage, capture le chemin passe a chaque appel. */
function fakeClients(options: {
  infoResult?: { data: { size: number; contentType: string } | null; error: { message: string } | null };
  rpcResult?: { data: unknown; error: { message: string } | null };
  /** Ligne renvoyee par `commercial_order_files` (qa-review N3 : `findById`/`findRawById`). */
  fileRow?: Record<string, unknown> | null;
  createSignedUrlResult?: { data: { signedUrl: string } | null; error: { message: string } | null };
}) {
  const infoResult = options.infoResult ?? {
    data: { size: 1000, contentType: 'application/pdf' },
    error: null,
  };
  const rpcResult = options.rpcResult ?? {
    data: {
      id: FILE_ID,
      order_id: ORDER_ID,
      order_line_id: null,
      filename: 'bat.pdf',
      content_type: 'application/pdf',
      byte_size: 1000,
      visibility: 'internal',
      deposited_by: 'user-1',
      deposited_by_label: 'Test',
      deposited_at: '2026-09-09T10:00:00.000Z',
      updated_at: '2026-09-09T10:00:00.000Z',
    },
    error: null,
  };
  const fileRow = 'fileRow' in options ? options.fileRow! : null;
  const createSignedUrlResult = options.createSignedUrlResult ?? {
    data: { signedUrl: 'https://storage.test/signed' },
    error: null,
  };

  const infoCalls: string[] = [];
  const removeCalls: string[][] = [];
  const rpcCalls: Array<{ fn: string; params: Record<string, unknown> }> = [];
  const createSignedUrlCalls: Array<{ path: string; expiresIn: number; options: unknown }> = [];

  const client = {
    from(table: string) {
      if (table === 'commercial_orders') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: ORDER_ID }, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'commercial_order_files') {
        // Chaine EXACTE d `findById`/`findRawById` :
        // .select(FILE_COLUMNS).eq('order_id', ...).eq('id', ...).is('deleted_at', null).maybeSingle()
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: () => ({
                  maybeSingle: async () => ({ data: fileRow, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`table inattendue dans ce faux: ${table}`);
    },
    rpc: async (fn: string, params: Record<string, unknown>) => {
      rpcCalls.push({ fn, params });
      return rpcResult;
    },
  };

  const storageClient = {
    storage: {
      from(_bucket: string) {
        return {
          info: async (path: string) => {
            infoCalls.push(path);
            return infoResult;
          },
          remove: async (paths: string[]) => {
            removeCalls.push(paths);
            return { data: null, error: null };
          },
          createSignedUrl: async (path: string, expiresIn: number, opts: unknown) => {
            createSignedUrlCalls.push({ path, expiresIn, options: opts });
            return createSignedUrlResult;
          },
        };
      },
    },
  };

  return { client, storageClient, infoCalls, removeCalls, rpcCalls, createSignedUrlCalls };
}

describe('SupabaseOrderFilesRepository.confirmUpload — chemin RECALCULE, jamais recu de l appelant (qa-review B1, E10.10b-4a)', () => {
  it('lit info() au chemin CANONIQUE `<tenant>/<order>/<file_id>`, quel que soit ce que la commande porterait par ailleurs', async () => {
    const { client, storageClient, infoCalls, rpcCalls } = fakeClients({});
    const repository = new SupabaseOrderFilesRepository(client as any, storageClient as any);

    // `as any` : simule un appelant qui aurait force un champ de chemin
    // absent du type `ConfirmOrderFileUploadCommand` (le schema Zod `.strict()`
    // le rejetterait deja en HTTP — ce test verifie la couche EN DESSOUS).
    const maliciousCommand = {
      file_id: FILE_ID,
      filename: 'bat.pdf',
      path: 'un-autre-tenant/une-autre-commande/un-autre-fichier',
      storage_path: 'un-autre-tenant/une-autre-commande/un-autre-fichier',
    } as unknown as ConfirmOrderFileUploadCommand;

    await repository.confirmUpload(TENANT, ORDER_ID, 'user-1' as any, maliciousCommand);

    expect(infoCalls).toEqual([`${TENANT}/${ORDER_ID}/${FILE_ID}`]);

    // La fonction RPC ne recoit JAMAIS de parametre de chemin : elle le
    // recalcule elle-meme cote SQL (verifie par la migration et par
    // tests/sql/gescom-e10-17a-order-files.sql, scenario qa-review B1).
    const call = rpcCalls[0]!;
    expect(call.fn).toBe('api_confirm_order_file_upload');
    expect(call.params).not.toHaveProperty('p_storage_path');
    expect(call.params).not.toHaveProperty('path');
    expect(call.params['p_tenant_id']).toBe(TENANT);
    expect(call.params['p_order_id']).toBe(ORDER_ID);
    expect(call.params['p_file_id']).toBe(FILE_ID);
  });

  it('leve OrderFileUploadMissingError si aucun objet n est present au chemin RECALCULE (jamais un chemin fourni par l appelant)', async () => {
    const { client, storageClient } = fakeClients({
      infoResult: { data: null, error: { message: 'Object not found' } },
    });
    const repository = new SupabaseOrderFilesRepository(client as any, storageClient as any);

    await expect(
      repository.confirmUpload(TENANT, ORDER_ID, 'user-1' as any, {
        file_id: FILE_ID,
        filename: 'bat.pdf',
      }),
    ).rejects.toBeInstanceOf(OrderFileUploadMissingError);
  });

  it('retire l objet AVANT de rejeter un type/poids hors bornes (defense en profondeur, meme au chemin recalcule)', async () => {
    const { client, storageClient, removeCalls } = fakeClients({
      infoResult: { data: { size: 10, contentType: 'application/octet-stream' }, error: null },
    });
    const repository = new SupabaseOrderFilesRepository(client as any, storageClient as any);

    await expect(
      repository.confirmUpload(TENANT, ORDER_ID, 'user-1' as any, {
        file_id: FILE_ID,
        filename: 'bat.pdf',
      }),
    ).rejects.toThrow();

    expect(removeCalls).toEqual([[`${TENANT}/${ORDER_ID}/${FILE_ID}`]]);
  });

  // qa-review N3 : `confirmUpload()` n etait pas le SEUL endroit du fichier ou
  // le chemin est recalcule — `toDetailDto()` (signature) et `remove()`
  // (retrait de l objet) le font aussi, et ce sont EXACTEMENT les deux
  // endroits ou la faille B1 originale (E10.10b-4a) est reapparue lors d un
  // refactor. Sans test dedie, un futur refactor pourrait y reintroduire
  // `row.storage_path`/`data.storage_path` sans qu aucun gate ne le releve.
  it('findById (toDetailDto) : signe createSignedUrl au chemin RECALCULE, JAMAIS row.storage_path meme si la ligne en porte un', async () => {
    const { client, storageClient, createSignedUrlCalls } = fakeClients({
      fileRow: {
        id: FILE_ID,
        order_id: ORDER_ID,
        order_line_id: null,
        filename: 'bat.pdf',
        content_type: 'application/pdf',
        byte_size: 1000,
        visibility: 'internal',
        deposited_by: 'user-1',
        deposited_by_label: 'Test',
        deposited_at: '2026-09-09T10:00:00.000Z',
        updated_at: '2026-09-09T10:00:00.000Z',
        // Propriete PARASITE : `FILE_COLUMNS` ne la selectionne plus
        // (qa-review N4), mais si un futur refactor la reintroduisait dans la
        // selection, le CODE ne doit JAMAIS la lire pour signer l URL.
        storage_path: 'tenant-vole/commande-volee/fichier-vole',
      },
    });
    const repository = new SupabaseOrderFilesRepository(client as any, storageClient as any);

    const detail = await repository.findById(TENANT, ORDER_ID, FILE_ID);

    expect(detail).not.toBeNull();
    expect(createSignedUrlCalls).toHaveLength(1);
    expect(createSignedUrlCalls[0]!.path).toBe(`${TENANT}/${ORDER_ID}/${FILE_ID}`);
  });

  it('remove() : retire l objet de stockage au chemin RECALCULE, JAMAIS celui rendu par la fonction RPC', async () => {
    const { client, storageClient, removeCalls } = fakeClients({
      rpcResult: {
        data: {
          id: FILE_ID,
          order_id: ORDER_ID,
          order_line_id: null,
          filename: 'bat.pdf',
          content_type: 'application/pdf',
          byte_size: 1000,
          visibility: 'internal',
          deposited_by: 'user-1',
          deposited_by_label: 'Test',
          deposited_at: '2026-09-09T10:00:00.000Z',
          updated_at: '2026-09-09T10:00:00.000Z',
          deleted_at: '2026-09-09T10:05:00.000Z',
          // `api_delete_order_file` REND `storage_path` (contrat) — meme si
          // cette valeur etait un jour forgee ou perimee, `remove()` ne doit
          // JAMAIS s en servir pour retirer l objet de stockage.
          storage_path: 'tenant-vole/commande-volee/fichier-vole',
        },
        error: null,
      },
    });
    const repository = new SupabaseOrderFilesRepository(client as any, storageClient as any);

    await repository.remove(TENANT, ORDER_ID, FILE_ID, 'user-1' as any);

    expect(removeCalls).toEqual([[`${TENANT}/${ORDER_ID}/${FILE_ID}`]]);
  });
});
