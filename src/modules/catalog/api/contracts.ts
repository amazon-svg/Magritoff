import { z } from 'zod';

export const gammeSubscriptionSchema = z.object({
  gammeSlug: z.string().trim().min(1).max(160),
  active: z.boolean(),
  displayOrder: z.number().int(),
});
export const gammeSubscriptionsSchema = z.array(gammeSubscriptionSchema);
export const setGammeSubscriptionSchema = gammeSubscriptionSchema.pick({ gammeSlug: true, active: true });
export const setGammeSubscriptionsCommandSchema = z.object({
  subscriptions: z.array(setGammeSubscriptionSchema).min(1).max(200),
}).refine(({ subscriptions }) => new Set(subscriptions.map((item) => item.gammeSlug)).size === subscriptions.length, {
  message: 'Une gamme ne peut apparaître qu’une fois.', path: ['subscriptions'],
});

export type GammeSubscription = z.infer<typeof gammeSubscriptionSchema>;
export type SetGammeSubscriptionsCommand = z.infer<typeof setGammeSubscriptionsCommandSchema>;

const recordSchema = z.record(z.string(), z.unknown());
const usageExampleSchema = z.object({ title: z.string(), description: z.string() });
const faqEntrySchema = z.object({ question: z.string(), answer: z.string() });

export const pimGammeSchema = z.object({
  id: z.string().uuid(), slug: z.string(), name: z.string(), parentSlug: z.string().nullable(),
  matchingRules: recordSchema, displayOrder: z.number().int(), imageUrl: z.string().nullable(),
});
export const pimDefinitionSchema = z.object({
  id: z.string().uuid(), gammeSlug: z.string(), variationFilter: recordSchema, locale: z.string(),
  name: z.string().nullable(), keywords: z.array(z.string()).nullable(), titleTemplate: z.string().nullable(),
  shortDescriptionTemplate: z.string().nullable(), descriptionTemplate: z.string().nullable(), h1Template: z.string().nullable(),
  seoTitle: z.string().nullable(), seoDescription: z.string().nullable(), schemaOrgType: z.string().nullable(),
  usageExamples: z.array(usageExampleSchema), faq: z.array(faqEntrySchema), qualityScore: z.number().nullable(),
  generatedBy: z.enum(['llm', 'human', 'hybrid']).nullable(), validatedBy: z.enum(['llm', 'human', 'pending']).nullable(),
  imageUrl: z.string().nullable(), commercialPitch: z.string().nullable(), benefits: z.array(z.string()).nullable(),
  useCases: z.union([z.array(usageExampleSchema), z.array(z.string())]).nullable(), technicalSpec: recordSchema.nullable(),
  lastReviewedAt: z.iso.datetime({ offset: true }).nullable(), version: z.number().int(),
});
export const pimCatalogSchema = z.object({ gammes: z.array(pimGammeSchema), definitions: z.array(pimDefinitionSchema) });

export const upsertPimGammeCommandSchema = pimGammeSchema.omit({ id: true }).partial({ parentSlug: true, matchingRules: true, displayOrder: true, imageUrl: true }).extend({
  slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9_-]+$/), name: z.string().trim().min(1).max(160),
});
export const upsertPimDefinitionCommandSchema = pimDefinitionSchema.omit({ id: true, qualityScore: true }).partial({
  name: true, keywords: true, titleTemplate: true, shortDescriptionTemplate: true, descriptionTemplate: true,
  h1Template: true, seoTitle: true, seoDescription: true, schemaOrgType: true, usageExamples: true, faq: true,
  generatedBy: true, validatedBy: true, imageUrl: true, commercialPitch: true, benefits: true, useCases: true,
  technicalSpec: true, lastReviewedAt: true, version: true,
}).extend({ gammeSlug: z.string().trim().min(1).max(160), variationFilter: recordSchema, locale: z.string().trim().min(2).max(12) });
export const catalogRemovalResultSchema = z.object({ removed: z.literal(true) });

export type PimGamme = z.infer<typeof pimGammeSchema>;
export type PimDefinition = z.infer<typeof pimDefinitionSchema>;
export type PimCatalog = z.infer<typeof pimCatalogSchema>;
export type UpsertPimGammeCommand = z.infer<typeof upsertPimGammeCommandSchema>;
export type UpsertPimDefinitionCommand = z.infer<typeof upsertPimDefinitionCommandSchema>;
