/**
 * S2.18 (Epic 2, FR-ECOM-08) — Fondation taxonomie navigation boutique.
 *
 * Construit l'arborescence familles → sous-catégories consommée par le méga-menu
 * (S2.18), le fil d'Ariane / facettes (S2.19) et les landings catégorie (S2.20).
 *
 * SOURCE UNIQUE = l'arbre des gammes PIM (`product_gammes.parent_slug`), pas les
 * 7 familles « mockup » (celles-ci ne servent qu'au repère visuel couleur/picto).
 * Ainsi « Affiches » est une famille racine à part entière (et non une
 * sous-catégorie de « Flyers »). Le groupage produits→gamme réutilise
 * `groupProductsByGamme` pour rester COHÉRENT avec les pilules de gammes.
 *
 * Familles et sous-catégories portent `gammeSlugs` → filtrage réel du catalogue
 * (une famille filtre sur sa racine + tous ses enfants).
 *
 * Démo-friendly : si aucun produit ne matche (catalogue POC vide), on retourne
 * le squelette de l'arbre (familles racines, compteurs 0) pour garder la
 * structure de navigation visible.
 */

import type { ShopProduct } from '../contexts/ShopsContext';
import type { Gamme } from './productEnrichment';
import { resolveFamilyIdentity, type FamilyIdentity } from './productFamilyIdentity';
import type { MockupTemplate } from './productMockupAssets';
import {
  buildGammeTree,
  groupProductsByGamme,
} from '../components/shop/ShopGammesSidebar.helpers';

export interface TaxonomyNode {
  /** Slug de gamme (identifiant stable). */
  key: string;
  /** Libellé humain FR (nom de la gamme). */
  label: string;
  /** Nombre de produits rattachés (famille = racine + enfants). */
  count: number;
  /** Produit représentatif (plus petit display_order) pour la vignette. */
  featured: ShopProduct | null;
  /** Image illustrative (gamme ou produit vedette). */
  imageUrl: string | null;
  /** Slugs de gammes à filtrer quand on sélectionne ce nœud. */
  gammeSlugs: string[];
}

export interface TaxonomyFamily extends TaxonomyNode {
  /** Famille « mockup » pour le repère visuel (couleur + picto S2.11). */
  template: MockupTemplate;
  identity: FamilyIdentity;
  /** Sous-catégories (gammes enfants) triées par compteur décroissant. */
  subcategories: TaxonomyNode[];
}

/** Produit de plus petit display_order (undefined → en dernier). */
function pickFeatured(products: ShopProduct[]): ShopProduct | null {
  let best: ShopProduct | null = null;
  for (const p of products) {
    if (best === null) {
      best = p;
      continue;
    }
    const bo = best.display_order ?? Number.POSITIVE_INFINITY;
    const po = p.display_order ?? Number.POSITIVE_INFINITY;
    if (po < bo) best = p;
  }
  return best;
}

/** Tri décroissant par compteur, départage par libellé (déterministe). */
function byCountDescThenLabel(a: TaxonomyNode, b: TaxonomyNode): number {
  if (b.count !== a.count) return b.count - a.count;
  return a.label.localeCompare(b.label, 'fr');
}

export function buildShopTaxonomy(
  products: ShopProduct[],
  gammes: Gamme[] = [],
): TaxonomyFamily[] {
  if (!gammes.length) return [];

  const gammeMap = groupProductsByGamme(products, gammes);
  const { roots, childrenByParent } = buildGammeTree(gammes);

  const buildFamily = (root: Gamme, includeEmptySubcats: boolean): TaxonomyFamily => {
    const children = childrenByParent.get(root.slug) ?? [];
    const childNodes: TaxonomyNode[] = children
      .map((c) => {
        const ps = gammeMap.get(c.slug) ?? [];
        const featured = pickFeatured(ps);
        return {
          key: c.slug,
          label: c.name,
          count: ps.length,
          featured,
          imageUrl: c.image_url ?? featured?.image_url ?? null,
          gammeSlugs: [c.slug],
        };
      })
      .filter((n) => includeEmptySubcats || n.count > 0)
      .sort(byCountDescThenLabel);

    const directProducts = gammeMap.get(root.slug) ?? [];
    const allProducts = [
      ...directProducts,
      ...children.flatMap((c) => gammeMap.get(c.slug) ?? []),
    ];
    const featured = pickFeatured(allProducts);
    // Repère visuel : depuis le produit vedette si dispo, sinon inféré du nom.
    const identity = featured
      ? resolveFamilyIdentity(featured)
      : resolveFamilyIdentity({ name: root.name });

    return {
      key: root.slug,
      template: identity.template,
      identity,
      label: root.name,
      count: allProducts.length,
      featured,
      imageUrl: root.image_url ?? featured?.image_url ?? null,
      gammeSlugs: [root.slug, ...children.map((c) => c.slug)],
      subcategories: childNodes,
    };
  };

  const withProducts = roots
    .map((root) => buildFamily(root, false))
    .filter((f) => f.count > 0)
    .sort(byCountDescThenLabel);

  if (withProducts.length > 0) return withProducts;

  // Repli démo-friendly : squelette complet de l'arbre (compteurs 0), pour
  // que la structure de navigation reste visible sur un catalogue vide.
  return roots
    .map((root) => buildFamily(root, true))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}
