/**
 * Contrats Zod du module Devis commerciaux (story E10.3).
 *
 * Miroir d execution du contrat decrit dans openapi/magrit-core.v1.yaml
 * (schemas Quote, QuoteLine, QuoteDetail, ...). Comme pour les autres modules
 * E10.x, le YAML fait foi ; ces schemas valident a l execution ce que les
 * types generes ne peuvent pas exprimer.
 *
 * ── Nom du module : `commercial-quotes`, pas `quotes` ──────────────────────
 * `src/modules/quotes/` existe deja et porte un domaine DIFFERENT et
 * INCOMPATIBLE (demande de devis boutique storefront, table legacy
 * `public.quotes` adressee par `/api/v1/tenants/{tenantId}/quotes`, modele de
 * marge maison). Ce module-ci ne le remplace pas et ne le duplique pas : il
 * couvre le devis "atelier" de la Gestion commerciale (E10), sur les tables
 * `commercial_quotes`/`commercial_quote_lines`. Voir l en-tete de la
 * migration `20260901000600_gescom_e10_3_commercial_quotes.sql` pour le
 * detail de l incompatibilite qui justifie deux systemes distincts.
 *
 * ── Prix : E10.21 pas encore livree ────────────────────────────────────────
 * `QuoteLine` porte les colonnes du format `PricedLine` (E10.21, interface
 * PricingEngine) des maintenant, mais seul `production_price` (cout de
 * production issu du chiffrage source, CA3) est produit par cette story.
 * `public_price`/`customer_price`/`applied_margin_rate`/`applied_rule_id`
 * sont TOUJOURS `null`, `breakdown` TOUJOURS vide : aucun calcul de prix de
 * vente n est fait hors PricingEngine (E10.8 gelee, E10.21 a venir).
 */
import { z } from 'zod';
import { moneySchema, rateSchema, timestampSchema, uuidSchema } from '../../_shared/api/index.ts';

export const quoteStatusSchema = z.enum(['draft', 'sent', 'accepted', 'rejected', 'converted']);

/** `YYYY-MM-DD`, meme regle que la colonne `date` en base. */
export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: 'Une date seule se serialise en YYYY-MM-DD.',
});

/** `DEV-AAAA-NNNNN`, CA5. Jamais calcule cote client : toujours restitue par l API. */
export const quoteNumberSchema = z.string().regex(/^DEV-[0-9]{4}-[0-9]{5}$/, {
  message: 'Un numero de devis suit la forme DEV-AAAA-NNNNN.',
});

export const quoteLineSchema = z
  .object({
    id: uuidSchema,
    quote_id: uuidSchema,
    project_item_id: uuidSchema,
    label: z.string().min(1).max(300),
    product_config: z.record(z.string(), z.unknown()),
    quantity: z.number().int().min(1),
    position: z.number().int().min(0),
    production_price: moneySchema,
    // Point d extension E10.21 : toujours null tant que le moteur de prix
    // n est pas livre (pas de donnee inventee).
    public_price: moneySchema.nullable(),
    customer_price: moneySchema.nullable(),
    applied_margin_rate: rateSchema.nullable(),
    applied_rule_id: uuidSchema.nullable(),
    breakdown: z.array(z.record(z.string(), z.unknown())),
    created_at: timestampSchema,
  })
  .strict();

export const quoteSchema = z
  .object({
    id: uuidSchema,
    tenant_id: uuidSchema,
    customer_id: uuidSchema,
    project_id: uuidSchema,
    number: quoteNumberSchema,
    status: quoteStatusSchema,
    valid_until: dateOnlySchema.nullable(),
    show_discounts: z.boolean(),
    created_by: uuidSchema.nullable(),
    created_at: timestampSchema,
    updated_at: timestampSchema,
  })
  .strict();

export const quoteDetailSchema = z
  .object({
    id: uuidSchema,
    tenant_id: uuidSchema,
    customer_id: uuidSchema,
    project_id: uuidSchema,
    number: quoteNumberSchema,
    status: quoteStatusSchema,
    valid_until: dateOnlySchema.nullable(),
    show_discounts: z.boolean(),
    created_by: uuidSchema.nullable(),
    created_at: timestampSchema,
    updated_at: timestampSchema,
    lines: z.array(quoteLineSchema),
  })
  .strict();

export const createQuoteFromProjectCommandSchema = z
  .object({
    project_id: uuidSchema,
    item_ids: z.array(uuidSchema).min(1),
  })
  .strict();

export const updateQuoteCommandSchema = z
  .object({
    valid_until: dateOnlySchema.nullable().optional(),
    show_discounts: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'La modification doit porter au moins un champ.',
  });

export const deleteQuoteResultSchema = z.object({ deleted: z.literal(true) }).strict();

export const quotesListSchema = z.array(quoteSchema);

export type QuoteStatus = z.infer<typeof quoteStatusSchema>;
export type QuoteDto = z.infer<typeof quoteSchema>;
export type QuoteLineDto = z.infer<typeof quoteLineSchema>;
export type QuoteDetailDto = z.infer<typeof quoteDetailSchema>;
export type CreateQuoteFromProjectCommand = z.infer<typeof createQuoteFromProjectCommandSchema>;
export type UpdateQuoteCommand = z.infer<typeof updateQuoteCommandSchema>;
export type DeleteQuoteResultDto = z.infer<typeof deleteQuoteResultSchema>;

// ---------------------------------------------------------------------------
// Alignement de compilation contrat <-> schemas (meme garde-fou que les
// autres modules E10.x, voir src/modules/_shared/api/contracts.ts pour la
// portee exacte).
// ---------------------------------------------------------------------------
import type {
  Quote as QuoteContract,
  QuoteLine as QuoteLineContract,
  QuoteStatus as QuoteStatusContract,
} from '../../../platform/api/generated/magrit-core.v1.ts';

type AssertAssignable<TSource, TTarget> = TSource extends TTarget ? true : never;

export const COMMERCIAL_QUOTES_CONTRACT_ALIGNMENT = Object.freeze({
  quoteStatus: true as AssertAssignable<QuoteStatus, QuoteStatusContract>,
  quoteId: true as AssertAssignable<QuoteDto['id'], QuoteContract['id']>,
  quoteCustomerId: true as AssertAssignable<QuoteDto['customer_id'], QuoteContract['customer_id']>,
  quoteNumber: true as AssertAssignable<QuoteDto['number'], QuoteContract['number']>,
  quoteLineProjectItemId: true as AssertAssignable<
    QuoteLineDto['project_item_id'],
    QuoteLineContract['project_item_id']
  >,
  quoteLineProductionPrice: true as AssertAssignable<
    QuoteLineDto['production_price'],
    QuoteLineContract['production_price']
  >,
});
