/**
 * S7.3 — Helpers PURS de la page gamme /shop/:slug/g/:gamme.
 *
 * Sélection des produits d'une gamme (ADR-4.17 : gamme explicite autoritaire,
 * descendants inclus pour une page famille), résolution du fil d'Ariane et
 * badge de source de prix (Price Display Pattern spec UX : un prix porte
 * TOUJOURS sa source).
 */

import type { ShopProduct } from '../../../../modules/shops';
import type { Gamme } from '../../../utils/productEnrichment';
import { resolveProductGamme } from '../../../utils/productEnrichment';
import type { ConfiguratorPhase } from '../../../hooks/useProductConfigurator';

/** Chips « Top formats » de la spec UX (pré-remplissage 1 clic). */
export const TOP_FORMAT_CHIPS = ['A6', 'A5', 'A4', 'A3'] as const;

/** Gamme + chaîne d'ancêtres (pour breadcrumb famille › gamme). */
export interface GammeInfo {
  gamme: Gamme | null;
  /** Racine (famille) de la gamme — égale à `gamme` si déjà racine. */
  family: Gamme | null;
}

export function resolveGammeInfo(slug: string | undefined, gammes: Gamme[]): GammeInfo {
  if (!slug) return { gamme: null, family: null };
  const bySlug = new Map(gammes.map((g) => [g.slug, g] as const));
  const gamme = bySlug.get(slug) ?? null;
  if (!gamme) return { gamme: null, family: null };
  // Remonte la chaîne parent_slug (garde anti-cycle : max profondeur 10).
  let family = gamme;
  for (let i = 0; i < 10 && family.parent_slug; i += 1) {
    const parent = bySlug.get(family.parent_slug);
    if (!parent) break;
    family = parent;
  }
  return { gamme, family };
}

/** slugs descendants (inclus) d'une gamme dans l'arbre. */
export function collectDescendantSlugs(slug: string, gammes: Gamme[]): Set<string> {
  const childrenByParent = new Map<string, Gamme[]>();
  for (const g of gammes) {
    if (!g.parent_slug) continue;
    const list = childrenByParent.get(g.parent_slug);
    if (list) list.push(g);
    else childrenByParent.set(g.parent_slug, [g]);
  }
  const out = new Set<string>([slug]);
  const stack = [slug];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const child of childrenByParent.get(current) ?? []) {
      if (!out.has(child.slug)) {
        out.add(child.slug);
        stack.push(child.slug);
      }
    }
  }
  return out;
}

/**
 * Produits du catalogue appartenant à la gamme (ou à ses descendantes).
 * Résolution par gamme EXPLICITE d'abord (ADR-4.17), repli règles/nom.
 */
export function selectGammeProducts(
  products: ShopProduct[],
  gammes: Gamme[],
  slug: string | undefined,
): ShopProduct[] {
  if (!slug) return [];
  const accepted = collectDescendantSlugs(slug, gammes);
  return products.filter((p) => {
    const g = resolveProductGamme(p, gammes);
    return g ? accepted.has(g.slug) : false;
  });
}

/**
 * Produit représentatif configuré par la page : 1er produit de la gamme
 * (l'ordre amont respecte display_order puis récence).
 */
export function pickDefaultProduct(products: ShopProduct[]): ShopProduct | null {
  return products[0] ?? null;
}

export type PriceSourceBadge =
  | { kind: 'clariprint'; label: string }
  | { kind: 'marche'; label: string }
  | { kind: 'demande'; label: string }
  | { kind: 'none' };

/**
 * Badge de source affiché à côté du prix selon la phase du moteur S7.2.
 * Jamais de prix sans source (spec UX Price Display Patterns).
 */
export function priceBadgeForPhase(phase: ConfiguratorPhase): PriceSourceBadge {
  if (phase.kind === 'ready') return { kind: 'clariprint', label: 'Prix Clariprint' };
  if (phase.kind === 'error') {
    if (phase.fallbackPriceHT != null) {
      return { kind: 'marche', label: '⚠️ Prix marché' };
    }
    return { kind: 'demande', label: 'Prix sur demande' };
  }
  return { kind: 'none' };
}
