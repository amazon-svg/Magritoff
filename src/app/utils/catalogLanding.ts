/**
 * S2.20 — Landing catégorie éditorialisée (Epic 2, FR-ECOM-10).
 *
 * Helpers purs (testables vitest) qui construisent le modèle d'une landing de
 * famille : titre + intro + sous-catégories + best-sellers. Deux couches :
 *
 *  - `buildCategoryLandingModel` : SOCLE DÉTERMINISTE, sans réseau. Garantit
 *    « jamais de page vide » (AC2) même si l'IA est indisponible.
 *  - `mergeEditorial` : overlay du contenu auto-généré par LLM (endpoint edge
 *    `category-editorial`) — applique seulement les champs non vides (ADR §4.15).
 *
 * Le fetch LLM + le cache sessionStorage vivent côté composant (PortalCatalog) ;
 * ces helpers restent purs.
 */

import type { ShopProduct } from '../contexts/ShopsContext';
import type { TaxonomyFamily, TaxonomyNode } from './shopTaxonomy';

const DEFAULT_MAX_BEST_SELLERS = 3;

/** Contenu éditorial auto-généré (partiel — chaque champ peut manquer). */
export interface CategoryEditorial {
  title?: string;
  intro?: string;
  seo?: string;
}

export interface CategoryLandingModel {
  familyKey: string;
  title: string;
  intro: string;
  /** Meta description SEO (vide tant que l'IA n'a pas répondu). */
  seo: string;
  /** Sous-catégories avec produits (masquées si vides). */
  subcategories: TaxonomyNode[];
  bestSellers: ShopProduct[];
  /** Slugs à filtrer pour rester sur la famille (fil d'Ariane / reset). */
  gammeSlugs: string[];
}

/**
 * Intro déterministe (fallback) : phrase B2B concrète dérivée du nom de famille
 * et du nombre de produits. Sans jargon, sans anglicisme.
 */
export function buildFallbackIntro(family: Pick<TaxonomyFamily, 'label' | 'count'>): string {
  const n = family.count;
  const label = family.label.toLowerCase();
  if (n <= 0) {
    return `Configurez et commandez vos ${label} au tarif négocié de votre boutique.`;
  }
  return `${n} produit${n > 1 ? 's' : ''} ${label} à votre tarif négocié, prêt${n > 1 ? 's' : ''} à configurer et commander.`;
}

/**
 * Construit le socle déterministe de la landing depuis la famille (taxonomie) et
 * les produits filtrés qui lui appartiennent.
 */
export function buildCategoryLandingModel(
  family: TaxonomyFamily,
  products: ShopProduct[],
  opts?: { maxBestSellers?: number },
): CategoryLandingModel {
  const bestSellers = [...products]
    .sort(
      (a, b) =>
        (a.display_order ?? Number.POSITIVE_INFINITY) -
        (b.display_order ?? Number.POSITIVE_INFINITY),
    )
    .slice(0, opts?.maxBestSellers ?? DEFAULT_MAX_BEST_SELLERS);

  return {
    familyKey: family.key,
    title: family.label,
    intro: buildFallbackIntro(family),
    seo: '',
    subcategories: family.subcategories.filter((s) => s.count > 0),
    bestSellers,
    gammeSlugs: family.gammeSlugs,
  };
}

const clean = (s?: string): string | undefined =>
  typeof s === 'string' && s.trim().length > 0 ? s.trim() : undefined;

/**
 * Overlaie le contenu éditorial LLM sur le socle. Seuls les champs non vides
 * remplacent le socle — un LLM muet/partiel ne casse jamais la page.
 */
export function mergeEditorial(
  model: CategoryLandingModel,
  editorial: CategoryEditorial | null | undefined,
): CategoryLandingModel {
  if (!editorial) return model;
  return {
    ...model,
    title: clean(editorial.title) ?? model.title,
    intro: clean(editorial.intro) ?? model.intro,
    seo: clean(editorial.seo) ?? model.seo,
  };
}

/** Clé cache sessionStorage du contenu éditorial d'une famille (1 appel/session). */
export function categoryEditorialCacheKey(slug: string): string {
  return `magrit.shop.landing.${slug}`;
}
