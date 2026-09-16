export type { ConfigOptions } from './ProductOverlay.helpers';
export { GammePage } from './gamme/GammePage';
export { PortalCatalog } from './PortalCatalog';
export { PortalHome } from './PortalHome';
export { PortalProduct } from './PortalProduct';
// BCP-10 (docs/api/CONVENTIONS.md §8.25 point 3.5 (b)) — `PublicShop` (module
// `shops`) devient l'hôte UNIQUE de la surcouche : l'entrée publique du
// module `catalog` doit donc l'exposer (règle MUX0-MUX6, imports inter-
// modules uniquement via une entrée publique).
export { ProductOverlay } from './ProductOverlay';
export { ShopHeaderSearch } from './ShopHeaderSearch';
export { ShopMegaMenu } from './ShopMegaMenu';
export { buildClariprintPayload, extractInitialOptions, formatEuro } from './ProductOverlay.helpers';
export { filterProductsByExpandedGammes, groupProductsByGamme, loadExpandedGammes, saveExpandedGammes } from './ShopGammesSidebar.helpers';
// BCP-10 (docs/api/CONVENTIONS.md §8.25 point 3.5) — fonction pure
// « résolution → texte + badge », créée pour la fiche produit et consommée
// par BCP-4 (carte catalogue, plancher de gamme, suggestions de Magrit).
export type { ResolvedPriceDisplay } from './productPriceDisplay';
export {
  MARKET_PRICE_BADGE_LABEL,
  MARKET_PRICE_BADGE_TOOLTIP,
  UNPRICED_PRICE_LABEL,
  resolveProductPriceDisplay,
} from './productPriceDisplay';
