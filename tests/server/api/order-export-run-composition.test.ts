/**
 * Composition du drain de GENERATION des exports (story E10.18d, contrat
 * §8.24 point 6 : « les deux renderers sont derriere un seul port »).
 *
 * AVANT E10.18d, un export `xlsx` reclame echouait TOUJOURS proprement en
 * `order_export.format_not_implemented` (aucun renderer enregistre pour ce
 * format dans `createOrderExportRunApplication`, story E10.18c). Ce test
 * prouve que ce n est PLUS le cas : un export `xlsx` reclame via la
 * composition REELLE (pas un fake de service applicatif — un fake de
 * CLIENT SUPABASE, pour exercer `SupabaseOrderExportRunRepository` et
 * `SupabaseOrderExportStorage` tels qu ils sont vraiment cables) produit un
 * fichier deposé, jamais un `markFailed`.
 */
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createOrderExportRunApplication } from '@/server/api/order-export-composition';
import type { OrderExportRawRow } from '@/modules/order-exports/application/order-export-columns';

type Update = Readonly<{ table: string; values: Record<string, unknown> }>;
type Upload = Readonly<{ path: string; bytes: Uint8Array; contentType: string; upsert: boolean }>;

/**
 * Fake minimal de `SupabaseClient` — juste assez de surface pour que
 * `SupabaseOrderExportRunRepository`/`SupabaseOrderExportStorage` (les
 * VRAIS adaptateurs, pas des doubles) fonctionnent pour UN tour de drain sur
 * UN export `xlsx` avec une poignee de lignes.
 */
function createFakeServiceRoleClient(rows: readonly OrderExportRawRow[]) {
  const updates: Update[] = [];
  const uploads: Upload[] = [];
  let readCalls = 0;

  const client = {
    rpc(name: string, _args: Record<string, unknown>) {
      if (name === 'api_claim_order_exports') {
        return Promise.resolve({
          data: [
            {
              id: 'export-xlsx-1',
              tenant_id: 'tenant-1',
              format: 'xlsx',
              granularity: 'order',
              filters: {},
            },
          ],
          error: null,
        });
      }
      if (name === 'api_read_order_export_rows') {
        readCalls += 1;
        if (readCalls > 1) return Promise.resolve({ data: [], error: null });
        return Promise.resolve({
          data: rows.map((payload, index) => ({ cursor: index, payload })),
          error: null,
        });
      }
      throw new Error(`rpc inattendu dans le fake: ${name}`);
    },
    from(table: string) {
      return {
        update(values: Record<string, unknown>) {
          return {
            eq(_column: string, _value: string) {
              updates.push({ table, values });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
    storage: {
      from(_bucket: string) {
        return {
          upload(path: string, bytes: Uint8Array, options: { contentType: string; upsert: boolean }) {
            uploads.push({ path, bytes, contentType: options.contentType, upsert: options.upsert });
            return Promise.resolve({ error: null });
          },
        };
      },
    },
  };

  return { client: client as unknown as SupabaseClient<any>, updates, uploads };
}

function orderRow(): OrderExportRawRow {
  return {
    order_number: 'CDE-2026-00001',
    quote_number: 'DEV-2026-00001',
    order_created_at: '2026-03-15T08:00:00+00:00',
    customer_type: 'company',
    customer_name: 'Client Test',
    customer_siret: '73282932000074',
    customer_vat_number: 'FR40303265045',
    customer_contact_name: null,
    customer_contact_email: null,
    order_status: 'validated',
    production_step_label: 'PAO',
    lines_subtotal: '1090.00',
    global_discount: '0.00',
    effective_discount_rate: null,
    net_total: '1090.00',
    vat_rate: '0.2000',
    vat_regime: 'metropole_fr',
    vat_amount: '218.00',
    total_incl_tax: '1308.00',
  };
}

describe('createOrderExportRunApplication — le renderer xlsx est desormais enregistre (E10.18d)', () => {
  it('un export xlsx reclame produit un fichier depose, jamais order_export.format_not_implemented', async () => {
    const { client, updates, uploads } = createFakeServiceRoleClient([orderRow()]);
    const app = createOrderExportRunApplication({ serviceRoleClient: client });

    const report = await app.runOnce();

    expect(report).toEqual({ claimed: 1, ready: 1, failed: 0 });

    expect(uploads).toHaveLength(1);
    expect(uploads[0]?.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(uploads[0]?.path).toBe('tenant-1/export-xlsx-1.xlsx');
    expect(uploads[0]?.bytes.byteLength).toBeGreaterThan(0);
    // Un `.xlsx` est une archive ZIP : signature `PK\x03\x04` en tete de fichier.
    expect(Array.from(uploads[0]!.bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);

    const failedUpdate = updates.find((update) => update.values.status === 'failed');
    expect(failedUpdate).toBeUndefined();
    expect(updates.some((update) => update.values.error_detail === undefined ? false : String(update.values.error_detail).includes('format_not_implemented'))).toBe(false);

    const readyUpdate = updates.find((update) => update.values.status === 'ready');
    expect(readyUpdate).toBeDefined();
    expect(readyUpdate?.values.content_type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });
});
