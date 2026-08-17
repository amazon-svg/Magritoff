import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(
  process.cwd(),
  'src/app/components/dashboard/LegacyShopCustomerMigrationSection.tsx',
), 'utf8');
const users = readFileSync(resolve(
  process.cwd(),
  'src/app/components/dashboard/DashboardUsers.tsx',
), 'utf8');

describe('surface de contrôle de migration des comptes boutique', () => {
  it('passe exclusivement par la façade API et reste dans la surface Utilisateurs', () => {
    expect(source).toContain('useShopCustomersApi');
    expect(source).toContain('api.migrationReport');
    expect(source).not.toContain('utils/supabase');
    expect(source).not.toMatch(/\bsupabase\s*\./);
    expect(users).toContain('<LegacyShopCustomerMigrationSection />');
  });

  it('reste invisible sans dette legacy et rend les anomalies contrôlables', () => {
    expect(source).toContain("rows.length > 0 ? { kind: 'ready', rows } : { kind: 'hidden' }");
    expect(source).toContain("migrationOutcome?.startsWith('skipped_')");
    expect(source).toContain('ordersLinkedCount');
    expect(source).toContain('nettoyage final UM8');
  });
});
