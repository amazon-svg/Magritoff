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
