/**
 * S2.33 — Pont PIM -> produits vendables.
 * ───────────────────────────────────────
 * Transforme les gammes du PIM (`product_gammes`) en produits vendables
 * (`product_library`) pour un tenant. Le PIM n'etant qu'une taxonomie +
 * contenu SEO, aucun produit vendable n'existe tant qu'on ne le materialise
 * pas : c'est le role de ce helper.
 *
 * Strategie de prix A1 (decision Arnaud 2026-07-24) : prix a la configuration.
 * Le produit genere a `price_ht = 0` ; le prix reel vient de l'overlay
 * Clariprint quand l'acheteur choisit quantite/format. La carte boutique
 * affiche « Configurez pour le prix » via le marqueur `config.source`.
 *
 * La `config` reste minimale : `ProductOverlay.extractInitialOptions` fournit
 * des defauts pour tout ce qui manque. On fournit juste `kind` (depuis
 * matching_rules) pour cibler le bon type Clariprint, et les dimensions si
 * la gamme les fixe (`size_near`). Un kind non tarifable degrade proprement
 * (l'overlay retombe sur estimateMarketPriceHT), pas de crash.
 */

import type { Gamme } from './productEnrichment';
import type { LibraryProductInput } from '../contexts/LibraryContext';

/** Marqueur d'origine : distingue les produits generes des produits manuels
 *  (idempotence de la generation + non-ecrasement des produits utilisateur). */
export const PIM_GENERATED_SOURCE = 'pim-generated';

/** Quantite par defaut du produit genere (l'acheteur ajuste dans l'overlay). */
export const PIM_DEFAULT_QUANTITY = 500;

export function isPimGenerated(config: unknown): boolean {
  return (
    !!config &&
    typeof config === 'object' &&
    (config as Record<string, unknown>).source === PIM_GENERATED_SOURCE
  );
}

export function buildPimGeneratedProducts(gammes: Gamme[]): LibraryProductInput[] {
  return gammes.map((g) => {
    const rules = g.matching_rules ?? {};
    const kind = Array.isArray(rules.kind) ? rules.kind[0] : rules.kind;
    const near = rules.size_near;

    const clariprintData: Record<string, unknown> = {
      kind: kind ?? 'leaflet',
      quantity: PIM_DEFAULT_QUANTITY,
    };
    if (near && typeof near.width === 'number' && typeof near.height === 'number') {
      clariprintData.width = near.width;
      clariprintData.height = near.height;
    }

    return {
      library_id: null,
      name: g.name,
      category: g.name,
      description: '',
      price_ht: 0,
      image_url: '',
      active: true,
      gamme_slug: g.slug,
      config: {
        id: `pim-${g.slug}`,
        source: PIM_GENERATED_SOURCE,
        kind: kind ?? 'leaflet',
        name: g.name,
        gamme_slug: g.slug,
        quantity: PIM_DEFAULT_QUANTITY,
        clariprintData,
      },
    } as LibraryProductInput;
  });
}
