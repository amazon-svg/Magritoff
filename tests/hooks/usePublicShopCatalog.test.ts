import { describe, expect, it } from 'vitest';
import type { PublicShopCatalog } from '@/modules/shops';
import { mapPublicShopCatalog } from '@/modules/shops/ui/hooks/usePublicShopCatalog';

const shopId = '10000000-0000-4000-8000-000000000001';
const tenantId = '10000000-0000-4000-8000-000000000002';

function catalog(): PublicShopCatalog {
  return {
    shop: {
      id: shopId,
      tenantId,
      slug: 'boutique-test',
      name: 'Boutique Test',
      description: 'Catalogue professionnel',
      theme: { primaryColor: '#111111', accentColor: '#eeeeee', mode: 'light' },
      logoUrl: '/api/v1/assets/logo.png',
      address: 'Paris',
      contactEmail: 'contact@example.test',
      active: true,
      heroImageUrl: null,
      tagline: 'Imprimez simplement',
      accessMode: 'invite_only',
      createdAt: '2026-08-19T10:00:00Z',
    },
    taxRegime: 'franchise_tva',
    products: [{
      id: 'product-reference',
      shopId,
      productId: null,
      name: 'Flyer',
      category: 'Communication',
      description: 'Flyer A5',
      priceHt: 42,
      imageUrl: '/api/v1/assets/flyer.png',
      config: { format: 'A5' },
      displayOrder: 1,
      createdAt: '2026-08-19T10:00:00Z',
      tenantId,
      gammeSlug: 'flyers',
    }],
    gammes: [],
    definitions: [],
    subscribedSlugs: ['flyers'],
    customMockups: [],
  };
}

describe('mapPublicShopCatalog', () => {
  it('construit le modèle de lecture storefront sans identité workspace', () => {
    const state = mapPublicShopCatalog(catalog());

    expect(state.status).toBe('ready');
    expect(state.shop).toMatchObject({
      id: shopId,
      tenant_id: tenantId,
      slug: 'boutique-test',
      access_mode: 'invite_only',
    });
    expect(state.products).toEqual([
      expect.objectContaining({
        id: 'product-reference',
        shop_id: shopId,
        price_ht: 42,
        gamme_slug: 'flyers',
      }),
    ]);
    expect(state.taxRate).toBe(0);
    expect(state.subscribedSlugs).toEqual(new Set(['flyers']));
  });
});
