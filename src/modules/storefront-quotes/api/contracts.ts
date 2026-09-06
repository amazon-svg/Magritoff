/**
 * Contrats Zod du module Devis du portail client (story E10.10b-1).
 *
 * Miroir d execution de `StorefrontQuote*` (openapi/magrit-core.v1.yaml). Ce
 * module est DISTINCT de `commercial-quotes` (devis cote ATELIER) : bounded
 * context different, acteur different (`ShopCustomerPrincipal`, pas
 * `UserPrincipal`/`ServicePrincipal`) — voir docs/api/CONVENTIONS.md §8.13,
 * "Les huit decisions de contrat", point 1.
 *
 * ── Liste BLANCHE, jamais liste noire ───────────────────────────────────────
 * Ces schemas sont `.strict()` : un champ absent du contrat client
 * (`production_price`, `applied_margin_rate`, `breakdown`, `warnings`,
 * `tenant_id`, `project_id`, `created_by`, `sent_by`, ...) ne peut PAS
 * apparaitre ici par accident. Ne rajouter aucun champ qui ne figure pas dans
 * `StorefrontQuote`/`StorefrontQuoteDetail`/`StorefrontQuoteLine` du contrat,
 * meme si cela semble utile — c est exactement le risque que la ressource
 * separee (plutot que `/quotes` a deux representations) est censee fermer.
 *
 * ── `show_discounts` : jamais un champ transmis ─────────────────────────────
 * Ce module n a pas de schema pour `show_discounts` : le filtrage est fait
 * SERVEUR (SQL, migration 20260906170000), avant meme que ces schemas ne
 * voient la reponse. Publier le drapeau reviendrait a dire au client
 * « votre imprimeur a choisi de vous masquer les remises ».
 */
import { z } from 'zod';
import { moneySchema, rateSchema, timestampSchema, uuidSchema } from '../../_shared/api/index.ts';
import { nonNegativeRateSchema } from '../../pricing/api/contracts.ts';

/**
 * Sous-ensemble strict de `QuoteStatus` (commercial-quotes), ampute de
 * `draft`. Enumeration SEPAREE plutot que reutilisation : elle sert aussi de
 * valeur de FILTRE (`GET /storefront-quotes?status=`), et un filtre qui
 * accepte une valeur que le serveur refuse toujours (`draft`) est un contrat
 * qui ment.
 */
export const storefrontQuoteStatusSchema = z.enum(['sent', 'accepted', 'rejected', 'converted']);

/** `YYYY-MM-DD`, meme regle que `commercial_quotes.valid_until`. */
export const storefrontQuoteDateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: 'Une date seule se serialise en YYYY-MM-DD.',
});

/** `DEV-AAAA-NNNNN` (contrat `StorefrontQuote.number`). */
export const storefrontQuoteNumberSchema = z.string().regex(/^DEV-[0-9]{4}-[0-9]{5}$/, {
  message: 'Un numero de devis suit la forme DEV-AAAA-NNNNN.',
});

/**
 * Montant monetaire POSITIF OU NUL (contrat `MoneyNonNegative`), meme regle
 * que `commercial-quotes/api/contracts.ts` (duplique a l identique, pattern
 * deja etabli dans ce depot pour ce schema partage sans composant `_shared`).
 */
export const storefrontMoneyNonNegativeSchema = z.string().regex(/^[0-9]{1,10}\.[0-9]{2}$/, {
  message: 'Un montant se serialise en chaine decimale positive a deux decimales, ex. "1234.50".',
});

export const storefrontTaxRegimeSchema = z.enum([
  'metropole_fr',
  'dom_tom',
  'franchise_tva',
  'export_eu',
  'export_world',
]);

export const storefrontQuoteTotalsSchema = z
  .object({
    lines_subtotal: storefrontMoneyNonNegativeSchema.nullable(),
    global_discount: moneySchema.nullable(),
    effective_discount_rate: rateSchema.nullable(),
    net_total: storefrontMoneyNonNegativeSchema,
    vat_rate: nonNegativeRateSchema,
    vat_regime: storefrontTaxRegimeSchema.nullable(),
    vat_amount: storefrontMoneyNonNegativeSchema,
    total_incl_tax: storefrontMoneyNonNegativeSchema,
  })
  .strict();

export const storefrontQuoteLineSchema = z
  .object({
    id: uuidSchema,
    label: z.string().min(1).max(300),
    product_config: z.record(z.string(), z.unknown()),
    quantity: z.number().int().min(1),
    position: z.number().int().min(0),
    price_before_discount: storefrontMoneyNonNegativeSchema.nullable(),
    discount_rate: rateSchema.nullable(),
    price: storefrontMoneyNonNegativeSchema,
  })
  .strict();

export const storefrontQuoteSchema = z
  .object({
    id: uuidSchema,
    number: storefrontQuoteNumberSchema,
    status: storefrontQuoteStatusSchema,
    issued_at: timestampSchema,
    valid_until: storefrontQuoteDateOnlySchema.nullable(),
    expired: z.boolean(),
    totals: storefrontQuoteTotalsSchema,
  })
  .strict();

export const storefrontQuoteDetailSchema = z
  .object({
    id: uuidSchema,
    number: storefrontQuoteNumberSchema,
    status: storefrontQuoteStatusSchema,
    issued_at: timestampSchema,
    valid_until: storefrontQuoteDateOnlySchema.nullable(),
    expired: z.boolean(),
    totals: storefrontQuoteTotalsSchema,
    lines: z.array(storefrontQuoteLineSchema),
  })
  .strict();

export const storefrontQuotesListSchema = z.array(storefrontQuoteSchema);

export type StorefrontQuoteStatus = z.infer<typeof storefrontQuoteStatusSchema>;
export type StorefrontTaxRegime = z.infer<typeof storefrontTaxRegimeSchema>;
export type StorefrontQuoteTotalsDto = z.infer<typeof storefrontQuoteTotalsSchema>;
export type StorefrontQuoteLineDto = z.infer<typeof storefrontQuoteLineSchema>;
export type StorefrontQuoteDto = z.infer<typeof storefrontQuoteSchema>;
export type StorefrontQuoteDetailDto = z.infer<typeof storefrontQuoteDetailSchema>;

// ---------------------------------------------------------------------------
// Alignement de compilation contrat <-> schemas (meme garde-fou que les
// autres modules E10.x, voir src/modules/_shared/api/contracts.ts).
// ---------------------------------------------------------------------------
import type {
  StorefrontQuote as StorefrontQuoteContract,
  StorefrontQuoteDetail as StorefrontQuoteDetailContract,
  StorefrontQuoteLine as StorefrontQuoteLineContract,
  StorefrontQuoteStatus as StorefrontQuoteStatusContract,
  StorefrontQuoteTotals as StorefrontQuoteTotalsContract,
} from '../../../platform/api/generated/magrit-core.v1.ts';

type AssertAssignable<TSource, TTarget> = TSource extends TTarget ? true : never;

export const STOREFRONT_QUOTES_CONTRACT_ALIGNMENT = Object.freeze({
  status: true as AssertAssignable<StorefrontQuoteStatus, StorefrontQuoteStatusContract>,
  totals: true as AssertAssignable<StorefrontQuoteTotalsDto, StorefrontQuoteTotalsContract>,
  line: true as AssertAssignable<StorefrontQuoteLineDto, StorefrontQuoteLineContract>,
  quote: true as AssertAssignable<StorefrontQuoteDto, StorefrontQuoteContract>,
  detail: true as AssertAssignable<StorefrontQuoteDetailDto, StorefrontQuoteDetailContract>,
});
