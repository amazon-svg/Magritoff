/**
 * Contrats Zod du module Devis commerciaux (stories E10.3, E10.9).
 *
 * Miroir d execution du contrat decrit dans openapi/magrit-core.v1.yaml
 * (schemas Quote, QuoteLine, QuoteDetail, ...). Comme pour les autres modules
 * E10.x, le YAML fait foi ; ces schemas valident a l execution ce que les
 * types generes ne peuvent pas exprimer.
 *
 * ── Nom du module : `commercial-quotes`, pas `quotes` ──────────────────────
 * `src/modules/quotes/` a existe un temps et portait un domaine DIFFERENT et
 * INCOMPATIBLE (demande de devis boutique storefront, table legacy
 * `public.quotes` adressee par `/api/v1/tenants/{tenantId}/quotes`, modele de
 * marge maison). Il a ete supprime purement et simplement au chantier
 * d unification des devis (post Sprint 5, decision Arnaud — voir
 * docs/api/CONVENTIONS.md §8.10) : ce module-ci, sur les tables
 * `commercial_quotes`/`commercial_quote_lines`, est desormais l UNIQUE
 * systeme de devis, quelle que soit son origine (commercial ou boutique).
 * Voir l en-tete de la migration `20260901000600_gescom_e10_3_commercial_quotes.sql`
 * pour le detail de l incompatibilite qui a justifie deux systemes distincts
 * a l epoque de la creation de ce module-ci.
 *
 * ── E10.9 — durcissement des prix, geste commercial et audit ────────────────
 * `public_price`/`customer_price`/`applied_margin_rate` ne sont plus
 * nullables (E10.21 est desormais livree) ; `breakdown` porte au moins un
 * element. `sale_price`/`sale_margin_rate`/`discount_rate`/`margin_variation`
 * portent le geste commercial (CA1-CA3). `origin`/`project_item_id` distingue
 * une ligne issue d un chiffrage d une ligne LIBRE (E10.9 elargie, decision
 * d Arnaud du 01/09 : ajout/suppression/requantification/reordonnancement
 * repris de l ancien editeur de devis).
 *
 * ── ETag de ligne : PAS sur QuoteDetail (decision explicite du contrat) ────
 * `getQuote` n emet aucun ETag de ligne (son ETag porte sur l en-tete du
 * devis) : c est `getQuoteLine` qui fait foi pour la concurrence optimiste
 * d une ligne donnee. `QuoteLine` ne porte donc aucun champ `etag` — en
 * ajouter un violerait `additionalProperties: false` du contrat.
 *
 * ── E10.10a — statut, envoi/renvoi, duplication, remise globale, TVA ───────
 * Ajoute a l entete : `source_quote_id` (filiation de copie), le cycle
 * d envoi (`sent_at`/`last_sent_at`/`sent_by`), la remise globale sous la
 * forme ou elle a ete saisie (`global_discount_rate` XOR `target_net_total`,
 * miroir exact du geste ligne d E10.9), la surcharge de TVA (`vat_rate`) et
 * les totaux calcules par le serveur (`totals`, TVA comprise). Garde d etat
 * sur `updateQuote` (409 `quote.update_requires_draft`) : solde la dette p4
 * de docs/api/CONVENTIONS.md §8.6.
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

/**
 * Montant monetaire POSITIF OU NUL (contrat `MoneyNonNegative`), plus strict
 * que `moneySchema` (signe), meme rapport que `nonNegativeRateSchema` a
 * `Rate` (E10.6). Sert la ou un montant negatif n a pas de sens metier : un
 * cout de production, un prix public, un prix client, un prix de vente.
 */
export const moneyNonNegativeSchema = z.string().regex(/^[0-9]{1,10}\.[0-9]{2}$/, {
  message: 'Un montant se serialise en chaine decimale positive a deux decimales, ex. "1234.50".',
});

export const costPostSchema = z.enum(['printing', 'finishing', 'packaging', 'shipping', 'total']);
export const costSourceSchema = z.enum(['clariprint', 'prix_marche']);

/** `PricedLineBreakdownItem` (E10.21). */
export const quoteLineBreakdownItemSchema = z
  .object({
    post: costPostSchema,
    cost: moneyNonNegativeSchema,
    margin_rate: rateSchema,
    price: moneyNonNegativeSchema,
    source: costSourceSchema,
  })
  .strict();

export const quoteLineOriginSchema = z.enum(['project_item', 'free']);

export const quoteLineWarningCodeSchema = z.enum([
  'negative_margin',
  'discount_threshold_exceeded',
  'production_cost_stale',
]);

export const quoteLineWarningSchema = z
  .object({
    code: quoteLineWarningCodeSchema,
    message: z.string().min(1).max(300),
    threshold: rateSchema.nullable(),
  })
  .strict();

export const quoteLineSchema = z
  .object({
    id: uuidSchema,
    quote_id: uuidSchema,
    origin: quoteLineOriginSchema,
    project_item_id: uuidSchema.nullable(),
    label: z.string().min(1).max(300),
    product_config: z.record(z.string(), z.unknown()),
    quantity: z.number().int().min(1),
    position: z.number().int().min(0),
    production_price: moneyNonNegativeSchema,
    public_price: moneyNonNegativeSchema,
    customer_price: moneyNonNegativeSchema,
    applied_margin_rate: rateSchema,
    applied_rule_id: uuidSchema.nullable(),
    sale_price: moneyNonNegativeSchema,
    sale_margin_rate: rateSchema.nullable(),
    discount_rate: rateSchema.nullable(),
    margin_variation: rateSchema.nullable(),
    breakdown: z.array(quoteLineBreakdownItemSchema).min(1),
    warnings: z.array(quoteLineWarningSchema),
    created_at: timestampSchema,
  })
  .strict();

// ---------------------------------------------------------------------------
// E10.10a — statut/envoi, remise globale, TVA, totaux.
// ---------------------------------------------------------------------------

/**
 * Remise globale exprimee en taux (`Quote.global_discount_rate`,
 * `UpdateQuoteCommand.global_discount_rate`). Reprend `Rate` (signe, aucune
 * borne basse : une valeur negative est une majoration legitime, meme regle
 * qu au niveau ligne, E10.9 CA2) et ajoute la SEULE borne du contrat : au-dela
 * de `"1.0000"` (100 %), le devis paierait le client.
 */
export const globalDiscountRateSchema = rateSchema.refine((value) => Number(value) <= 1, {
  message: 'Le taux de remise globale ne depasse pas "1.0000" (100 %).',
});

export const taxRegimeSchema = z.enum([
  'metropole_fr',
  'dom_tom',
  'franchise_tva',
  'export_eu',
  'export_world',
]);

export const quoteTotalsSchema = z
  .object({
    lines_subtotal: moneyNonNegativeSchema,
    global_discount: moneySchema,
    effective_discount_rate: rateSchema.nullable(),
    net_total: moneyNonNegativeSchema,
    vat_rate: rateSchema,
    vat_regime: taxRegimeSchema.nullable(),
    vat_amount: moneyNonNegativeSchema,
    total_incl_tax: moneyNonNegativeSchema,
  })
  .strict();

export const quoteWarningCodeSchema = z.enum(['validity_expired']);

export const quoteWarningSchema = z
  .object({
    code: quoteWarningCodeSchema,
    message: z.string().min(1).max(300),
  })
  .strict();

export const quoteSchema = z
  .object({
    id: uuidSchema,
    tenant_id: uuidSchema,
    customer_id: uuidSchema,
    project_id: uuidSchema,
    source_quote_id: uuidSchema.nullable(),
    number: quoteNumberSchema,
    status: quoteStatusSchema,
    valid_until: dateOnlySchema.nullable(),
    show_discounts: z.boolean(),
    global_discount_rate: globalDiscountRateSchema.nullable(),
    target_net_total: moneyNonNegativeSchema.nullable(),
    vat_rate: rateSchema.nullable(),
    totals: quoteTotalsSchema,
    warnings: z.array(quoteWarningSchema),
    sent_at: timestampSchema.nullable(),
    last_sent_at: timestampSchema.nullable(),
    sent_by: uuidSchema.nullable(),
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
    source_quote_id: uuidSchema.nullable(),
    number: quoteNumberSchema,
    status: quoteStatusSchema,
    valid_until: dateOnlySchema.nullable(),
    show_discounts: z.boolean(),
    global_discount_rate: globalDiscountRateSchema.nullable(),
    target_net_total: moneyNonNegativeSchema.nullable(),
    vat_rate: rateSchema.nullable(),
    totals: quoteTotalsSchema,
    warnings: z.array(quoteWarningSchema),
    sent_at: timestampSchema.nullable(),
    last_sent_at: timestampSchema.nullable(),
    sent_by: uuidSchema.nullable(),
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
    global_discount_rate: globalDiscountRateSchema.nullable().optional(),
    target_net_total: moneyNonNegativeSchema.nullable().optional(),
    vat_rate: rateSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'La modification doit porter au moins un champ.',
  })
  .refine(
    (value) =>
      !(
        Object.prototype.hasOwnProperty.call(value, 'global_discount_rate') &&
        Object.prototype.hasOwnProperty.call(value, 'target_net_total')
      ),
    {
      message: 'global_discount_rate et target_net_total sont mutuellement exclusifs.',
      path: ['target_net_total'],
    },
  );

export const deleteQuoteResultSchema = z.object({ deleted: z.literal(true) }).strict();

export const quotesListSchema = z.array(quoteSchema);

/** Corps de `sendQuote` (E10.10a). Corps vide legal : envoie le devis tel quel. */
export const sendQuoteCommandSchema = z
  .object({
    show_discounts: z.boolean().optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// E10.10a — journal d audit de l ENTETE d un devis, distinct du journal des
// lignes (E10.9). Meme mecanisme (append-only, une entree par champ change),
// type de reponse SEPARE (contrat, `listQuoteHeaderAuditEntries`).
// ---------------------------------------------------------------------------

export const quoteAuditActionSchema = z.enum(['updated', 'sent', 'resent', 'duplicated']);

export const quoteAuditFieldSchema = z.enum([
  'global_discount_rate',
  'target_net_total',
  'vat_rate',
  'show_discounts',
  'valid_until',
]);

export const quoteAuditEntrySchema = z
  .object({
    id: uuidSchema,
    quote_id: uuidSchema,
    change_set_id: uuidSchema,
    action: quoteAuditActionSchema,
    field: quoteAuditFieldSchema.nullable(),
    previous_value: z.string().max(64).nullable(),
    new_value: z.string().max(64).nullable(),
    quote_snapshot: z.record(z.string(), z.unknown()).nullable(),
    actor_id: uuidSchema.nullable(),
    actor_label: z.string().min(1).max(320).nullable(),
    occurred_at: timestampSchema,
  })
  .strict();

export const quoteAuditEntriesListSchema = z.array(quoteAuditEntrySchema);

// ---------------------------------------------------------------------------
// E10.9 — ajout/modification/retrait/reordonnancement de lignes, audit.
// ---------------------------------------------------------------------------

/**
 * Ajout d une ligne LIEE a un chiffrage du projet source. `label`,
 * `product_config` et `production_price` sont repris de l element, jamais
 * transmis par l appelant.
 */
export const createQuoteLineFromProjectItemCommandSchema = z
  .object({
    project_item_id: uuidSchema,
    quantity: z.number().int().min(1).optional(),
  })
  .strict();

/**
 * Ajout d une ligne LIBRE : intitule, quantite et cout de production saisis a
 * la main, sans element de projet (capacite de l ancien editeur de devis).
 */
export const createFreeQuoteLineCommandSchema = z
  .object({
    label: z.string().min(1).max(300),
    quantity: z.number().int().min(1),
    production_price: moneyNonNegativeSchema,
  })
  .strict();

/**
 * Corps de `addQuoteLine` : l une OU l autre des deux formes (contrat,
 * `oneOf`). Les deux schemas etant `.strict()`, un corps qui melangerait les
 * deux formes (ou n en respecterait aucune) echoue sur les DEUX branches de
 * l union — traduit en 422 `api.validation_failed` par la route, comme tout
 * echec de `inputSchema`.
 */
export const createQuoteLineCommandSchema = z.union([
  createQuoteLineFromProjectItemCommandSchema,
  createFreeQuoteLineCommandSchema,
]);

/**
 * Modification d une ligne (E10.9 CA1, elargi a la quantite). `sale_price`
 * et `margin_rate` sont mutuellement exclusifs (le `refine` ci-dessous
 * traduit le `not: required: [sale_price, margin_rate]` du contrat).
 */
export const updateQuoteLineCommandSchema = z
  .object({
    sale_price: moneyNonNegativeSchema.optional(),
    margin_rate: rateSchema.optional(),
    quantity: z.number().int().min(1).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'La modification doit porter au moins un champ.',
  })
  .refine((value) => !(value.sale_price !== undefined && value.margin_rate !== undefined), {
    message: 'sale_price et margin_rate sont mutuellement exclusifs.',
    path: ['margin_rate'],
  });

export const reorderQuoteLinesCommandSchema = z
  .object({
    line_ids: z
      .array(uuidSchema)
      .min(1)
      .max(500)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'line_ids ne doit porter aucun doublon.',
      }),
  })
  .strict();

export const quoteLineAuditActionSchema = z.enum(['added', 'updated', 'removed', 'reordered']);

export const quoteLineAuditFieldSchema = z.enum([
  'sale_price',
  'discount_rate',
  'margin_variation',
  'quantity',
  'position',
]);

export const quoteLineAuditEntrySchema = z
  .object({
    id: uuidSchema,
    quote_id: uuidSchema,
    quote_line_id: uuidSchema,
    change_set_id: uuidSchema,
    action: quoteLineAuditActionSchema,
    field: quoteLineAuditFieldSchema.nullable(),
    previous_value: z.string().max(64).nullable(),
    new_value: z.string().max(64).nullable(),
    line_snapshot: z.record(z.string(), z.unknown()).nullable(),
    actor_id: uuidSchema.nullable(),
    actor_label: z.string().min(1).max(320).nullable(),
    occurred_at: timestampSchema,
  })
  .strict();

export const quoteLineAuditEntriesListSchema = z.array(quoteLineAuditEntrySchema);

export type QuoteStatus = z.infer<typeof quoteStatusSchema>;
export type TaxRegimeDto = z.infer<typeof taxRegimeSchema>;
export type QuoteTotalsDto = z.infer<typeof quoteTotalsSchema>;
export type QuoteWarningCode = z.infer<typeof quoteWarningCodeSchema>;
export type QuoteWarningDto = z.infer<typeof quoteWarningSchema>;
export type QuoteDto = z.infer<typeof quoteSchema>;
export type QuoteLineOrigin = z.infer<typeof quoteLineOriginSchema>;
export type QuoteLineWarningCode = z.infer<typeof quoteLineWarningCodeSchema>;
export type QuoteLineWarningDto = z.infer<typeof quoteLineWarningSchema>;
export type QuoteLineBreakdownItemDto = z.infer<typeof quoteLineBreakdownItemSchema>;
export type QuoteLineDto = z.infer<typeof quoteLineSchema>;
export type QuoteDetailDto = z.infer<typeof quoteDetailSchema>;
export type CreateQuoteFromProjectCommand = z.infer<typeof createQuoteFromProjectCommandSchema>;
export type UpdateQuoteCommand = z.infer<typeof updateQuoteCommandSchema>;
export type DeleteQuoteResultDto = z.infer<typeof deleteQuoteResultSchema>;
export type SendQuoteCommand = z.infer<typeof sendQuoteCommandSchema>;
export type CreateQuoteLineFromProjectItemCommand = z.infer<
  typeof createQuoteLineFromProjectItemCommandSchema
>;
export type CreateFreeQuoteLineCommand = z.infer<typeof createFreeQuoteLineCommandSchema>;
export type CreateQuoteLineCommand = z.infer<typeof createQuoteLineCommandSchema>;
export type UpdateQuoteLineCommand = z.infer<typeof updateQuoteLineCommandSchema>;
export type ReorderQuoteLinesCommand = z.infer<typeof reorderQuoteLinesCommandSchema>;
export type QuoteLineAuditAction = z.infer<typeof quoteLineAuditActionSchema>;
export type QuoteLineAuditField = z.infer<typeof quoteLineAuditFieldSchema>;
export type QuoteLineAuditEntryDto = z.infer<typeof quoteLineAuditEntrySchema>;
export type QuoteAuditAction = z.infer<typeof quoteAuditActionSchema>;
export type QuoteAuditField = z.infer<typeof quoteAuditFieldSchema>;
export type QuoteAuditEntryDto = z.infer<typeof quoteAuditEntrySchema>;

// ---------------------------------------------------------------------------
// Alignement de compilation contrat <-> schemas (meme garde-fou que les
// autres modules E10.x, voir src/modules/_shared/api/contracts.ts pour la
// portee exacte).
// ---------------------------------------------------------------------------
import type {
  Quote as QuoteContract,
  QuoteAuditEntry as QuoteAuditEntryContract,
  QuoteLine as QuoteLineContract,
  QuoteLineAuditEntry as QuoteLineAuditEntryContract,
  QuoteLineOrigin as QuoteLineOriginContract,
  QuoteStatus as QuoteStatusContract,
  QuoteTotals as QuoteTotalsContract,
  TaxRegime as TaxRegimeContract,
} from '../../../platform/api/generated/magrit-core.v1.ts';

type AssertAssignable<TSource, TTarget> = TSource extends TTarget ? true : never;

export const COMMERCIAL_QUOTES_CONTRACT_ALIGNMENT = Object.freeze({
  quoteStatus: true as AssertAssignable<QuoteStatus, QuoteStatusContract>,
  quoteId: true as AssertAssignable<QuoteDto['id'], QuoteContract['id']>,
  quoteCustomerId: true as AssertAssignable<QuoteDto['customer_id'], QuoteContract['customer_id']>,
  quoteNumber: true as AssertAssignable<QuoteDto['number'], QuoteContract['number']>,
  quoteSourceQuoteId: true as AssertAssignable<QuoteDto['source_quote_id'], QuoteContract['source_quote_id']>,
  quoteGlobalDiscountRate: true as AssertAssignable<
    QuoteDto['global_discount_rate'],
    QuoteContract['global_discount_rate']
  >,
  quoteTargetNetTotal: true as AssertAssignable<
    QuoteDto['target_net_total'],
    QuoteContract['target_net_total']
  >,
  quoteTotals: true as AssertAssignable<QuoteTotalsDto, QuoteTotalsContract>,
  quoteSentAt: true as AssertAssignable<QuoteDto['sent_at'], QuoteContract['sent_at']>,
  taxRegime: true as AssertAssignable<TaxRegimeDto, TaxRegimeContract>,
  quoteLineOrigin: true as AssertAssignable<QuoteLineOrigin, QuoteLineOriginContract>,
  quoteLineProjectItemId: true as AssertAssignable<
    QuoteLineDto['project_item_id'],
    QuoteLineContract['project_item_id']
  >,
  quoteLineProductionPrice: true as AssertAssignable<
    QuoteLineDto['production_price'],
    QuoteLineContract['production_price']
  >,
  quoteLineSalePrice: true as AssertAssignable<QuoteLineDto['sale_price'], QuoteLineContract['sale_price']>,
  quoteLineAuditEntryId: true as AssertAssignable<
    QuoteLineAuditEntryDto['id'],
    QuoteLineAuditEntryContract['id']
  >,
  quoteAuditEntryId: true as AssertAssignable<QuoteAuditEntryDto['id'], QuoteAuditEntryContract['id']>,
});
