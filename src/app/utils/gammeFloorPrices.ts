/**
 * S7.6 — Prix plancher « dès X € » par gamme (ADR §4.18 ADR-GAMME-FLOOR-1).
 *
 * Calcul à la volée, client-side, sur les données déjà chargées par la
 * boutique — AUCUN appel Clariprint (latence + anomalies §3.6), AUCUNE table
 * de cache (catalogues ≤ ~30 produits, audit prod 2026-07-26).
 *
 * Le min est pris sur `resolvePrice()` (cascade canonique) des produits de
 * chaque gamme résolue (ADR-4.17 : gamme explicite autoritaire), et agrégé
 * au niveau famille racine (les tuiles home sont des familles). La SOURCE du
 * produit minimal est conservée → badge cohérent (⚠️ prix marché vs cache).
 * Gamme sans aucun prix > 0 → absente de la map (« Prix à la configuration »
 * côté rendu, jamais « 0 € »).
 */

import type { ShopProduct } from '../contexts/ShopsContext';
import type { Gamme } from './productEnrichment';
import { resolveProductGamme } from './productEnrichment';
import { rootGammeOf } from './shopFamilyIdentity';
import { resolvePrice, type PriceResolution } from './priceResolver';
import { DEFAULT_CURRENCY, type CurrencyCode } from './currency';

export function computeGammeFloorPrices(
  products: ShopProduct[],
  gammes: Gamme[],
  /**
   * Devise de l imprimeur — zone monetaire du prix marche (arbitrage Arnaud
   * 2026-08-10). Sans zone calibree, les produits sans prix en cache sortent
   * en source `zero` et la gamme bascule sur « Prix a la configuration ».
   */
  currency: CurrencyCode = DEFAULT_CURRENCY,
): Map<string, PriceResolution> {
  const bySlug = new Map(gammes.map((g) => [g.slug, g] as const));
  const floors = new Map<string, PriceResolution>();

  const consider = (slug: string, resolution: PriceResolution) => {
    if (resolution.source === 'zero' || resolution.priceHT <= 0) return;
    const current = floors.get(slug);
    if (!current || resolution.priceHT < current.priceHT) {
      floors.set(slug, resolution);
    }
  };

  for (const product of products) {
    const gamme = resolveProductGamme(product, gammes);
    if (!gamme) continue;
    const resolution = resolvePrice(product, null, currency);
    consider(gamme.slug, resolution);
    // Agrégat famille racine (tuiles home) — évite un double comptage si la
    // gamme est déjà racine.
    const root = rootGammeOf(gamme, bySlug);
    if (root.slug !== gamme.slug) consider(root.slug, resolution);
  }

  return floors;
}
