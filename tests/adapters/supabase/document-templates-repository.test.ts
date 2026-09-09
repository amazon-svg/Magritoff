/**
 * `SupabaseDocumentTemplatesRepository.findEligibleTemplateForGeneration`
 * (E10.10b-4c) — qa-review (non bloquant, round 2) : le CODE etait deja
 * correct (`has_field_map` complete OU sur `lines_block`/placements, voir
 * `templateHasFieldMap`), mais AUCUN test ne le prouvait — tous les tests
 * existants de `quote-documents-service` injectent directement un FAUX
 * `findEligibleTemplateForGeneration`, jamais l implementation Supabase
 * elle-meme. Ce fichier verifie le 4e terme de la condition d attachement a
 * quatre termes (contrat §8.18 §5) : un gabarit `ready`+actif+defaut MAIS a
 * la carte VIDE (ni `lines_block`, ni le moindre placement) doit se
 * comporter EXACTEMENT comme "pas de gabarit" (`null`), jamais produire de
 * piece jointe vide.
 *
 * qa-review B3 (bloquant, corrige dans le meme lot) : distingue un objet de
 * fond REELLEMENT absent (404 Storage explicite, `statusCode: '404'`,
 * verifie par execution reelle contre Supabase Storage local) d une AUTRE
 * panne (reseau, 5xx) qui doit etre LEVEE, jamais avalee comme "pas de
 * gabarit".
 */
import { describe, expect, it } from 'vitest';
import { SupabaseDocumentTemplatesRepository } from '@/adapters/supabase/document-templates-repository';
import type { TenantId } from '@/kernel';

const TENANT = 'tenant-1' as TenantId;
const TEMPLATE_ID = 'template-1';

type TemplateRow = Readonly<{
  id: string;
  document_type: string;
  name: string;
  status: string;
  storage_path: string | null;
  byte_size: number | null;
  sha256: string | null;
  page_count: number | null;
  pages: unknown;
  lines_block: unknown;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}>;

function eligibleTemplateRow(overrides: Partial<TemplateRow> = {}): TemplateRow {
  return {
    id: TEMPLATE_ID,
    document_type: 'quote',
    name: 'Gabarit',
    status: 'ready',
    storage_path: `${TENANT}/${TEMPLATE_ID}.pdf`,
    byte_size: 1000,
    sha256: 'a'.repeat(64),
    page_count: 1,
    pages: [{ index: 0, width_pt: 595.28, height_pt: 841.89 }],
    lines_block: null,
    is_default: true,
    is_active: true,
    created_at: '2026-09-09T10:00:00.000Z',
    updated_at: '2026-09-09T10:00:00.000Z',
    ...overrides,
  };
}

/** Faux client PostgREST + Storage, DEDIE a `findEligibleTemplateForGeneration`. */
function fakeClient(options: {
  templateRow: TemplateRow | null;
  fieldRows?: readonly Record<string, unknown>[];
  downloadResult?: { data: Blob | null; error: { message: string; statusCode?: string } | null };
}) {
  const fieldRows = options.fieldRows ?? [];
  const downloadResult = options.downloadResult ?? {
    data: new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])]),
    error: null,
  };

  const client = {
    from(table: string) {
      if (table === 'document_pdf_templates') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          maybeSingle: async () => ({ data: options.templateRow, error: null }),
        };
        return builder;
      }
      if (table === 'document_pdf_template_fields') {
        const builder: any = {
          select: (columns: string) => {
            builder.__columns = columns;
            return builder;
          },
          eq: () => builder,
          limit: async () => ({ data: fieldRows.slice(0, 1), error: null }),
          then: (resolve: (value: { data: unknown; error: null }) => void) => resolve({ data: fieldRows, error: null }),
        };
        return builder;
      }
      throw new Error(`table inattendue dans ce faux: ${table}`);
    },
  };

  const storageClient = {
    storage: {
      from(_bucket: string) {
        return {
          download: async () => downloadResult,
        };
      },
    },
  };

  return { client, storageClient };
}

describe('findEligibleTemplateForGeneration — 4e terme (has_field_map), qa-review non bloquant', () => {
  it('rend null : gabarit ready+actif+defaut mais carte VIDE (aucun lines_block, aucun placement)', async () => {
    const { client, storageClient } = fakeClient({
      templateRow: eligibleTemplateRow({ lines_block: null }),
      fieldRows: [],
    });
    const repository = new SupabaseDocumentTemplatesRepository(client as any, storageClient as any);

    const result = await repository.findEligibleTemplateForGeneration(TENANT);

    expect(result).toBeNull();
  });

  it('rend le gabarit eligible : lines_block absent MAIS au moins un placement persiste', async () => {
    const { client, storageClient } = fakeClient({
      templateRow: eligibleTemplateRow({ lines_block: null }),
      fieldRows: [
        {
          field: 'quote.number',
          page_index: 0,
          x: 50,
          y: 700,
          width: null,
          max_lines: 1,
          align: 'left',
          font: 'helvetica',
          font_size: 12,
          color: '#111111',
        },
      ],
    });
    const repository = new SupabaseDocumentTemplatesRepository(client as any, storageClient as any);

    const result = await repository.findEligibleTemplateForGeneration(TENANT);

    expect(result).not.toBeNull();
    expect(result?.templateId).toBe(TEMPLATE_ID);
    expect(result?.placements).toHaveLength(1);
  });

  it('rend le gabarit eligible : lines_block present, aucun placement necessaire', async () => {
    const { client, storageClient } = fakeClient({
      templateRow: eligibleTemplateRow({ lines_block: { page_index: 0, first_row_baseline_y: 700, row_height: 14, rows_per_page: 20, continuation_page_index: null, columns: [] } }),
      fieldRows: [],
    });
    const repository = new SupabaseDocumentTemplatesRepository(client as any, storageClient as any);

    const result = await repository.findEligibleTemplateForGeneration(TENANT);

    expect(result).not.toBeNull();
    expect(result?.linesBlock).not.toBeNull();
  });

  it('rend null : aucun gabarit ready+actif+defaut pour ce tenant', async () => {
    const { client, storageClient } = fakeClient({ templateRow: null });
    const repository = new SupabaseDocumentTemplatesRepository(client as any, storageClient as any);

    await expect(repository.findEligibleTemplateForGeneration(TENANT)).resolves.toBeNull();
  });

  it('qa-review B3 — rend null sur un 404 Storage EXPLICITE (objet reellement absent, defense en profondeur)', async () => {
    const { client, storageClient } = fakeClient({
      templateRow: eligibleTemplateRow({ lines_block: { page_index: 0, first_row_baseline_y: 700, row_height: 14, rows_per_page: 20, continuation_page_index: null, columns: [] } }),
      downloadResult: { data: null, error: { message: 'Object not found', statusCode: '404' } },
    });
    const repository = new SupabaseDocumentTemplatesRepository(client as any, storageClient as any);

    await expect(repository.findEligibleTemplateForGeneration(TENANT)).resolves.toBeNull();
  });

  it("qa-review B3 (BLOQUANT, corrige) — LEVE une erreur sur toute AUTRE panne Storage (reseau, 5xx), jamais un repli silencieux vers 'pas de gabarit'", async () => {
    const { client, storageClient } = fakeClient({
      templateRow: eligibleTemplateRow({ lines_block: { page_index: 0, first_row_baseline_y: 700, row_height: 14, rows_per_page: 20, continuation_page_index: null, columns: [] } }),
      downloadResult: { data: null, error: { message: 'internal server error', statusCode: '500' } },
    });
    const repository = new SupabaseDocumentTemplatesRepository(client as any, storageClient as any);

    await expect(repository.findEligibleTemplateForGeneration(TENANT)).rejects.toThrow();
  });
});
