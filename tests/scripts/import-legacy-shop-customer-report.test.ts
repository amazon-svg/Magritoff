import { describe, expect, it, vi } from 'vitest';
import { importLegacyShopCustomerReport } from '../../scripts/db/import-legacy-shop-customer-report.mjs';

describe('import-legacy-shop-customer-report', () => {
  it('importe le snapshot en dry-run puis annule la transaction', async () => {
    const row = {
      legacy_tenant_id: '00000000-0000-4000-8000-000000000001',
      legacy_user_id: '00000000-0000-4000-8000-000000000002',
      shop_id: null,
      normalized_email: null,
      proposed_action: 'skipped_no_shop',
      target_account_id: null,
      migration_outcome: 'skipped_no_shop',
      orders_linked_count: 0,
      last_attempt_at: new Date('2026-08-17T12:30:00.000Z'),
    };
    const source = { query: vi.fn().mockResolvedValue({ rows: [row] }) };
    const statements: string[] = [];
    const target = {
      async query(sql: string) {
        const normalized = sql.trim();
        if (['begin','commit','rollback'].includes(normalized)) statements.push(normalized);
        else if (normalized.includes('pg_advisory_xact_lock')) statements.push('lock');
        else if (normalized.includes('import_legacy_shop_customer_migration_report')) statements.push('import');
        else throw new Error(`Requête inattendue : ${normalized}`);
        return { rows: [] };
      },
    };
    const output: string[] = [];
    await expect(importLegacyShopCustomerReport({
      source,target,mode:'dry-run',write:(value:string)=>output.push(value),
    })).resolves.toEqual({mode:'dry-run',source:1,upserted:1});
    expect(statements).toEqual(['begin','lock','import','rollback']);
    expect(output).toEqual(['{"mode":"dry-run","source":1,"upserted":1}\n']);
  });

  it('rollback si un upsert échoue', async () => {
    const target = {
      statements: [] as string[],
      async query(sql:string) {
        const normalized=sql.trim();this.statements.push(normalized);
        if(normalized.includes('import_legacy_shop_customer_migration_report'))throw new Error('invalid row');
        return {rows:[]};
      },
    };
    await expect(importLegacyShopCustomerReport({
      source:{query:vi.fn().mockResolvedValue({rows:[{legacy_tenant_id:'x'}]})},
      target,mode:'apply',write:vi.fn(),
    })).rejects.toThrow('invalid row');
    expect(target.statements.at(-1)).toBe('rollback');
  });
});
