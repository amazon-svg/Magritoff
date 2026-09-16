/**
 * Tests vitest pour cartLine.ts (BCP-11, docs/api/CONVENTIONS.md §8.25 point 3.6).
 *
 * Chaque test cible une mutation nommée au point 3.6 (e). Le mapping exact
 * est repris dans le story doc BCP-11.
 */

import { describe, expect, it } from 'vitest';
import { copies, ONE_PACK, packs, toPackLine } from '@/modules/orders/ui/storefront/cartLine';
import { computePortalCartTotalHt, resolveCartLinePricing } from '@/modules/orders/ui/storefront/cartPricing';
import type { ShopProduct } from '@/modules/shops';
import type { CartLine } from '@/modules/orders/ui/storefront/types';

function forfaitProduct(overrides: Partial<ShopProduct> = {}): ShopProduct {
  return {
    id: 'prod-1',
    shop_id: 'shop-1',
    product_id: null,
    name: 'Flyer A5',
    category: 'flyer',
    description: '',
    price_ht: 35,
    image_url: '',
    config: { clariprintData: { format: 'A5' } },
    display_order: 0,
    created_at: '2026-09-16T00:00:00.000Z',
    tenant_id: 'tenant-1',
    gamme_slug: null,
    ...overrides,
  };
}

describe('cartLine — toPackLine (BCP-11)', () => {
  it('T1 — fige qty a 1 paquet et ecrit les exemplaires dans config.quantity', () => {
    // config porte deja une valeur perimee (100) : si toPackLine etale config
    // APRES avoir pose quantity (inversion d ordre, mutation M3), la valeur
    // perimee ecraserait silencieusement les 500 exemplaires voulus.
    const product = forfaitProduct({
      config: { clariprintData: { format: 'A5' }, quantity: 100 },
    });
    const line = toPackLine(product, copies(500));
    expect(line.qty).toBe(1);
    expect((line.product.config as any).quantity).toBe(500);
  });

  it('T2 — preserve le reste de config (clariprintData, clariprintQuote)', () => {
    const quote = { success: true, priceHT: 35 };
    const product = forfaitProduct({
      config: { clariprintData: { format: 'A5' }, clariprintQuote: quote },
    });
    const line = toPackLine(product, copies(500));
    expect((line.product.config as any).clariprintData).toEqual({ format: 'A5' });
    expect((line.product.config as any).clariprintQuote).toBe(quote);
    expect((line.product.config as any).quantity).toBe(500);
  });

  it('T3 — le test des 17 500 euros : un forfait a 35 euros pour 500 exemplaires facture 35 euros, pas 17500', () => {
    const line = toPackLine(forfaitProduct({ price_ht: 35 }), copies(500));
    expect(resolveCartLinePricing(line).lineTotalHt).toBe(35);
  });

  it('T4 — le total du panier est la somme des forfaits, pas seulement une ligne', () => {
    const lineA = toPackLine(forfaitProduct({ id: 'prod-a', price_ht: 35 }), copies(500));
    const lineB = toPackLine(forfaitProduct({ id: 'prod-b', price_ht: 60 }), copies(1000));
    expect(computePortalCartTotalHt([lineA, lineB])).toBe(95);
  });

  it('T5 — les paquets s ajoutent toujours : meme produit ajoute deux fois = qty 2, total 70', () => {
    const line = toPackLine(forfaitProduct({ price_ht: 35 }), copies(500));
    // Simule le merge d une ligne existante dans le panier (PublicShop.addToCart) :
    // qty reste un number ordinaire, incrementable — ce n est PAS fige a 1.
    const addedTwice: CartLine = { ...line, qty: line.qty + ONE_PACK };
    expect(addedTwice.qty).toBe(2);
    expect(resolveCartLinePricing(addedTwice).lineTotalHt).toBe(70);
  });

  it('T11 (BCP-11 round 2, defaut 1) — toPackLine preserve un packCount explicite, ne le fige pas a ONE_PACK', () => {
    // Le troisieme parametre existe UNIQUEMENT pour rebuildCartFromOrderItems
    // (renouvellement) : reconstruire une commande passee de 2 paquets a
    // 500 ex. chacun doit rendre qty=2, pas 1. Round 1 de ce lot ignorait ce
    // parametre (n existait pas) et figeait toujours ONE_PACK — regression
    // relevee en qa-review, corrigee ici au niveau le plus bas (pur,
    // sans passer par rebuildCartFromOrderItems).
    const line = toPackLine(forfaitProduct({ price_ht: 35 }), copies(500), packs(2));
    expect(line.qty).toBe(2);
    expect((line.product.config as any).quantity).toBe(500);
    expect(resolveCartLinePricing(line).lineTotalHt).toBe(70);
  });

  it('T12 — sans packCount explicite, toPackLine garde le defaut ONE_PACK (geste normal d ajout)', () => {
    const line = toPackLine(forfaitProduct({ price_ht: 35 }), copies(500));
    expect(line.qty).toBe(1);
  });
});
