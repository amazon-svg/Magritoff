import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(
  process.cwd(),
  'src/app/components/dashboard/LegacyShopCustomerMigrationSection.tsx',
), 'utf8');
const hook = readFileSync(resolve(
  process.cwd(),
  'src/app/hooks/useLegacyShopCustomerMigrationReport.ts',
), 'utf8');
const users = readFileSync(resolve(
  process.cwd(),
  'src/app/components/dashboard/DashboardUsers.tsx',
), 'utf8');

describe('surface de contrôle de migration des comptes boutique', () => {
  it('passe exclusivement par la façade API et reste dans la surface Utilisateurs', () => {
    expect(source).toContain('useLegacyShopCustomerMigrationReport');
    expect(source).not.toContain('useShopCustomersApi');
    expect(hook).toContain('useShopCustomersApi');
    expect(hook).toContain('api.migrationReport(tenantId)');
    expect(source).not.toContain('utils/supabase');
    expect(source).not.toMatch(/\bsupabase\s*\./);
    expect(users).toContain('<LegacyShopCustomerMigrationSection />');
  });

  it('reste invisible sans dette legacy et rend les anomalies contrôlables', () => {
    expect(hook).toContain("rows.length > 0 ? { kind: 'ready', rows } : { kind: 'hidden' }");
    expect(hook).toContain("migrationOutcome?.startsWith('skipped_')");
    expect(source).toContain('ordersLinkedCount');
    expect(source).toContain('nettoyage final UM8');
  });
});
