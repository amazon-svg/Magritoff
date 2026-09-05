export { PriceRulesApiClient } from './api/client';
export {
  createPriceRuleCommandSchema,
  dateOnlySchema,
  nonNegativeRateSchema,
  priceRuleScopeSchema,
  priceRuleSchema,
  priceRuleSortSchema,
  priceRuleStatusFilterSchema,
  priceRuleValueTypeSchema,
  priceRulesListSchema,
  productRangeDefaultMarginSchema,
  setProductRangeDefaultMarginCommandSchema,
  updatePriceRuleCommandSchema,
  type CreatePriceRuleCommand,
  type PriceRuleDto,
  type PriceRuleScope,
  type PriceRuleSort,
  type PriceRuleStatusFilter,
  type PriceRuleValueType,
  type ProductRangeDefaultMarginDto,
  type SetProductRangeDefaultMarginCommand,
  type UpdatePriceRuleCommand,
} from './api/contracts';
export { PriceRulesService } from './application/price-rules-service';
export {
  PriceRuleCommandRejectedError,
  PriceRuleNotFoundError,
  ProductRangeNotFoundError,
} from './application/price-rules-repository';
export type {
  ListPriceRulesParams,
  ListPriceRulesResult,
  PriceRuleListCursor,
  PriceRuleListSort,
  PriceRuleSortDirection,
  PriceRuleSortField,
  PriceRulesRepository,
} from './application/price-rules-repository';
export { pricingModuleManifest } from './manifest';
export { pricingWorkspaceContribution } from './surface-contributions';

// ── E10.21 — interface PricingEngine et implementation provisoire ──────────
export { EmptyCostInputError } from './application/pricing-engine';
export type {
  CostInput,
  CostInputPost,
  CostPost,
  CostSource,
  PricedLine,
  PricedLineBreakdownItem,
  PricingContext,
  PricingEngine,
  ResolvedPricingRule,
} from './application/pricing-engine';
// `SingleCostPricingEngine` n'est volontairement PAS exporte ici (CA6, qa-review
// B1) : le seul point d'entree pour un appelant est `createPricingEngine()`,
// jamais l'implementation concrete. Un test qui en a besoin (par ex. pour
// verifier le fournisseur lui-meme) l'importe par chemin profond
// (`@/modules/pricing/application/single-cost-pricing-engine`), pas par ce
// barrel.
export { createPricingEngine } from './application/pricing-engine-provider';
