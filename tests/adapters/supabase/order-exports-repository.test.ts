/**
 * `SupabaseOrderExportsRepository.toDto()` — MOYEN M2, qa-review round 2
 * (2026-09-15, E10.18e-2). Avant ce correctif, l URL de telechargement
 * etait signee SANS l option `download` du stockage, a la difference de
 * `SupabaseOrderFilesRepository.toDetailDto()` (`order-files-repository.ts`,
 * `{ download: row.filename }`). L ancre detachee de
 * `triggerBrowserDownload()` (`OrderExportPanel.tsx`) pointe vers l ORIGINE
 * DU BUCKET SUPABASE STORAGE, distincte de celle de l application : sans
 * cette option DE SIGNATURE (qui pose `Content-Disposition: attachment` sur
 * la reponse), l attribut `download` de l ancre HTML n est pas honore par le
 * navigateur sur une URL cross-origin — un CSV/XLSX servi ainsi ferait
 * NAVIGUER l onglet vers l URL signee au lieu de declencher un
 * telechargement, exactement comme le mecanisme ecarte au profit de l ancre
 * (`window.location.assign`, voir le story doc, decision 8).
 *
 * Ce test verifie la couche EN DESSOUS de tout comportement de navigateur :
 * la troisieme option de `createSignedUrl()` porte bien `{ download:
 * row.file_name }`, sur le MEME modele que `order-files-repository.ts`.
 */
import { describe, expect, it } from 'vitest';
import { SupabaseOrderExportsRepository } from '@/adapters/supabase/order-exports-repository';
import type { TenantId, UserId } from '@/kernel';

const TENANT = 'tenant-1' as TenantId;
const ACTOR = 'user-1' as UserId;
const EXPORT_ID = 'export-1';
const STORAGE_PATH = `${TENANT}/${EXPORT_ID}.xlsx`;
const FILE_NAME = 'commandes-order-2026-09-01_2026-09-10-20260915120000.xlsx';

function readyOwnedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: EXPORT_ID,
    status: 'ready',
    format: 'xlsx',
    granularity: 'order',
    filters: {},
    layout_version: 1,
    requested_by: ACTOR,
    requested_by_label: 'Test',
    requested_at: '2026-09-15T10:00:00.000Z',
    started_at: '2026-09-15T10:00:01.000Z',
    completed_at: '2026-09-15T10:00:05.000Z',
    row_count: 3,
    storage_path: STORAGE_PATH,
    file_name: FILE_NAME,
    byte_size: 1024,
    sha256: 'a'.repeat(64),
    content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    expires_at: '2026-09-22T10:00:05.000Z',
    attempts: 1,
    error_code: null,
    error_detail: null,
    ...overrides,
  };
}

/** Faux client PostgREST (`findById`) + Storage, capture les options passees a `createSignedUrl`. */
function fakeClients(row: Record<string, unknown> | null) {
  const createSignedUrlCalls: Array<{ path: string; expiresIn: number; options: unknown }> = [];

  const client = {
    from(table: string) {
      if (table !== 'commercial_order_exports') throw new Error(`table inattendue dans ce faux: ${table}`);
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: row, error: null }),
            }),
          }),
        }),
      };
    },
  };

  const storageClient = {
    storage: {
      from(_bucket: string) {
        return {
          createSignedUrl: async (path: string, expiresIn: number, options: unknown) => {
            createSignedUrlCalls.push({ path, expiresIn, options });
            return { data: { signedUrl: 'https://storage.test/signed' }, error: null };
          },
        };
      },
    },
  };

  return { client, storageClient, createSignedUrlCalls };
}

describe('SupabaseOrderExportsRepository.findById (toDto) — MOYEN M2, qa-review round 2', () => {
  it('signe l URL de telechargement avec { download: row.file_name }, sur le MEME modele que order-files-repository.ts', async () => {
    const { client, storageClient, createSignedUrlCalls } = fakeClients(readyOwnedRow());
    const repository = new SupabaseOrderExportsRepository(client as any, storageClient as any);

    const dto = await repository.findById(TENANT, ACTOR, EXPORT_ID);

    expect(dto).not.toBeNull();
    expect(dto!.download_url).toBe('https://storage.test/signed');
    expect(createSignedUrlCalls).toHaveLength(1);
    // AVANT ce correctif : `createSignedUrl(row.storage_path, 300)`, SANS
    // troisieme argument — une ancre `download` sur une URL cross-origin
    // n aurait alors pas force le telechargement.
    expect(createSignedUrlCalls[0]!.options).toEqual({ download: FILE_NAME });
  });

  it('ne signe AUCUNE URL quand l appelant n est pas le demandeur (download_url doit rester null)', async () => {
    const { client, storageClient, createSignedUrlCalls } = fakeClients(
      readyOwnedRow({ requested_by: 'un-autre-membre' }),
    );
    const repository = new SupabaseOrderExportsRepository(client as any, storageClient as any);

    const dto = await repository.findById(TENANT, ACTOR, EXPORT_ID);

    expect(dto).not.toBeNull();
    expect(dto!.download_url).toBeNull();
    expect(createSignedUrlCalls).toHaveLength(0);
  });
});
