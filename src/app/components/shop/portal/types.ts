/**
 * Types partages du portail B2B.
 */

import type { ShopProduct } from '../../../contexts/ShopsContext';

export type PortalView =
  | 'home'
  | 'catalog'
  | 'product'
  | 'cart'
  | 'orders'
  | 'thankYou'
  // S7.3 — page gamme-configurateur /shop/:slug/g/:gamme (Epic 7)
  | 'gamme';

export interface CartLine {
  product: ShopProduct;
  qty: number;
}

export interface BudgetInfo {
  label: string;
  used: number;
  total: number;
}
