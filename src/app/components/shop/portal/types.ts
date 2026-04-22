/**
 * Types partages du portail B2B.
 */

import type { ShopProduct } from '../../../contexts/ShopsContext';

export type PortalView = 'home' | 'catalog' | 'product' | 'cart' | 'orders' | 'templates' | 'team';

export interface CartLine {
  product: ShopProduct;
  qty: number;
}

export interface BudgetInfo {
  label: string;
  used: number;
  total: number;
  approver?: string;
}
