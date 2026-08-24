import { describe, expect, it } from 'vitest';
import {
  indexShopPricing,
  toShopProduct,
  validateShopBrandAsset,
} from '@/modules/shops/ui/hooks/useShopEditorOperations';
import type { ShopProductDto } from '@/modules/shops';

describe('useShopEditorOperations helpers', () => {
  it('normalise un produit du contrat Shops pour la vue historique', () => {
    const dto = {
      id: '00000000-0000-4000-8000-000000000001',
      shopId: '00000000-0000-4000-8000-000000000002',
      productId: null,
      name: 'Flyer',
      category: 'Communication',
      description: 'A5',
      priceHt: 42,
      imageUrl: '/api/v1/assets/flyer',
      config: { format: 'A5' },
      displayOrder: 3,
      createdAt: '2026-08-20T08:00:00Z',
      tenantId: '00000000-0000-4000-8000-000000000003',
      gammeSlug: 'flyers',
    } satisfies ShopProductDto;

    expect(toShopProduct(dto)).toMatchObject({
      shop_id: dto.shopId,
      product_id: null,
      price_ht: 42,
      image_url: '/api/v1/assets/flyer',
      gamme_slug: 'flyers',
    });
  });

  it('indexe les tarifs négociés par produit bibliothèque', () => {
    expect(indexShopPricing([
      { libraryProductId: 'product-a', priceHtOverride: 12.5 },
      { libraryProductId: 'product-b', priceHtOverride: 40 },
    ])).toEqual({ 'product-a': 12.5, 'product-b': 40 });
  });

  it('valide le type et la taille des images de marque', () => {
    expect(validateShopBrandAsset(new File(['image'], 'logo.png', { type: 'image/png' }))).toBeNull();
    expect(validateShopBrandAsset(new File(['image'], 'logo.svg', { type: 'image/svg+xml' })))
      .toContain('Format non supporté');
    expect(validateShopBrandAsset(new File([new Uint8Array(5_242_881)], 'hero.webp', { type: 'image/webp' })))
      .toContain('5 Mo maximum');
  });
});
