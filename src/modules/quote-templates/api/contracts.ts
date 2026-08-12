import { z } from 'zod';

const styleSchema = z.enum(['classique', 'atelier', 'corporate', 'custom']);
const fields = {
  name: z.string().min(1).max(200), style: styleSchema.optional(), company_name: z.string().nullable().optional(),
  address: z.string().nullable().optional(), postal_code: z.string().nullable().optional(), city: z.string().nullable().optional(),
  country: z.string().nullable().optional(), phone: z.string().nullable().optional(), email: z.string().nullable().optional(),
  website: z.string().nullable().optional(), siret: z.string().nullable().optional(), tva_number: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(), brand_color: z.string().nullable().optional(), accent_color: z.string().nullable().optional(),
  font_family: z.string().nullable().optional(), validity_days: z.number().int().nonnegative().nullable().optional(), footer_text: z.string().nullable().optional(),
};
export const quoteTemplateSchema = z.object({ id: z.string(), builtin: z.literal(false), ...fields });
export const quoteTemplatesOverviewSchema = z.object({ templates: z.array(quoteTemplateSchema), defaultTemplateId: z.string().nullable() });
export const createQuoteTemplateSchema = z.object(fields).strict();
export const updateQuoteTemplateSchema = z.object(fields).partial().strict();
export const setDefaultQuoteTemplateSchema = z.object({ id: z.string().nullable() }).strict();
export const quoteTemplateUpdatedSchema = z.object({ updated: z.literal(true) });
export const quoteTemplateRemovedSchema = z.object({ removed: z.literal(true) });
export type QuoteTemplateDto = z.infer<typeof quoteTemplateSchema>;
export type CreateQuoteTemplate = z.infer<typeof createQuoteTemplateSchema>;
export type UpdateQuoteTemplate = z.infer<typeof updateQuoteTemplateSchema>;
export type QuoteTemplatesOverview = z.infer<typeof quoteTemplatesOverviewSchema>;
