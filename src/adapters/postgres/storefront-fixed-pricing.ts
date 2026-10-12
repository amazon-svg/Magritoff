import type { PoolClient } from 'pg';
import { createPricingEngine, type ResolvedPricingRule } from '../../modules/pricing/index.ts';

type FixedPriceContext = { cost: string | null; config: Record<string, unknown>; inScope: boolean;
  override: string | null; defaultMargin: string | null; rule: ResolvedPricingRule | null };
const engine = createPricingEngine();

/** Même calcul au catalogue et à la commande ; aucun coût n'est publié au client. */
export async function resolveFixedStorefrontPrice(client: PoolClient, shopId: string,
  productId: string, accountId: string | null = null) {
  const context = (await client.query<{ pricing: FixedPriceContext | null }>(
    'select magrit.storefront_fixed_price_context($1,$2,$3) pricing', [shopId, productId, accountId],
  )).rows[0]?.pricing;
  if (!context?.inScope || !context.cost) return null;
  const price = context.override ?? engine.price({ currency: 'EUR', posts: [{ post: 'total', amount: context.cost }] },
    { rule: context.rule, defaultMarginRate: context.defaultMargin }).customer_price;
  return { price, config: context.config };
}
