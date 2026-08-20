import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260816000200_shop_customer_workspace_capabilities.sql'),
  'utf8',
);

describe('accès workspace aux comptes boutique', () => {
  it('introduit deux capabilities explicites sur les rôles canoniques', () => {
    expect(migration).toContain("'can_manage_shop_customers', true");
    expect(migration).toContain("'can_impersonate_shop_customer', true");
    expect(migration).toContain("where name in ('Owner', 'Admin')");
    expect(migration).toContain('trg_canonical_shop_customer_capabilities');
  });

  it('scope chaque policy par la boutique et son tenant', () => {
    expect(migration).toContain('shop.id = shop_customer_accounts.shop_id');
    expect(migration).toContain("user_has_capability(shop.tenant_id, 'can_manage_shop_customers')");
    expect(migration).toContain("user_has_capability(shop.tenant_id, 'can_impersonate_shop_customer')");
    expect(migration).toContain('created_by_magrit_user_id = auth.uid()');
  });

  it('n ouvre aucun accès à anon ni aucune suppression', () => {
    expect(migration).not.toMatch(/grant[^;]+\bdelete\b/i);
    expect(migration).not.toContain('to anon');
    expect(migration).not.toContain('for delete');
    expect(migration).toContain('grant insert (shop_id, email, full_name, status, created_by_magrit_user_id)');
    expect(migration).toContain('grant update (email, full_name, status, activated_at, suspended_at)');
    expect(migration).not.toContain('grant insert (auth_subject_id');
    expect(migration).not.toContain('grant update (shop_id');
  });
});
