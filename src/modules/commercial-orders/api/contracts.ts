/**
 * Contrats Zod du module Commandes de gestion commerciale (story E10.12,
 * « bouton Valider »).
 *
 * Miroir d execution du contrat decrit dans openapi/magrit-core.v1.yaml
 * (schemas `CommercialOrder`, `CommercialOrderDetail`, `CommercialOrderLine`,
 * `CommercialOrderTotals`, `ConvertedFromStatus`, `CommercialOrderStatus`,
 * `ConvertQuoteCommand`, `QuoteConversionPayload`).
 *
 * ── Pourquoi un module NEUF, distinct de `commercial-quotes` ────────────────
 * `POST /quotes/{quoteId}/conversions` (`convertQuote`) est une ressource
 * d ACTE portee par le chemin `/quotes/...`, mais elle cree et rend une
 * ressource `CommercialOrder`, PAS un `Quote` — exactement le meme
 * raisonnement qui a distingue `commercial-quotes` de la table legacy
 * `quotes` (E10.3). `GET /commercial-orders` et `GET /commercial-orders/{id}`
 * confirment cette frontiere : ce sont des operations SUR LA COMMANDE, pas
 * sur le devis. Regrouper les trois ici, dans un module dedie aux commandes,
 * evite de faire porter au module Devis une ressource qui n est pas la sienne.
 *
 * ── Aucun calcul de prix (E10.8 gelee) ──────────────────────────────────────
 * Ce module ne CALCULE jamais un prix : `CommercialOrderTotals`/
 * `CommercialOrderLine` sont des valeurs COPIEES, figees a la conversion par
 * la fonction Postgres `api_convert_commercial_quote` (migration
 * 20260908010000). Aucun appel a `PricingEngine` (E10.21) n a lieu ici — voir
 * decision #4, docs/api/CONVENTIONS.md §8.14.
 */
import { z } from 'zod';
import { moneySchema, rateSchema, timestampSchema, uuidSchema } from '../../_shared/api/index.ts';
import {
  moneyNonNegativeSchema,
  quoteLineBreakdownItemSchema,
  quoteLineOriginSchema,
  taxRegimeSchema,
} from '../../commercial-quotes/api/contracts.ts';
import { nonNegativeRateSchema } from '../../pricing/api/contracts.ts';

/**
 * `CommercialOrderStatus` : UNE SEULE valeur aujourd hui (`validated`),
 * reprise TELLE QUELLE du vocabulaire boutique existant (`tenant_order_
 * status`) plutot qu un synonyme invente — c est deja le nom de « commande
 * engagee commercialement » dans ce produit. Liste ADDITIVE : E10.13 y
 * ajoutera ses etats (mise en production, expedition, annulation, ...).
 */
export const commercialOrderStatusSchema = z.enum(['validated']);

/**
 * Tri de `listCommercialOrders` (E10.13 CA6). `production_step` trie sur la
 * POSITION de l etape courante (`ProductionStep.position`), jamais son
 * libelle ; les commandes SANS etape courante sont toujours rendues en
 * dernier, dans les deux sens (contrat `CommercialOrderSort`).
 */
export const commercialOrderSortSchema = z.enum([
  '-created_at',
  'created_at',
  'production_step',
  '-production_step',
]);

/**
 * `ConvertedFromStatus` : sous-ensemble STRICT de `QuoteStatus`, reduit aux
 * deux seuls statuts convertibles (arbitrage Arnaud, 2026-09-08, reserve (a)
 * de docs/api/CONVENTIONS.md §8.14). `accepted` = le client s est FORMELLEMENT
 * prononce depuis son portail ; `sent` = l atelier a valide sur une reponse
 * recue hors systeme (telephone, courriel, bon de commande papier).
 */
export const convertedFromStatusSchema = z.enum(['sent', 'accepted']);

/** `CDE-AAAA-NNNNN`, sequence PROPRE, distincte de celle des devis (`DEV-AAAA-NNNNN`). */
export const commercialOrderNumberSchema = z.string().regex(/^CDE-[0-9]{4}-[0-9]{5}$/, {
  message: 'Un numero de commande suit la forme CDE-AAAA-NNNNN.',
});

/**
 * Corps de `convertQuote`. AUCUN champ aujourd hui : la conversion ne prend
 * aucun parametre, tout ce qui compose la commande etant deja fige sur le
 * devis. Schema NOMME et objet FERME malgre tout (meme parti qu en E10.10b-2) :
 * le jour ou un champ s impose (la reference de commande du client), il
 * s ajoute sans toucher au chemin, au verbe, ni a l ordre des gardes.
 */
export const convertQuoteCommandSchema = z.object({}).strict();

/**
 * `CommercialOrderTotals` : memes huit grandeurs que `QuoteTotals`, meme
 * signification, meme ordre de calcul — mais FIGEES a la conversion, jamais
 * recalculees. Contrairement a `QuoteTotals`, ces champs restent TOUJOURS
 * renseignes (pas de gating par `show_discounts` : une commande de gestion
 * commerciale est un document ATELIER, pas une vue CLIENT).
 */
export const commercialOrderTotalsSchema = z
  .object({
    lines_subtotal: moneyNonNegativeSchema,
    global_discount: moneySchema,
    effective_discount_rate: rateSchema.nullable(),
    net_total: moneyNonNegativeSchema,
    vat_rate: nonNegativeRateSchema,
    vat_regime: taxRegimeSchema.nullable(),
    vat_amount: moneyNonNegativeSchema,
    total_incl_tax: moneyNonNegativeSchema,
  })
  .strict();

/**
 * `CommercialOrderLine` : COPIE FIGEE d une ligne de devis. Le bloc
 * `PricedLine` complet est copie, pas seulement le prix vendu (contrat :
 * « une commande se facture et s analyse en marge sans avoir le devis en
 * main »). `quote_id` n y figure PAS (ce n est plus une ligne de devis) ;
 * `warnings` non plus (une alerte figee cesse d etre une alerte).
 */
export const commercialOrderLineSchema = z
  .object({
    id: uuidSchema,
    order_id: uuidSchema,
    source_quote_line_id: uuidSchema,
    origin: quoteLineOriginSchema,
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
    created_at: timestampSchema,
  })
  .strict();

/** `CommercialOrder` : forme ABREGEE, sans ses lignes — porte ses TOTAUX des la liste (meme motif que `Quote`). */
export const commercialOrderSchema = z
  .object({
    id: uuidSchema,
    tenant_id: uuidSchema,
    customer_id: uuidSchema,
    quote_id: uuidSchema,
    number: commercialOrderNumberSchema,
    status: commercialOrderStatusSchema,
    source_quote_status: convertedFromStatusSchema,
    // E10.13 — etape de production COURANTE, ou null (pointeur, jamais une
    // progression). Posee UNE SEULE FOIS a la conversion (etape active de
    // position la plus basse du tenant) ; aucune operation de ce contrat ne
    // la change ensuite (E10.14).
    current_production_step_id: uuidSchema.nullable(),
    totals: commercialOrderTotalsSchema,
    created_by: uuidSchema.nullable(),
    created_at: timestampSchema,
    updated_at: timestampSchema,
  })
  .strict();

/** `CommercialOrderDetail` : forme complete, APLATIE (meme raison que `QuoteDetail` : `additionalProperties:false` + `allOf` rejetterait `lines`). */
export const commercialOrderDetailSchema = z
  .object({
    id: uuidSchema,
    tenant_id: uuidSchema,
    customer_id: uuidSchema,
    quote_id: uuidSchema,
    number: commercialOrderNumberSchema,
    status: commercialOrderStatusSchema,
    source_quote_status: convertedFromStatusSchema,
    current_production_step_id: uuidSchema.nullable(),
    totals: commercialOrderTotalsSchema,
    created_by: uuidSchema.nullable(),
    created_at: timestampSchema,
    updated_at: timestampSchema,
    lines: z.array(commercialOrderLineSchema).min(1),
  })
  .strict();

export const commercialOrdersListSchema = z.array(commercialOrderSchema);

/** Charge utile de l evenement sortant `quote.converted` (`event_version: 1`). Volontairement minimale : aucun montant n y transite. */
export const quoteConversionPayloadSchema = z
  .object({
    quote_id: uuidSchema,
    customer_id: uuidSchema,
    number: z.string().regex(/^DEV-[0-9]{4}-[0-9]{5}$/),
    order_id: uuidSchema,
    order_number: commercialOrderNumberSchema,
    source_quote_status: convertedFromStatusSchema,
  })
  .strict();

export type CommercialOrderStatus = z.infer<typeof commercialOrderStatusSchema>;
export type CommercialOrderSort = z.infer<typeof commercialOrderSortSchema>;
export type ConvertedFromStatus = z.infer<typeof convertedFromStatusSchema>;
export type ConvertQuoteCommand = z.infer<typeof convertQuoteCommandSchema>;
export type CommercialOrderTotalsDto = z.infer<typeof commercialOrderTotalsSchema>;
export type CommercialOrderLineDto = z.infer<typeof commercialOrderLineSchema>;
export type CommercialOrderDto = z.infer<typeof commercialOrderSchema>;
export type CommercialOrderDetailDto = z.infer<typeof commercialOrderDetailSchema>;
export type QuoteConversionPayloadDto = z.infer<typeof quoteConversionPayloadSchema>;

// ---------------------------------------------------------------------------
// Alignement de compilation contrat <-> schemas (meme garde-fou que les
// autres modules E10.x, voir src/modules/_shared/api/contracts.ts).
// ---------------------------------------------------------------------------
import type {
  CommercialOrder as CommercialOrderContract,
  CommercialOrderDetail as CommercialOrderDetailContract,
  CommercialOrderSort as CommercialOrderSortContract,
  CommercialOrderStatus as CommercialOrderStatusContract,
  CommercialOrderTotals as CommercialOrderTotalsContract,
  ConvertedFromStatus as ConvertedFromStatusContract,
  QuoteConversionPayload as QuoteConversionPayloadContract,
} from '../../../platform/api/generated/magrit-core.v1.ts';

type AssertAssignable<TSource, TTarget> = TSource extends TTarget ? true : never;

export const COMMERCIAL_ORDERS_CONTRACT_ALIGNMENT = Object.freeze({
  orderStatus: true as AssertAssignable<CommercialOrderStatus, CommercialOrderStatusContract>,
  orderSort: true as AssertAssignable<CommercialOrderSort, CommercialOrderSortContract>,
  convertedFromStatus: true as AssertAssignable<ConvertedFromStatus, ConvertedFromStatusContract>,
  orderId: true as AssertAssignable<CommercialOrderDto['id'], CommercialOrderContract['id']>,
  orderQuoteId: true as AssertAssignable<CommercialOrderDto['quote_id'], CommercialOrderContract['quote_id']>,
  orderNumber: true as AssertAssignable<CommercialOrderDto['number'], CommercialOrderContract['number']>,
  orderTotals: true as AssertAssignable<CommercialOrderTotalsDto, CommercialOrderTotalsContract>,
  orderDetailLines: true as AssertAssignable<
    CommercialOrderDetailDto['lines'],
    CommercialOrderDetailContract['lines']
  >,
  conversionPayload: true as AssertAssignable<QuoteConversionPayloadDto, QuoteConversionPayloadContract>,
  // E10.13 — current_production_step_id, ajoute par ce lot sur CommercialOrder/CommercialOrderDetail.
  orderCurrentProductionStepId: true as AssertAssignable<
    CommercialOrderDto['current_production_step_id'],
    CommercialOrderContract['current_production_step_id']
  >,
  orderDetailCurrentProductionStepId: true as AssertAssignable<
    CommercialOrderDetailDto['current_production_step_id'],
    CommercialOrderDetailContract['current_production_step_id']
  >,
});
