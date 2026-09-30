import { describe, expect, it, vi } from 'vitest';
import {
  importLegacyShopOrders,
  importMode,
} from '../../scripts/db/import-legacy-shop-orders.mjs';

describe('import-legacy-shop-orders', () => {
  it('reste en dry-run par défaut et exige un choix non ambigu', () => {
    expect(importMode([])).toBe('dry-run');
    expect(importMode(['--dry-run'])).toBe('dry-run');
    expect(importMode(['--apply'])).toBe('apply');
    expect(() => importMode(['--apply', '--dry-run'])).toThrow('Choisir --apply ou --dry-run');
    expect(() => importMode(['--force'])).toThrow('Argument inconnu');
  });

  it('simule toute la reprise puis rollback avec un bilan vérifié', async () => {
    const source = {
      query: vi.fn().mockResolvedValue({ rows: [sourceOrder('order-a'), sourceOrder('order-b')] }),
    };
    const target = fakeTarget([{ replayed: false }, { replayed: true }], 2);
    const output: string[] = [];

    await expect(importLegacyShopOrders({
      source,
      target,
      mode: 'dry-run',
      write: (value: string) => output.push(value),
    })).resolves.toEqual({ mode: 'dry-run', source: 2, imported: 1, replayed: 1, verified: 2 });

    expect(target.statements).toEqual(expect.arrayContaining(['begin', 'rollback']));
    expect(target.statements).not.toContain('commit');
    expect(output).toEqual(['{"mode":"dry-run","source":2,"imported":1,"replayed":1,"verified":2}\n']);
  });

  it('rollback si la vérification finale ne couvre pas toute la source', async () => {
    const target = fakeTarget([{ replayed: false }], 0);
    await expect(importLegacyShopOrders({
      source: { query: vi.fn().mockResolvedValue({ rows: [sourceOrder('order-a')] }) },
      target,
      mode: 'apply',
      write: vi.fn(),
    })).rejects.toThrow('Vérification incomplète : 0/1');
    expect(target.statements.at(-1)).toBe('rollback');
    expect(target.statements).not.toContain('commit');
  });
});

function sourceOrder(id: string) {
  return {
    id,
    shop_id: '00000000-0000-4000-8000-000000000001',
    customer_name: 'Buyer',
    customer_email: 'buyer@example.test',
    customer_phone: '',
    items: [{ name: 'Flyer', qty: 1, price_ht: 10 }],
    total_ht: '10.00',
    total_ttc: '12.00',
    notes: '',
    status: 'pending',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function fakeTarget(importResults: readonly { replayed: boolean }[], verified: number) {
  const statements: string[] = [];
  let importIndex = 0;
  return {
    statements,
    async query(sql: string) {
      const normalized = sql.trim();
      if (normalized === 'begin' || normalized === 'commit' || normalized === 'rollback') {
        statements.push(normalized);
        return { rows: [] };
      }
      if (normalized.includes('pg_advisory_xact_lock')) {
        statements.push('lock');
        return { rows: [] };
      }
      if (normalized.includes('magrit.import_legacy_shop_order')) {
        statements.push('import');
        return { rows: [importResults[importIndex++]] };
      }
      if (normalized.includes('legacy_shop_order_imports')) {
        statements.push('verify');
        return { rows: [{ count: String(verified) }] };
      }
      throw new Error(`Requête inattendue : ${normalized}`);
    },
  };
}
