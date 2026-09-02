/**
 * Fournisseur UNIQUE de `PricingEngine` (CA6) : le seul endroit du code ou
 * l implementation concrete (`SingleCostPricingEngine` aujourd hui) est
 * nommee. Tout appelant (un futur `CommercialQuotesService` pour E10.9, par
 * exemple) recoit une instance via `createPricingEngine()` et ne manipule
 * que le type `PricingEngine` — remplacer l implementation (E10.8 degelee)
 * se fait en changeant UNIQUEMENT ce fichier, jamais un appelant.
 */
import { SingleCostPricingEngine } from './single-cost-pricing-engine.ts';
import type { PricingEngine } from './pricing-engine.ts';

export function createPricingEngine(): PricingEngine {
  return new SingleCostPricingEngine();
}
