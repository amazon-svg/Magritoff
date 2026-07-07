/**
 * shopFamilyIdentity — repère de famille UNIFIÉ sur la taxonomie GAMME PIM.
 *
 * Décision Arnaud 2026-07-07 (cohérence nav) : le badge famille de la carte
 * (S2.11), le méga-menu (S2.18) et les pilules (S2.2) doivent tous désigner la
 * MÊME famille. Source unique = la gamme racine résolue (`resolveGamme` +
 * `parent_slug`), pas les 7 familles « mockup » (celles-ci n'ont pas de famille
 * « Affiches » / « Banderoles » → contradiction badge≠menu).
 *
 * Les 7 familles mockup restent réservées au VISUEL (image mockup produit).
 */

import {
  CreditCard,
  FileText,
  Image as ImageIcon,
  Flag,
  Tag,
  Layers,
  BookOpen,
  Boxes,
  RectangleHorizontal,
  Package,
  type LucideIcon,
} from 'lucide-react';
import type { Gamme } from './productEnrichment';
import { resolveGamme } from './productEnrichment';
import { resolveFamilyIdentity, FAMILY_ICON } from './productFamilyIdentity';

export interface ShopFamily {
  /** Slug de gamme racine (ou template mockup en repli). */
  key: string;
  /** Libellé humain (nom de la gamme racine). */
  label: string;
  /** Tonalité hex (repère couleur constant inter-tenant). */
  tone: string;
  /** Pictogramme lucide. */
  icon: LucideIcon;
}

/**
 * Palette curatée par slug de gamme racine. Muted, distinguables, light/dark-safe.
 * Extensible : tout slug racine inconnu retombe sur FALLBACK (jamais vide).
 */
const ROOT_FAMILY: Record<string, { tone: string; icon: LucideIcon }> = {
  carterie: { tone: '#4F6BED', icon: CreditCard }, // indigo
  flyer: { tone: '#D08421', icon: FileText }, // ambre
  affiche: { tone: '#DC2626', icon: ImageIcon }, // rouge
  kakemono: { tone: '#0891B2', icon: Flag }, // cyan
  etiquette: { tone: '#DB2777', icon: Tag }, // rose
  banderole: { tone: '#65A30D', icon: RectangleHorizontal }, // vert
  depliant: { tone: '#8B5CF6', icon: Layers }, // violet
  brochure: { tone: '#0E8F7E', icon: BookOpen }, // teal
  packaging: { tone: '#B4622A', icon: Boxes }, // terracotta
};

const FALLBACK_TONE = '#6B7280'; // gris neutre
const FALLBACK_ICON: LucideIcon = Package;

/** Identité (couleur/picto) d'une gamme racine par son slug + nom. */
export function resolveRootFamilyIdentity(rootSlug: string, rootName: string): ShopFamily {
  const curated = ROOT_FAMILY[rootSlug];
  return {
    key: rootSlug,
    label: rootName,
    tone: curated?.tone ?? FALLBACK_TONE,
    icon: curated?.icon ?? FALLBACK_ICON,
  };
}

/** Remonte à la gamme racine en suivant parent_slug (garde anti-cycle). */
export function rootGammeOf(gamme: Gamme, bySlug: Map<string, Gamme>): Gamme {
  let g = gamme;
  const seen = new Set<string>();
  while (g.parent_slug && bySlug.has(g.parent_slug) && !seen.has(g.slug)) {
    seen.add(g.slug);
    g = bySlug.get(g.parent_slug)!;
  }
  return g;
}

/**
 * Repère de famille d'un produit, PRIORITÉ à la gamme PIM résolue (racine).
 * Repli sur la famille mockup (`resolveFamilyIdentity`) uniquement si le produit
 * ne matche aucune gamme — cas où le méga-menu ne le référence pas non plus.
 */
export function resolveShopFamily(
  product: { config?: unknown; name?: string; category?: string; kind?: string },
  gammes: Gamme[] = [],
): ShopFamily {
  if (gammes.length > 0) {
    const gamme = resolveGamme((product as { config?: unknown }).config, gammes, product.name);
    if (gamme) {
      const bySlug = new Map(gammes.map((g) => [g.slug, g]));
      const root = rootGammeOf(gamme, bySlug);
      return resolveRootFamilyIdentity(root.slug, root.name);
    }
  }
  // Repli : famille mockup (produit hors gamme) — on garde son picto mockup.
  const m = resolveFamilyIdentity(product);
  return { key: m.template, label: m.label, tone: m.tone, icon: FAMILY_ICON[m.template] };
}
