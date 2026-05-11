/**
 * Schema zod pour les ProductDefinition PIM (R4 - refacto 2026-05-11).
 *
 * Aligne sur la table `product_definitions` (cf. database.types.ts). Utilise
 * pour valider les payloads retournes par `pim-generate` edge function avant
 * persistence (defense-in-depth en sus de la validation cote serveur).
 */

import { z } from 'zod';

/** Schema.org type le plus courant pour les ProductDefinition Magrit. */
export const schemaOrgTypeSchema = z.enum([
  'Product',
  'PrintedCard',
  'Brochure',
  'Poster',
  'Banner',
  'Sticker',
  'PromotionalItem',
]);

/** Source de validation : LLM, humain ou pending. */
export const validatedBySchema = z.enum(['pending', 'human', 'llm']);

export const usageExampleSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

export const faqEntrySchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

/** Schema metadata multilingue. Cle = locale ('fr', 'en'...), valeur = champ. */
const localizedString = z.record(z.string(), z.string());

export const productDefinitionSchema = z.object({
  id: z.string().uuid().optional(),
  gamme_slug: z.string().min(1),
  variant_key: z.string().min(1),
  /** Champs marketing/SEO/GEO multilingues. */
  title: localizedString.optional(),
  short_description: localizedString.optional(),
  description: localizedString.optional(),
  h1: localizedString.optional(),
  seo_title: localizedString.optional(),
  seo_description: localizedString.optional(),
  keywords: z.array(z.string()).optional(),
  schema_org_type: schemaOrgTypeSchema.optional(),
  quality_score: z.number().min(0).max(1).optional(),
  validated_by: validatedBySchema.optional(),
  usage_examples: z.array(usageExampleSchema).optional(),
  faq: z.array(faqEntrySchema).optional(),
  image_url: z.string().url().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type ProductDefinition = z.infer<typeof productDefinitionSchema>;
export type SchemaOrgType = z.infer<typeof schemaOrgTypeSchema>;
export type ValidatedBy = z.infer<typeof validatedBySchema>;
