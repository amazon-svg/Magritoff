import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260816000700_ensure_self_shop_customer.sql'),
  'utf8',
);

describe('compte boutique miroir', () => {
  it('dérive l identité depuis auth.uid sans accepter email ou nom du navigateur', () => {
    expect(migration).toContain('v_actor uuid := auth.uid()');
    expect(migration).toContain('from auth.users u where u.id = v_actor');
    expect(migration).not.toMatch(/\bp_(?:email|name)\b/);
  });

  it('vérifie la boutique et la capability de délégation', () => {
    expect(migration).toContain('s.id = p_shop_id and s.tenant_id = p_tenant_id');
    expect(migration).toContain("user_has_capability(p_tenant_id, 'can_impersonate_shop_customer')");
  });

  it('est idempotent sur la contrainte boutique et email', () => {
    expect(migration).toContain('on conflict on constraint shop_customer_accounts_shop_email_unique do nothing');
    expect(migration).toContain("'delegated_only'");
    expect(migration).toContain('where a.shop_id = p_shop_id and a.normalized_email = v_email');
  });
});
