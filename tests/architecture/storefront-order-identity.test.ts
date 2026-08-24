import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260817000100_storefront_order_identity.sql'), 'utf8');
const routes = readFileSync(resolve(process.cwd(), 'src/server/api/orders-routes.ts'), 'utf8');

describe('identité des commandes storefront', () => {
  it('rattache la commande au compte boutique sans fusionner les identités', () => {
    expect(migration).toContain('shop_customer_account_id uuid');
    expect(migration).toContain('acted_by_magrit_user_id uuid');
    expect(migration).toContain('tenant_orders_shop_customer_shop_fkey');
    expect(migration).toContain("v_session.session_kind = 'delegated'");
  });

  it('valide à nouveau le cookie dans la primitive SQL et borne le shop', () => {
    expect(migration).toContain('api_resolve_shop_customer_session(p_opaque_token)');
    expect(migration).toContain('v_session.shop_id <> p_shop_id');
    expect(migration).toContain('private.storefront_order_command_receipts');
  });

  it('lit le cookie côté BFF et conserve le checkout Magrit historique', () => {
    expect(routes).toContain('readStorefrontSessionCookie');
    expect(routes).toContain("kind: 'storefront_session'");
    expect(routes).toContain("kind: 'magrit_user'");
  });
});
