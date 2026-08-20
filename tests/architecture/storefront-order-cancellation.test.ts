import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260817000400_storefront_order_cancellation.sql'), 'utf8');
const routes = readFileSync(resolve(process.cwd(), 'src/server/api/orders-routes.ts'), 'utf8');

describe('annulation de commande par le compte boutique', () => {
  it('limite le propriétaire boutique à draft vers cancelled', () => {
    expect(migration).toContain("p_new_status_code <> 'cancelled'");
    expect(migration).toContain("v_order.status <> 'draft'");
  });

  it('sépare le compte joué et l acteur Magrit dans l audit', () => {
    expect(migration).toContain('shop_customer_account_id uuid');
    expect(migration).toContain('acted_by_magrit_user_id uuid');
    expect(migration).toContain("jsonb_build_object('source', 'storefront_customer')");
  });

  it('conserve la primitive Magrit pour les autres transitions', () => {
    expect(migration).toContain('api_transition_tenant_order_status');
    expect(routes).toContain('transitionAuthorization');
  });
});
