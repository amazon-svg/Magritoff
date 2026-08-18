import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { publicShopCatalogSchema } from '../../src/modules/shops/api/contracts';

const storefrontTaxConsumers = [
  'src/app/components/shop/PublicShop.tsx',
  'src/app/components/shop/portal/PortalCart.tsx',
  'src/app/components/shop/portal/PortalProduct.tsx',
  'src/app/components/shop/portal/CheckoutPage.tsx',
  'src/app/components/shop/portal/PortalThankYou.tsx',
  'src/app/components/shop/portal/PortalCatalog.tsx',
  'src/app/components/shop/ProductOverlay.tsx',
  'src/app/components/shop/gamme/GammePage.tsx',
  'src/app/hooks/useProductConfigurator.ts',
];

describe('frontière fiscale du storefront', () => {
  it('interdit au parcours boutique de lire le contexte espace Magrit', () => {
    for (const file of storefrontTaxConsumers) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source, file).not.toContain('TenantContext');
      expect(source, file).not.toContain('useTenant');
    }
  });

  it('injecte le taux du catalogue jusque dans le configurateur partagé', () => {
    const publicShop = readFileSync(resolve(process.cwd(), 'src/app/components/shop/PublicShop.tsx'), 'utf8');
    const catalog = readFileSync(resolve(process.cwd(), 'src/app/components/shop/portal/PortalCatalog.tsx'), 'utf8');
    const overlay = readFileSync(resolve(process.cwd(), 'src/app/components/shop/ProductOverlay.tsx'), 'utf8');
    const gamme = readFileSync(resolve(process.cwd(), 'src/app/components/shop/gamme/GammePage.tsx'), 'utf8');
    const configurator = readFileSync(resolve(process.cwd(), 'src/app/hooks/useProductConfigurator.ts'), 'utf8');
    const productCard = readFileSync(resolve(process.cwd(), 'src/app/components/ProductCard.tsx'), 'utf8');
    const services = readFileSync(resolve(process.cwd(), 'src/app/contexts/StorefrontBrowserServicesContext.tsx'), 'utf8');

    expect(publicShop).toContain('<PortalCatalog');
    expect(publicShop).toContain('<GammePage');
    expect(publicShop.match(/taxRate=\{taxRate\}/g)?.length).toBeGreaterThanOrEqual(4);
    expect(catalog).toContain('<ProductOverlay');
    expect(catalog).toContain('taxRate={taxRate}');
    expect(overlay).toContain('useProductConfigurator(product, { taxRate: configuredTaxRate, clariprintGateway })');
    expect(gamme).toContain('useProductConfigurator(defaultProduct, { liveRecalc: true, taxRate, clariprintGateway: clariprint })');
    expect(configurator).toContain('opts.taxRate ?? DEFAULT_TAX_RATE');
    expect(services).toContain('clariprint: runtime.createClariprint(apiRuntime.anonymousClient)');
    expect(catalog).toContain('useStorefrontClariprint()');
    expect(gamme).toContain('clariprintGateway: clariprint');
    expect(overlay).toContain('clariprintGateway');
    expect(configurator).not.toContain('useBrowserServices');
    expect(configurator).toContain('clariprintGateway: ClariprintPricingGateway');
    expect(productCard).toContain('clariprintGateway={clariprint}');
  });

  it('rend le régime fiscal obligatoire dans le catalogue public', () => {
    const base = {
      shop: {
        id: '22222222-2222-4222-8222-222222222222',
        tenantId: '11111111-1111-4111-8111-111111111111',
        slug: 'demo', name: 'Démo', description: '',
        theme: { primaryColor: '#000', accentColor: '#fff', mode: 'light' },
        logoUrl: '', address: '', contactEmail: '', active: true,
        heroImageUrl: null, tagline: null, accessMode: 'invite_only',
        createdAt: '2026-08-18T10:00:00Z',
      },
      products: [], gammes: [], definitions: [], subscribedSlugs: [], customMockups: [],
    };

    expect(publicShopCatalogSchema.safeParse(base).success).toBe(false);
    expect(publicShopCatalogSchema.parse({ ...base, taxRegime: 'dom_tom' }).taxRegime).toBe('dom_tom');
    expect(publicShopCatalogSchema.safeParse({ ...base, taxRegime: 'unknown' }).success).toBe(false);
  });

  it('expose uniquement le régime de la boutique active via le BFF', () => {
    const repository = readFileSync(resolve(process.cwd(), 'src/adapters/supabase/shops-repository.ts'), 'utf8');
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260818000600_public_shop_tax_regime.sql'), 'utf8');

    expect(repository).toContain("rpc('api_get_public_shop_tax_regime'");
    expect(repository).toContain('shopTaxRegimeSchema.parse(taxResult.data)');
    expect(migration).toContain('join public.tenants t on t.id = s.tenant_id');
    expect(migration).toContain('and s.active = true');
    expect(migration).toContain('grant execute on function public.api_get_public_shop_tax_regime(text) to anon, authenticated');
  });
});
