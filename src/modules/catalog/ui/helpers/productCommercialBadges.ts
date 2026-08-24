/**
 * S2.12 (Epic 2, FR-ECOM-02) — Badges d'état commercial ProductCard.
 *
 * Badges CALCULÉS depuis les données (jamais saisis) : Express 24h, Nouveau,
 * Meilleure vente, Éco. Règles (UX §1, décisions Arnaud 2026-07-07) :
 *  - data-driven : un badge n'apparaît que si son flag est vrai (aucun → rien) ;
 *  - priorité Express > Nouveau > Meilleure vente > Éco (le délai est l'info la
 *    plus actionnable en B2B) ;
 *  - plafond 2 badges visibles (pas de sapin de Noël) ;
 *  - tonalités SÉMANTIQUES NEUTRES, constantes inter-tenant (décision B).
 *
 * DoD #4 : la fenêtre de récence "Nouveau" est un seuil à confirmer sur données
 * prod → NEW_PRODUCT_WINDOW_DAYS est marqué AUDIT-PENDING. Best-seller/Éco/
 * Express n'ont pas encore de data source dans le schéma → flags restent false
 * jusqu'à ajout (badges inactifs, conforme "aucun badge si rien").
 */

export type CommercialBadgeKind = 'express' | 'new' | 'bestseller' | 'eco';

/** Ordre de priorité décroissant (UX §1). Le 1er = le plus prioritaire. */
export const BADGE_PRIORITY: readonly CommercialBadgeKind[] = [
  'express',
  'new',
  'bestseller',
  'eco',
] as const;

/** Nombre max de badges affichés simultanément (UX §1). */
export const MAX_VISIBLE_BADGES = 2;

/** Tonalité sémantique neutre — mappée à un token status côté composant. */
export type BadgeTone = 'ok' | 'warn' | 'info' | 'accent';

export const BADGE_META: Record<CommercialBadgeKind, { label: string; tone: BadgeTone }> = {
  express: { label: 'Express 24h', tone: 'warn' },
  new: { label: 'Nouveau', tone: 'info' },
  bestseller: { label: 'Meilleure vente', tone: 'accent' },
  eco: { label: 'Éco', tone: 'ok' },
};

/**
 * Fenêtre de récence (jours) pour le badge "Nouveau".
 * ⚠️ AUDIT-PENDING (DoD #4) — défaut prudent, à confirmer sur la distribution
 * réelle de shop_products.created_at avant de figer. Voir story-S2.12.
 */
export const NEW_PRODUCT_WINDOW_DAYS = 30;

/** Flags d'entrée, tous dérivés de données (pas de saisie). */
export interface CommercialBadgeFlags {
  express?: boolean;
  isNew?: boolean;
  bestseller?: boolean;
  eco?: boolean;
}

/**
 * Résout la liste ordonnée et plafonnée des badges à afficher.
 * Filtre les flags vrais, trie par priorité, coupe à MAX_VISIBLE_BADGES.
 */
export function resolveCommercialBadges(flags: CommercialBadgeFlags): CommercialBadgeKind[] {
  const active: Record<CommercialBadgeKind, boolean> = {
    express: !!flags.express,
    new: !!flags.isNew,
    bestseller: !!flags.bestseller,
    eco: !!flags.eco,
  };
  return BADGE_PRIORITY.filter((k) => active[k]).slice(0, MAX_VISIBLE_BADGES);
}

/**
 * Détermine si un produit est "récemment ajouté" (badge Nouveau).
 * `now` injectable pour la testabilité. Jamais de faux positif sur date
 * absente/invalide.
 */
export function isRecentlyAdded(
  createdAt: string | undefined | null,
  windowDays: number = NEW_PRODUCT_WINDOW_DAYS,
  now: Date = new Date(),
): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  const ageDays = (now.getTime() - created) / 86_400_000;
  return ageDays >= 0 && ageDays <= windowDays;
}
