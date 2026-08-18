import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260816000600_storefront_credential_activation.sql'), 'utf8');
const sessionMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260818000500_storefront_activation_session.sql'), 'utf8');

describe('activation des credentials storefront', () => {
  it('stocke uniquement le hash d un jeton court et révocable', () => {
    expect(migration).toContain('private.shop_customer_activation_tokens');
    expect(migration).toContain('token_hash bytea not null unique');
    expect(migration).toContain('consumed_at timestamptz');
    expect(migration).not.toMatch(/\n\s+token text\b/);
  });
  it('réserve l émission au workspace autorisé et l activation à anon', () => {
    expect(migration).toContain("user_has_capability(p_tenant_id, 'can_manage_shop_customers')");
    expect(migration).toContain('to authenticated');
    expect(migration).toContain('api_activate_shop_customer(text, text) to anon');
  });
  it('active atomiquement le compte, consomme le jeton et révoque les sessions', () => {
    expect(migration).toContain("set status = 'active'");
    expect(migration).toContain('on conflict (shop_customer_account_id) do update');
    expect(migration).toContain('set consumed_at = v_now');
    expect(migration).toContain('private.shop_customer_sessions set revoked_at');
  });
  it('émet atomiquement la première session storefront après activation', () => {
    expect(sessionMigration).toContain('returns table (');
    expect(sessionMigration).toContain('private.shop_customer_sessions');
    expect(sessionMigration).toContain("'direct'");
    expect(sessionMigration).toContain('opaque_token text');
    expect(sessionMigration).toContain('api_activate_shop_customer(text, text)');
  });
});
