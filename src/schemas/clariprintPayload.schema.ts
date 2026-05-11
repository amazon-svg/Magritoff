/**
 * Schemas zod pour les payloads Clariprint (R4 - refacto 2026-05-11).
 *
 * Centralise la validation runtime des reponses Clariprint (apres R3 toutes
 * passent par `ClariprintHttpAdapter`). Permet de remplacer
 * `validateClariprintResponse()` heuristique par un parser zod strict.
 *
 * Note R4 : on garde `validateClariprintResponse` pour compat (l'edge function
 * l'appelle aussi). Les nouveaux callers peuvent prefer zod parse pour avoir
 * une erreur structuree et un typage exhaustif.
 */

import { z } from 'zod';

/** Detail des couts retournes par Clariprint (tous optionnels). */
export const clariprintCostsSchema = z.object({
  paper: z.number().nonnegative().optional(),
  print: z.number().nonnegative().optional(),
  makeready: z.number().nonnegative().optional(),
  packaging: z.number().nonnegative().optional(),
  delivery: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
});

/** Reponse Clariprint en succes : `success=true` + `priceHT` >= 0 fini. */
export const clariprintSuccessSchema = z.object({
  success: z.literal(true),
  priceHT: z.number().nonnegative().refine(Number.isFinite, {
    message: 'priceHT doit etre un nombre fini (pas NaN/Infinity)',
  }),
  costs: clariprintCostsSchema.optional(),
  delais: z.number().int().nonnegative().optional(),
  weight: z.number().nonnegative().optional(),
  fournisseur: z.string().optional(),
  processDuration: z.number().nonnegative().optional(),
  details: z.string().optional(),
});

/** Reponse Clariprint en erreur : `success=false` + raison textuelle. */
export const clariprintErrorSchema = z.object({
  success: z.literal(false),
  error: z.string().optional(),
  message: z.string().optional(),
  credentialsMissing: z.boolean().optional(),
  details: z.string().optional(),
});

/** Reponse Clariprint discriminee : succes OU erreur. */
export const clariprintQuoteSchema = z.discriminatedUnion('success', [
  clariprintSuccessSchema,
  clariprintErrorSchema,
]);

export type ClariprintSuccessQuote = z.infer<typeof clariprintSuccessSchema>;
export type ClariprintErrorQuote = z.infer<typeof clariprintErrorSchema>;
export type ClariprintQuote = z.infer<typeof clariprintQuoteSchema>;
