/**
 * BCP-10 (docs/api/CONVENTIONS.md §8.25 point 3.5 (g)/(h), point 4) — fonction
 * pure « résolution → texte + badge », créée par ce lot pour que la fiche
 * produit (dépossédée de son chiffrage propre) affiche un prix par la même
 * règle que la carte catalogue. Cas par cas, comme demandé par le cadrage.
 */

import { describe, expect, it } from 'vitest';
import {
  MARKET_PRICE_BADGE_LABEL,
  UNPRICED_PRICE_LABEL,
  resolveProductPriceDisplay,
} from '@/modules/catalog/ui/storefront/productPriceDisplay';
import type { PriceResolution } from '@/modules/clariprint/ui/helpers';

function resolution(overrides: Partial<PriceResolution>): PriceResolution {
  return {
    priceHT: 0,
    source: 'zero',
    isMarketPrice: true,
    isEstimation: true,
    ...overrides,
  };
}

describe('resolveProductPriceDisplay — point 4 (a) du cadrage BCP-10', () => {
  it('source clariprint : le prix, SANS badge', () => {
    const display = resolveProductPriceDisplay(
      resolution({ source: 'clariprint', priceHT: 12.5, isMarketPrice: false, isEstimation: false }),
    );
    expect(display).toEqual({ kind: 'priced', priceHT: 12.5, badge: false });
  });

  it('source library_cached : le prix, SANS badge', () => {
    const display = resolveProductPriceDisplay(
      resolution({ source: 'library_cached', priceHT: 8, isMarketPrice: false, isEstimation: false }),
    );
    expect(display).toEqual({ kind: 'priced', priceHT: 8, badge: false });
  });

  it('source prix_marche : le prix, AVEC badge « Prix marché »', () => {
    const display = resolveProductPriceDisplay(
      resolution({ source: 'prix_marche', priceHT: 3.2, isMarketPrice: true, isEstimation: true }),
    );
    expect(display).toEqual({ kind: 'priced', priceHT: 3.2, badge: true });
    expect(display.kind === 'priced').toBe(true);
    if (display.kind === 'priced' && display.badge) {
      expect(MARKET_PRICE_BADGE_LABEL).toBe('Prix marché');
    }
  });

  it('source zero : jamais un montant, jamais « 0 € » — un texte de repli', () => {
    const display = resolveProductPriceDisplay(resolution({ source: 'zero', priceHT: 0 }));
    expect(display).toEqual({ kind: 'unpriced', label: UNPRICED_PRICE_LABEL });
    // La preuve « jamais 0 € » : la forme 'unpriced' ne porte AUCUN champ
    // priceHT que l'appelant pourrait afficher tel quel.
    expect('priceHT' in display).toBe(false);
    expect(UNPRICED_PRICE_LABEL).toBe('Prix à la configuration');
  });

  it('un prix_marche à 0 (cas dégénéré) reste priced, jamais confondu avec zero', () => {
    // Régression ciblée : avant ce lot, un branchement naïf sur `priceHT > 0`
    // (au lieu de `source === 'zero'`) aurait fait passer un prix_marche
    // borné à 0 pour une source zero, perdant le badge.
    const display = resolveProductPriceDisplay(
      resolution({ source: 'prix_marche', priceHT: 0, isMarketPrice: true, isEstimation: true }),
    );
    expect(display).toEqual({ kind: 'priced', priceHT: 0, badge: true });
  });
});
