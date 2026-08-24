import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260816000500_storefront_session_lifecycle.sql'), 'utf8');

describe('cycle de vie SQL des sessions storefront', () => {
  it('résout uniquement une session active et un compte compatible', () => {
    expect(migration).toContain('s.revoked_at is null');
    expect(migration).toContain('s.expires_at > clock_timestamp()');
    expect(migration).toContain('s.shop_id = a.shop_id');
    expect(migration).toContain("a.status = 'active'");
  });

  it('ne manipule que le SHA-256 du cookie et ne le retourne jamais', () => {
    expect(migration).toContain("extensions.digest(convert_to(p_opaque_token, 'UTF8'), 'sha256')");
    expect(migration).not.toMatch(/returns table[\s\S]{0,300}opaque_token/i);
  });

  it('révoque idempotemment et limite les grants à anon', () => {
    expect(migration).toContain('set revoked_at = coalesce(revoked_at, clock_timestamp())');
    expect(migration).toContain('grant execute on function public.api_resolve_shop_customer_session(text) to anon');
    expect(migration).toContain('grant execute on function public.api_revoke_shop_customer_session(text) to anon');
  });
});
