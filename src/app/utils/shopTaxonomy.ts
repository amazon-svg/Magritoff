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

import type { LucideIcon } from 'lucide-react';
import type { ShopProduct } from '../contexts/ShopsContext';
import type { Gamme } from './productEnrichment';
import { resolveRootFamilyIdentity } from './shopFamilyIdentity';
import { resolveFormatLabel } from './catalogFacets';
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
  /**
   * Sous-catégorie DÉRIVÉE par format (repli quand le catalogue est seedé au
   * niveau racine, sans gamme enfant). Porte le label de format normalisé
   * (`resolveFormatLabel`, ex. « A3 ») à présélectionner dans la facette Format
   * du catalogue. Absent = sous-catégorie de gamme classique (filtre par slug).
   * ADR-4.17 : la famille reste la gamme racine ; le format ne fait que raffiner.
   */
  formatKey?: string;
}

export interface TaxonomyFamily extends TaxonomyNode {
  /** Tonalité (repère couleur, unifié sur la gamme racine). */
  tone: string;
  /** Pictogramme lucide de la famille. */
  icon: LucideIcon;
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

/**
 * Repli « sous-catégories par format » (retour Arnaud 2026-07-08).
 *
 * Quand une famille a des produits mais AUCUNE gamme enfant peuplée (cas nominal :
 * le catalogue est seedé au niveau racine, S-CAT-3), on dérive ses sous-catégories
 * depuis les FORMATS distincts de ses produits (`resolveFormatLabel`, la même
 * source que la facette Format S2.19). Ainsi le méga-menu déploie un panneau utile
 * (« Affiches → A3 / A2 / A1 ») sans re-seeder la donnée.
 *
 * Chaque nœud porte `formatKey` (le label de format) pour présélectionner la
 * facette Format à l'ouverture du catalogue, et `gammeSlugs = [racine]` : le
 * filtre reste au niveau FAMILLE (ADR-4.17), le format ne fait que raffiner.
 *
 * Cohérence PIM : si une gamme enfant de la famille correspond au format (ex.
 * « Affiche A3 » pour « A3 »), on reprend son libellé et son image pour un rendu
 * pro aligné sur l'arbre PIM.
 */
function deriveFormatSubcats(
  rootSlug: string,
  children: Gamme[],
  familyProducts: ShopProduct[],
): TaxonomyNode[] {
  const buckets = new Map<string, ShopProduct[]>();
  for (const p of familyProducts) {
    const label = resolveFormatLabel(p);
    const list = buckets.get(label);
    if (list) list.push(p);
    else buckets.set(label, [p]);
  }

  const nodes: TaxonomyNode[] = [];
  for (const [label, ps] of buckets) {
    // On n'expose jamais un bucket fourre-tout « Autre » (format inconnu) : il ne
    // constitue pas une sous-catégorie de navigation utile. Si cela laisse la
    // famille sans sous-catégorie, le panneau reste simplement fermé (rien à
    // détailler) plutôt que d'afficher un intitulé creux.
    if (label === 'Autre') continue;

    // Alignement PIM : gamme enfant dont le nom contient le token de format.
    const child =
      label.length <= 4
        ? children.find((c) => c.name.toLowerCase().includes(label.toLowerCase()))
        : undefined;
    const featured = pickFeatured(ps);
    nodes.push({
      key: child ? child.slug : `fmt:${rootSlug}:${label}`,
      label: child ? child.name : label,
      count: ps.length,
      featured,
      imageUrl: child?.image_url ?? featured?.image_url ?? null,
      gammeSlugs: [rootSlug],
      formatKey: label,
    });
  }
  return nodes.sort(byCountDescThenLabel);
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
    // Repère visuel UNIFIÉ sur la gamme racine (cohérent avec le badge carte).
    const identity = resolveRootFamilyIdentity(root.slug, root.name);

    // Repli : si aucune gamme enfant n'est peuplée mais que la famille a des
    // produits (catalogue seedé au niveau racine), on dérive les sous-catégories
    // par format pour que le méga-menu reste « actif » (retour Arnaud 2026-07-08).
    const subcategories =
      childNodes.length > 0
        ? childNodes
        : deriveFormatSubcats(root.slug, children, allProducts);

    return {
      key: root.slug,
      tone: identity.tone,
      icon: identity.icon,
      label: root.name,
      count: allProducts.length,
      featured,
      imageUrl: root.image_url ?? featured?.image_url ?? null,
      gammeSlugs: [root.slug, ...children.map((c) => c.slug)],
      subcategories,
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
