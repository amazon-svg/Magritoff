export type { AccountSection, BudgetInfo, CartLine, PortalView } from './types';
export { CheckoutPage } from './CheckoutPage';
export { PortalCart } from './PortalCart';
export { PortalOrders } from './PortalOrders';
export { PortalThankYou } from './PortalThankYou';
export { ResumeBanner, buildResumeChips } from './ResumeBanner';
export { computePortalCartTotalHt } from './cartPricing';
// BCP-11 (docs/api/CONVENTIONS.md §8.25 point 3.6) — point unique de
// construction d'une CartLine pour un produit configuré (règle du paquet).
export { copies, packs, ONE_PACK, packLine, toPackLine } from './cartLine';
export type { CopyCount, PackCount } from './cartLine';
