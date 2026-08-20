import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260817000300_storefront_order_drafts.sql'), 'utf8');
const routes = readFileSync(resolve(process.cwd(), 'src/server/api/orders-routes.ts'), 'utf8');
const repository = readFileSync(resolve(process.cwd(), 'src/adapters/supabase/orders-repository.ts'), 'utf8');

describe('brouillons Orders par identité boutique', () => {
  it('exige simultanément le compte et la boutique de la session', () => {
    expect(migration).toContain('v_session_account_id = v_order.shop_customer_account_id');
    expect(migration).toContain('v_session_shop_id = v_order.shop_id');
  });

  it('conserve un repli Magrit contrôlé pour les deux sessions parallèles', () => {
    expect(migration).toContain('v_order.created_by <> v_actor');
    expect(migration).toContain('api_update_tenant_order_draft(p_order_id, p_items, p_idempotency_key)');
  });

  it('transporte le cookie seulement dans le contexte serveur Orders', () => {
    expect(routes).toContain('orderResourceAuthorization');
    expect(repository).toContain('api_get_order_draft_for_identity');
    expect(repository).toContain('api_update_order_draft_for_identity');
  });
});
