/**
 * Contrats Zod du module Pricing — referentiel des regles de prix (E10.6).
 *
 * Miroir d execution du contrat decrit dans openapi/magrit-core.v1.yaml
 * (schemas PriceRule, CreatePriceRuleCommand, UpdatePriceRuleCommand,
 * ProductRangeDefaultMargin, SetProductRangeDefaultMarginCommand). Comme pour
 * les autres modules E10.x, le YAML fait foi ; ces schemas valident a
 * l execution ce que les types generes ne peuvent pas exprimer.
 *
 * ── Frontiere avec l existant (a ne pas reproduire) ─────────────────────────
 * `public.client_price_rules` / `public.client_groups`
 * (20260808000100_gescom_price_rules.sql) decrivent une AUTRE notion : leur
 * cible client est `auth.users` (un compte), celle-ci est `customers`
 * (E10.4, personne morale ou physique) ; elles portent un mode `fixed_price`
 * et un champ `priority` saisi a la main, hors perimetre d E10.6 ; leur
 * resolution vit dans le navigateur (`applyCommercialRules()`), ce que le
 * sprint interdit desormais. Les deux referentiels coexistent durablement
 * (voir l en-tete de la migration `..._gescom_e10_6_price_rules.sql`).
 *
 * ── Hors perimetre de cette story ────────────────────────────────────────
 * `resolvePriceRule` (arbitrage des regles concurrentes par specificite puis
 * recence) est livre par E10.7 : aucun schema ni route ici pour cet
 * endpoint, bien qu il soit deja decrit au contrat.
 */
import { z } from 'zod';
import { rateSchema, timestampSchema, uuidSchema } from '../../_shared/api/index.ts';

export const priceRuleScopeSchema = z.enum(['global', 'range', 'customer', 'customer_range']);

export const priceRuleValueTypeSchema = z.enum(['margin_rate', 'discount_rate']);

export const priceRuleStatusFilterSchema = z.enum(['active', 'disabled']);

export const priceRuleSortSchema = z.enum(['-created_at', 'created_at', '-starts_on', 'starts_on']);

/** `YYYY-MM-DD`, meme regle que les colonnes `date` en base (`valid_from`/`valid_to`). */
export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: 'Une date seule se serialise en YYYY-MM-DD.',
});

/**
 * Taux non negatif (CA1). Le schema `Rate` du contrat autorise un signe
 * (partage avec la TVA, les remises signees ailleurs) ; `value_type` porte
 * deja le sens (ajout ou retranchement) d une regle de prix, jamais le signe
 * du nombre — un taux negatif est refuse en 422 `api.validation_failed`.
 * Plus strict que `Rate`, donc jamais en contradiction avec lui.
 */
export const nonNegativeRateSchema = z.string().regex(/^[0-9]{1,2}\.[0-9]{4}$/, {
  message: 'Un taux se serialise en chaine positive a quatre decimales, ex. "0.5000" pour 50 %.',
});

export const priceRuleSchema = z
  .object({
    id: uuidSchema,
    tenant_id: uuidSchema,
    name: z.string().min(1).max(200),
    scope: priceRuleScopeSchema,
    customer_id: uuidSchema.nullable(),
    product_range_id: uuidSchema.nullable(),
    value_type: priceRuleValueTypeSchema,
    value: rateSchema,
    starts_on: dateOnlySchema,
    ends_on: dateOnlySchema.nullable(),
    is_active: z.boolean(),
    created_by: uuidSchema.nullable(),
    created_at: timestampSchema,
    updated_at: timestampSchema,
  })
  .strict();

/**
 * Commande de creation. La forme du schema ne verifie que le FORMAT ; la
 * coherence scope <-> cibles, l ordre des dates et l existence du client/de
 * la gamme dans le tenant sont des regles METIER (`PriceRulesService`,
 * 422 `price_rule.invalid_scope` / `price_rule.invalid_period` /
 * `price_rule.customer_unknown` / `price_rule.product_range_unknown`).
 */
export const createPriceRuleCommandSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    scope: priceRuleScopeSchema,
    customer_id: uuidSchema.nullable().optional(),
    product_range_id: uuidSchema.nullable().optional(),
    value_type: priceRuleValueTypeSchema,
    value: nonNegativeRateSchema,
    starts_on: dateOnlySchema,
    ends_on: dateOnlySchema.nullable().optional(),
    is_active: z.boolean().optional().default(true),
  })
  .strict();

/**
 * Modification partielle. `scope`, `customer_id`, `product_range_id` et
 * `value_type` sont ABSENTS : immuables apres creation (contrat E10.6/E10.7),
 * un reciblage se fait en creant une nouvelle regle.
 */
export const updatePriceRuleCommandSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    value: nonNegativeRateSchema.optional(),
    starts_on: dateOnlySchema.optional(),
    ends_on: dateOnlySchema.nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'La modification doit porter au moins un champ.',
  });

export const productRangeDefaultMarginSchema = z
  .object({
    tenant_id: uuidSchema,
    product_range_id: uuidSchema,
    margin_rate: rateSchema.nullable(),
    updated_at: timestampSchema.nullable(),
    updated_by: uuidSchema.nullable(),
  })
  .strict();

export const setProductRangeDefaultMarginCommandSchema = z
  .object({ margin_rate: nonNegativeRateSchema })
  .strict();

export const priceRulesListSchema = z.array(priceRuleSchema);

export type PriceRuleScope = z.infer<typeof priceRuleScopeSchema>;
export type PriceRuleValueType = z.infer<typeof priceRuleValueTypeSchema>;
export type PriceRuleStatusFilter = z.infer<typeof priceRuleStatusFilterSchema>;
export type PriceRuleSort = z.infer<typeof priceRuleSortSchema>;
export type PriceRuleDto = z.infer<typeof priceRuleSchema>;
export type CreatePriceRuleCommand = z.infer<typeof createPriceRuleCommandSchema>;
export type UpdatePriceRuleCommand = z.infer<typeof updatePriceRuleCommandSchema>;
export type ProductRangeDefaultMarginDto = z.infer<typeof productRangeDefaultMarginSchema>;
export type SetProductRangeDefaultMarginCommand = z.infer<
  typeof setProductRangeDefaultMarginCommandSchema
>;

// ---------------------------------------------------------------------------
// Alignement de compilation contrat <-> schemas (meme garde-fou que les
// autres modules E10.x, voir src/modules/_shared/api/contracts.ts pour la
// portee exacte : il mord sur un champ disparu ou une enumeration, pas sur un
// `pattern`).
// ---------------------------------------------------------------------------
import type {
  PriceRule as PriceRuleContract,
  PriceRuleScope as PriceRuleScopeContract,
  PriceRuleValueType as PriceRuleValueTypeContract,
  ProductRangeDefaultMargin as ProductRangeDefaultMarginContract,
} from '../../../platform/api/generated/magrit-core.v1.ts';

type AssertAssignable<TSource, TTarget> = TSource extends TTarget ? true : never;

export const PRICING_CONTRACT_ALIGNMENT = Object.freeze({
  priceRuleScope: true as AssertAssignable<PriceRuleScope, PriceRuleScopeContract>,
  priceRuleValueType: true as AssertAssignable<PriceRuleValueType, PriceRuleValueTypeContract>,
  priceRuleId: true as AssertAssignable<PriceRuleDto['id'], PriceRuleContract['id']>,
  priceRuleIsActive: true as AssertAssignable<
    PriceRuleDto['is_active'],
    PriceRuleContract['is_active']
  >,
  defaultMarginProductRangeId: true as AssertAssignable<
    ProductRangeDefaultMarginDto['product_range_id'],
    ProductRangeDefaultMarginContract['product_range_id']
  >,
});
