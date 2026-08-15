import { z } from 'zod';

export const clariprintQuoteCommandSchema = z.object({
  clariprint: z.record(z.string(), z.unknown()),
}).strict();

export const clariprintCostsSchema = z.object({
  paper: z.number().optional(),
  print: z.number().optional(),
  makeready: z.number().optional(),
  packaging: z.number().optional(),
  delivery: z.number().optional(),
  total: z.number().optional(),
}).passthrough();

export const clariprintQuoteResultSchema = z.object({
  success: z.boolean(),
  credentialsMissing: z.boolean().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
  priceHT: z.number().optional(),
  costs: clariprintCostsSchema.optional(),
  delais: z.number().optional(),
  weight: z.number().optional(),
  fournisseur: z.string().optional(),
  processDuration: z.number().optional(),
  details: z.string().optional(),
}).passthrough();

export type ClariprintQuoteCommand = z.infer<typeof clariprintQuoteCommandSchema>;
export type ClariprintQuoteResult = z.infer<typeof clariprintQuoteResultSchema>;
