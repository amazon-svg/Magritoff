/**
 * Implementation provisoire de `PricingEngine` (E10.21, CA4) : traite le
 * cout comme un poste UNIQUE, quelle que soit la decomposition eventuellement
 * fournie en entree (CA7 — une decomposition est acceptee sans erreur, mais
 * agregee en silence tant qu E10.8 (gelee) n a pas livre le vrai calcul par
 * poste).
 *
 * ── Algorithme (choix documente, la story ne le detaille pas) ───────────────
 * 1. `production_price` = somme des postes de `cost.posts` (exact au centime,
 *    chaque poste est deja une valeur Money a 2 decimales).
 * 2. Marge appliquee pour obtenir `public_price` :
 *    - si `ctx.rule` est de type `margin_rate`, sa valeur REMPLACE la marge
 *      publique standard (une regle explicite l emporte toujours sur le
 *      defaut de gamme) ;
 *    - sinon, `ctx.defaultMarginRate` (marge publique standard de la gamme,
 *      E10.6) est utilisee, ou `0.0000` si le tenant n en a jamais defini.
 *    `public_price = production_price * (1 + marge)`, arrondi au centime
 *    (CA4).
 * 3. `customer_price` :
 *    - si `ctx.rule` est de type `discount_rate`, la remise s applique EN
 *      PLUS du `public_price` (jamais a la place d une marge — une remise
 *      retranche un pourcentage du prix public, elle ne redefinit pas
 *      comment le prix public a ete obtenu) : `customer_price = public_price
 *      * (1 - remise)`, arrondi au centime ;
 *    - sinon, `customer_price === public_price` (aucune remise a appliquer).
 * 4. `applied_rule_id` porte l identifiant de la regle qui a effectivement
 *    change le prix final pour ce client (celle de type `margin_rate` si
 *    elle a remplace le defaut, celle de type `discount_rate` si elle a
 *    retranche une remise), `null` si aucune regle active ne couvre le
 *    contexte — coherent avec `PriceRuleResolveResultDto.rule: null` (E10.7).
 * 5. `applied_margin_rate` porte le taux effectivement utilise a l etape 2
 *    (production -> public), INDEPENDAMMENT d une remise client eventuelle a
 *    l etape 3 — les deux notions ne se melangent jamais dans un seul champ.
 * 6. `breakdown` contient toujours un seul element (`post: 'total'`, red flag
 *    E10.21 : jamais vide), dont `price` est `customer_price` (le montant
 *    final effectivement du pour ce poste).
 */
import {
  applyRateToCents,
  formatCentsToMoney,
  parseMoneyToCents,
  parseRateToBasisPoints,
} from './pricing-money.ts';
import {
  EmptyCostInputError,
  type CostInput,
  type PricedLine,
  type PricedLineBreakdownItem,
  type PricingContext,
  type PricingEngine,
} from './pricing-engine.ts';

/** Marge/remise nulle, utilisee quand ni la regle ni la marge par defaut n en fournissent une (CA2/CA4). */
const ZERO_RATE = '0.0000';

export class SingleCostPricingEngine implements PricingEngine {
  price(cost: CostInput, ctx: PricingContext): PricedLine {
    if (cost.posts.length === 0) throw new EmptyCostInputError();

    const totalCostCents = cost.posts.reduce(
      (sum, post) => sum + parseMoneyToCents(post.amount),
      0n,
    );
    const productionPrice = formatCentsToMoney(totalCostCents);

    const marginRule = ctx.rule?.value_type === 'margin_rate' ? ctx.rule : null;
    const discountRule = ctx.rule?.value_type === 'discount_rate' ? ctx.rule : null;

    const appliedMarginRate = marginRule?.value ?? ctx.defaultMarginRate ?? ZERO_RATE;
    const publicPriceCents = applyRateToCents(
      totalCostCents,
      parseRateToBasisPoints(appliedMarginRate),
      1,
    );
    const publicPrice = formatCentsToMoney(publicPriceCents);

    let customerPriceCents = publicPriceCents;
    let appliedRuleId: string | null = marginRule?.id ?? null;
    if (discountRule) {
      customerPriceCents = applyRateToCents(
        publicPriceCents,
        parseRateToBasisPoints(discountRule.value),
        -1,
      );
      appliedRuleId = discountRule.id;
    }
    const customerPrice = formatCentsToMoney(customerPriceCents);

    const breakdown: readonly PricedLineBreakdownItem[] = [
      {
        post: 'total',
        cost: productionPrice,
        margin_rate: appliedMarginRate,
        price: customerPrice,
      },
    ];

    return {
      production_price: productionPrice,
      public_price: publicPrice,
      customer_price: customerPrice,
      applied_margin_rate: appliedMarginRate,
      applied_rule_id: appliedRuleId,
      breakdown,
    };
  }
}
