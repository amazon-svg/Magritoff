import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260817000200_storefront_portal_orders.sql'), 'utf8');
const service = readFileSync(resolve(process.cwd(), 'src/modules/orders/application/orders-service.ts'), 'utf8');
const routes = readFileSync(resolve(process.cwd(), 'src/server/api/orders-routes.ts'), 'utf8');
const portal = readFileSync(resolve(process.cwd(), 'src/app/components/shop/portal/PortalOrders.tsx'), 'utf8');
const storefront = readFileSync(resolve(process.cwd(), 'src/app/components/shop/PublicShop.tsx'), 'utf8');
const editor = readFileSync(resolve(process.cwd(), 'src/app/components/shop/portal/PortalOrderEditor.tsx'), 'utf8');
const thankYou = readFileSync(resolve(process.cwd(), 'src/app/components/shop/portal/PortalThankYou.tsx'), 'utf8');
const moduleClients = readFileSync(resolve(process.cwd(), 'src/app/contexts/ModuleClientsContext.tsx'), 'utf8');
const catalog = readFileSync(resolve(process.cwd(), 'src/app/components/shop/portal/PortalCatalog.tsx'), 'utf8');

describe('portail commandes par compte boutique', () => {
  it('valide la session et filtre simultanément par compte et boutique', () => {
    expect(migration).toContain('api_resolve_shop_customer_session(p_opaque_token)');
    expect(migration).toContain('o.shop_id = p_shop_id');
    expect(migration).toContain('o.shop_customer_account_id = v_session.account_id');
  });

  it('ne confère aucun rôle Magrit au compte boutique', () => {
    expect(service).toContain('to_validate: 0, to_approve: 0, to_produce: 0');
    expect(service).toContain('datasets: { mine, to_validate: [], to_approve: [], to_produce: [] }');
  });

  it('résout le cookie côté BFF pour la route portail', () => {
    expect(routes).toContain('portalOrdersAuthorization');
    expect(routes).toContain("kind: 'storefront_session'");
  });

  it('ne dépend plus exclusivement de Supabase Auth dans l UX', () => {
    expect(portal).toContain('!hasStorefrontSession');
    expect(portal).not.toContain('useAuth');
    expect(storefront).toContain('hasStorefrontSession={storefrontSession?.identity.shopId === shop.id}');
  });

  it('ne présente aucune action du workflow interne Magrit', () => {
    expect(portal).toContain('response.datasets.mine.map(orderSummaryToUi)');
    expect(portal).toContain("toStatus: 'cancelled'");
    expect(portal).not.toContain('RejectOrderConfirmDialog');
    expect(portal).not.toContain('handleValidate');
    expect(portal).not.toContain('handleStartProduction');
    expect(portal).not.toContain('handleMarkShipped');
    expect(portal).not.toContain('TabsTrigger');
    expect(portal).not.toContain('response.datasets.to_validate');
  });

  it('utilise un transport sans bearer Magrit pour toutes les commandes storefront', () => {
    expect(moduleClients).toContain('storefrontOrders: new OrdersApiClient(apiRuntime.anonymousClient)');
    expect(storefront).toContain('useStorefrontOrdersApi()');
    expect(portal).toContain('useStorefrontOrdersApi()');
    expect(portal).toContain('auditApi={ordersApi}');
    expect(editor).toContain('useStorefrontOrdersApi()');
    expect(thankYou).toContain('useStorefrontOrdersApi()');
    expect(storefront).not.toContain('useOrdersApi()');
    expect(portal).not.toContain('useOrdersApi()');
    expect(editor).not.toContain('useOrdersApi()');
    expect(thankYou).not.toContain('useOrdersApi()');
  });

  it('charge aussi le catalogue boutique sans bearer Magrit', () => {
    expect(moduleClients).toContain('storefrontShops: new ShopsApiClient(apiRuntime.anonymousClient)');
    expect(storefront).toContain('useStorefrontShopsApi()');
    expect(storefront).not.toContain('useShopsApi()');
  });

  it('ne réutilise pas le bearer Magrit pour l éditorial facultatif', () => {
    expect(moduleClients).toContain('storefrontDiagnostics: new DiagnosticsApiClient(apiRuntime.anonymousClient)');
    expect(catalog).toContain('useStorefrontDiagnosticsApi()');
    expect(catalog).not.toContain('useDiagnosticsApi()');
    expect(catalog).toContain('socle déterministe');
  });
});
