/**
 * Types partages du portail B2B.
 */

import type { ShopProduct } from '@/modules/shops';

export type PortalView =
  | 'home'
  | 'catalog'
  | 'product'
  | 'cart'
  | 'orders'
  | 'thankYou'
  // S7.3 — page gamme-configurateur /shop/:slug/g/:gamme (Epic 7)
  | 'gamme'
  // S7.10 — hub « Mon compte » /shop/:slug/account/* (Epic 7)
  | 'account'
  // S7.12 — checkout ≤ 2 écrans /shop/:slug/checkout (Epic 7, ADR §4.20)
  | 'checkout';

/**
 * S7.10 — sections du hub Mon compte.
 *
 * `quotes` retiree au chantier d unification des devis (post Sprint 5 :
 * docs/api/CONVENTIONS.md §8.10) : l onglet « Mes devis » n affichait qu un
 * texte statique, sans backend reel — son point d entree boutique reste a
 * concevoir sur `commercial_quotes` par une story future.
 */
export type AccountSection = 'orders' | 'profile';

export interface CartLine {
  product: ShopProduct;
  qty: number;
}

export interface BudgetInfo {
  label: string;
  used: number;
  total: number;
}
