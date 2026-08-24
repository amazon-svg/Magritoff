import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260817000500_storefront_order_audit.sql'), 'utf8');
const routes = readFileSync(resolve(process.cwd(), 'src/server/api/orders-routes.ts'), 'utf8');
const helper = readFileSync(resolve(process.cwd(), 'src/modules/orders/ui/storefront/orderAuditTrail.helpers.ts'), 'utf8');

describe('historique de commande du compte boutique', () => {
  it('exige le compte et la boutique exacts de la commande', () => {
    expect(migration).toContain('v_session_account_id = v_order.shop_customer_account_id');
    expect(migration).toContain('v_session_shop_id = v_order.shop_id');
  });

  it('ne publie que les transitions de statut au storefront', () => {
    expect(migration).toContain('from public.tenant_order_status_events e');
    expect(migration).toContain('from public.get_order_audit_trail(p_order_id) audit');
    expect(migration.indexOf('from public.tenant_order_status_events e'))
      .toBeLessThan(migration.indexOf('from public.get_order_audit_trail(p_order_id) audit'));
  });

  it('masque l acteur interne et conserve les identités d audit explicites', () => {
    expect(migration).toContain('e.shop_customer_account_id');
    expect(migration).toContain('e.acted_by_magrit_user_id');
    expect(migration).toContain('null::text');
    expect(helper).toContain('Intervention Magrit pour le compte boutique');
    expect(helper).toContain('Compte boutique');
  });

  it('fait passer la route publique par l autorisation de ressource', () => {
    expect(routes).toContain('/orders/{orderId}/audit`');
    expect(routes).toContain('await orderResourceAuthorization(context, storefrontSessions, storefrontCookiePolicy)');
  });
});
