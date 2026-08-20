import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20260817000700_legacy_shop_only_customer_migration.sql',
), 'utf8');

describe('UM7.1 legacy shop-only migration boundary', () => {
  it('creates one isolated delegated account per valid shop without sharing Auth identity', () => {
    expect(migration).toContain("tm.access_scope = 'shop_only'");
    expect(migration).toContain("'delegated_only'");
    expect(migration).toMatch(/auth_subject_id, status[\s\S]*null, 'delegated_only'/);
    expect(migration).toContain('shop_customer_accounts_shop_email_unique');
  });

  it('keeps the legacy identity while attaching historical orders', () => {
    expect(migration).toContain('set shop_customer_account_id = v_account_id');
    expect(migration).toContain('and orders.created_by = v_plan.legacy_user_id');
    expect(migration).not.toMatch(/delete\s+from\s+public\.tenant_members/i);
    expect(migration).not.toMatch(/delete\s+from\s+auth\.users/i);
  });

  it('provides an idempotent private migration and an audited read-only report', () => {
    expect(migration).toContain('private.legacy_shop_customer_migration_plan');
    expect(migration).toContain('private.legacy_shop_customer_migrations');
    expect(migration).toContain('legacy_shop_customer_migrations_source_unique');
    expect(migration).toContain('api_get_legacy_shop_customer_migration_report');
    expect(migration).toContain("user_has_capability(p_tenant_id, 'can_manage_shop_customers')");
    expect(migration).toContain('revoke all on function private.migrate_legacy_shop_customers');
  });
});
