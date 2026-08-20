import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260816000800_shop_customer_delegation.sql'),
  'utf8',
);

describe('délégation storefront', () => {
  it('stocke la délégation et seulement le hash de session dans le schéma privé', () => {
    expect(migration).toContain('private.shop_customer_delegations');
    expect(migration).toContain("extensions.digest(convert_to(v_token, 'UTF8'), 'sha256')");
    expect(migration).not.toMatch(/\n\s+token text\b/);
  });

  it('dérive l acteur depuis auth.uid et exige la capability dédiée', () => {
    expect(migration).toContain('v_actor uuid := auth.uid()');
    expect(migration).toContain("user_has_capability(p_tenant_id, 'can_impersonate_shop_customer')");
    expect(migration).toContain('s.active = true');
  });

  it('borne la durée, révoque les anciennes sessions et audite la sortie', () => {
    expect(migration).toContain('p_expires_seconds not between 300 and 3600');
    expect(migration).toContain("session_kind = 'delegated'");
    expect(migration).toContain('private.shop_customer_delegations');
    expect(migration).toContain('v_delegation_id is not null');
  });
});
