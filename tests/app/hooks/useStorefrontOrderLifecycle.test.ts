/**
 * Q14-a round 2 (docs/api/CONVENTIONS.md §8.25 point 3.7 (c) et (c-bis)) —
 * `collectPriceNotFirmProductNames`, fonction pure extraite de
 * `useStorefrontOrderLifecycle.renewOrder`. Pas de rendu React, mêmes
 * conventions que `useDashboardOrderManagement.test.ts` (orchestration pure
 * co-localisée avec le hook, testée sans rendu).
 *
 * Round 1 rendait des PHRASES complètes ("{nom} : prix non définitif...")
 * fusionnées dans `renewalWarnings` — défaut D1 de la qa-review : le titre de
 * ce canal ("N produit(s) indisponible(s), non ajouté(s) au panier") fait
 * dire à l'acheteur qu'une ligne bien AJOUTÉE ne l'a pas été. Round 2 : cette
 * fonction rend les NOMS SEULS, exposés dans un état séparé
 * (`renewalPriceNotFirm`), jamais mélangés à `renewalWarnings`. Le texte de
 * la section est composé par `renewalBannerSections`
 * (`orderRenewal.helpers.ts`), pas ici.
 */

import { describe, expect, it } from 'vitest';
import { collectPriceNotFirmProductNames } from '@/modules/orders/ui/hooks/useStorefrontOrderLifecycle';
import { packLine, toPackLine, copies, packs, ONE_PACK } from '@/modules/orders/ui/storefront/cartLine';
import type { ShopProduct } from '@/modules/shops';

function makeProduct(overrides: Partial<ShopProduct> = {}): ShopProduct {
  return {
    id: 'prod-1',
    shop_id: 'shop-1',
    product_id: null,
    name: 'Cartes de visite 85x55',
    category: 'cards',
    description: '',
    price_ht: 0,
    image_url: '',
    config: {},
    display_order: 0,
    ...overrides,
  };
}

describe('collectPriceNotFirmProductNames — point 3.7 (c-bis)', () => {
  it('ligne dont la source re-resolue est library_cached (price_ht en cache) -> aucun nom', () => {
    const line = packLine(makeProduct({ price_ht: 35 }), ONE_PACK);
    expect(collectPriceNotFirmProductNames([line])).toEqual([]);
  });

  it('ligne dont la source re-resolue est clariprint (quote stocke reussi) -> aucun nom', () => {
    const product = makeProduct({
      price_ht: 0,
      config: { clariprintQuote: { success: true, priceHT: 42 } },
    });
    const line = packLine(product, ONE_PACK);
    expect(collectPriceNotFirmProductNames([line])).toEqual([]);
  });

  it('ligne dont la source re-resolue est prix_marche -> le NOM seul, jamais une phrase', () => {
    const product = makeProduct({ name: 'Flyer A5', price_ht: 0 });
    const line = packLine(product, ONE_PACK);
    const names = collectPriceNotFirmProductNames([line]);
    // EGAL au nom seul : si la fonction composait encore une phrase (round
    // 1), cette egalite stricte echouerait.
    expect(names).toEqual(['Flyer A5']);
  });

  it('ligne dont la source re-resolue est zero -> UN nom', () => {
    const product = makeProduct({ name: '', price_ht: 0, config: { quantity: 0 } });
    const line = toPackLine(product, copies(0), packs(1));
    const names = collectPriceNotFirmProductNames([line]);
    expect(names).toEqual(['']);
  });

  it('un nom PAR ligne non ferme, aucun pour les lignes fermes', () => {
    const firm = packLine(makeProduct({ id: 'prod-firm', name: 'Produit ferme', price_ht: 20 }), ONE_PACK);
    const notFirmA = packLine(makeProduct({ id: 'prod-a', name: 'Produit A', price_ht: 0 }), ONE_PACK);
    const notFirmB = packLine(makeProduct({ id: 'prod-b', name: 'Produit B', price_ht: 0 }), ONE_PACK);
    const names = collectPriceNotFirmProductNames([firm, notFirmA, notFirmB]);
    expect(names).toEqual(['Produit A', 'Produit B']);
  });

  it('aucune ligne -> aucun nom', () => {
    expect(collectPriceNotFirmProductNames([])).toEqual([]);
  });
});
