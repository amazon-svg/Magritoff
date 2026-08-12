import { z } from 'zod';

export const createQuoteDraftSchema = z.object({
  reference: z.string().min(1).max(120),
  productName: z.string().min(1).max(500),
  productConfig: z.unknown(),
  totalHt: z.number().finite().nonnegative(),
  totalTtc: z.number().finite().nonnegative(),
}).strict();
export const quoteDraftCreatedSchema = z.object({ id: z.string().min(1) });

export type CreateQuoteDraft = z.infer<typeof createQuoteDraftSchema>;
export type QuoteDraftCreated = z.infer<typeof quoteDraftCreatedSchema>;

export const quoteScopeSchema = z.enum(['mine', 'all']);
export const quoteLineSchema = z.object({
  id: z.string(), quote_id: z.string(), product_name: z.string(), product_config: z.unknown(),
  quantity: z.number(), unit_cost_ht: z.number(), unit_price_ht: z.number(), margin_pct: z.number(),
  line_total_ht: z.number(), position: z.number().int(), created_at: z.string().optional(),
});
export const quoteLineDraftSchema = quoteLineSchema.omit({ id: true, quote_id: true, created_at: true });
export const quoteRecordSchema = z.object({
  id: z.string(), user_id: z.string(), tenant_id: z.string().nullable(), reference: z.string(),
  product_name: z.string(), client_name: z.string().nullable(), status: z.string(),
  total_ht: z.number().nullable(), total_ttc: z.number().nullable(), created_at: z.string(), updated_at: z.string(),
});
export const quotesListSchema = z.array(quoteRecordSchema);
export const quoteWithLinesSchema = quoteRecordSchema.extend({ lines: z.array(quoteLineSchema) });
export const createEditableQuoteSchema = z.object({
  reference: z.string().min(1).max(120), productName: z.string().min(1).max(500), clientName: z.string().max(500).nullable(),
  totalHt: z.number().finite().nonnegative(), totalTtc: z.number().finite().nonnegative(), lines: z.array(quoteLineDraftSchema).max(500),
}).strict();
export const saveQuoteSchema = z.object({
  clientName: z.string().max(500).nullable().optional(), status: z.string().min(1).max(80).optional(),
  productName: z.string().min(1).max(500).optional(), totalHt: z.number().finite().nonnegative(),
  totalTtc: z.number().finite().nonnegative(), lines: z.array(quoteLineDraftSchema).max(500),
}).strict();
export const setQuoteStatusSchema = z.object({ status: z.string().min(1).max(80) }).strict();
export const duplicateQuoteSchema = z.object({ reference: z.string().min(1).max(120) }).strict();
export const quoteUpdatedSchema = z.object({ updated: z.literal(true) });
export const quoteRemovedSchema = z.object({ removed: z.literal(true) });

export type QuoteScope = z.infer<typeof quoteScopeSchema>;
export type QuoteLine = z.infer<typeof quoteLineSchema>;
export type QuoteLineDraft = z.infer<typeof quoteLineDraftSchema>;
export type QuoteRecord = z.infer<typeof quoteRecordSchema>;
export type QuoteWithLines = z.infer<typeof quoteWithLinesSchema>;
export type CreateEditableQuote = z.infer<typeof createEditableQuoteSchema>;
export type SaveQuote = z.infer<typeof saveQuoteSchema>;
