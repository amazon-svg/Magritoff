/**
 * S2.32 — Resolution du perimetre produit d'une boutique.
 * ───────────────────────────────────────────────────────
 * Une boutique expose des produits `product_library` par deux voies
 * orthogonales et cumulables :
 *
 *   1. Bibliotheques liees (`library_ids`) — voie historique : tout produit
 *      dont `library_id` est coche apparait.
 *   2. Mode PIM (`pim_catalog_mode` + `pim_gamme_slugs`) — le catalogue PIM
 *      du tenant, filtre par gamme recensee : tout produit du tenant dont
 *      `gamme_slug` est coche apparait.
 *
 * Ce helper est pur (testable) : il prend les lignes `product_library`
 * brutes (potentiellement issues de plusieurs requetes concatenees) + la
 * config d'exposition du shop, et retourne le sous-ensemble EXPOSE,
 * deduplique par `id`, exclusions retirees.
 *
 * Regles :
 *   - un produit `active === false` n'est jamais expose ;
 *   - un produit dont l'`id` est dans `excludedIds` n'est jamais expose ;
 *   - sinon il est expose s'il matche la voie bibliotheque OU la voie PIM ;
 *   - mode PIM OFF => la voie PIM ne matche jamais ;
 *   - `pim_gamme_slugs` vide + mode ON => la voie PIM ne matche rien
 *     (explicite, pas de fallback) ;
 *   - un produit matchant les deux voies n'apparait qu'une fois (dedup id).
 */

export interface ShopScopeConfig {
  libraryIds: string[];
  pimCatalogMode: boolean;
  pimGammeSlugs: string[];
  excludedIds: string[];
}

export interface ScopableProduct {
  id: string;
  library_id?: string | null;
  gamme_slug?: string | null;
  active?: boolean | null;
}

export function resolveShopProductScope<P extends ScopableProduct>(
  products: P[],
  config: ShopScopeConfig,
): P[] {
  const libIds = new Set(config.libraryIds ?? []);
  const pimSlugs = new Set(config.pimGammeSlugs ?? []);
  const excluded = new Set(config.excludedIds ?? []);
  const pimOn = config.pimCatalogMode === true;

  const seen = new Set<string>();
  const out: P[] = [];

  for (const p of products) {
    if (p.active === false) continue;
    if (excluded.has(p.id)) continue;
    if (seen.has(p.id)) continue;

    const viaLibrary = !!p.library_id && libIds.has(p.library_id);
    const viaPim = pimOn && !!p.gamme_slug && pimSlugs.has(p.gamme_slug);
    if (!viaLibrary && !viaPim) continue;

    seen.add(p.id);
    out.push(p);
  }

  return out;
}
