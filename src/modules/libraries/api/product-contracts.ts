import { z } from 'zod';

export const libraryProductInputSchema = z.object({
  library_id: z.string().nullable(),
  name: z.string().min(1).max(300),
  category: z.string().max(200),
  description: z.string().max(5000),
  price_ht: z.number().nonnegative(),
  image_url: z.string().max(4000),
  config: z.record(z.string(), z.unknown()),
  active: z.boolean(),
  gamme_slug: z.string().max(200).nullable().optional(),
}).strict();

export const libraryProductSchema = libraryProductInputSchema.extend({
  id: z.string(),
  tenant_id: z.string().optional(),
  user_id: z.string().optional(),
  created_at: z.string().optional(),
});

export const libraryProductsSchema = z.array(libraryProductSchema);
export const createLibraryProductsSchema = z.object({ products: z.array(libraryProductInputSchema).min(1).max(500) }).strict();
export const updateLibraryProductSchema = libraryProductInputSchema.partial().strict();
export const libraryProductRemovedSchema = z.object({ removed: z.literal(true) });
export const pimGeneratedProductsResultSchema = z.object({ created: z.number().int().nonnegative() });
export const clearPimGeneratedProductsResultSchema = z.object({ removed: z.number().int().nonnegative() });

export type LibraryProductDto = z.infer<typeof libraryProductSchema>;
export type LibraryProductInput = z.infer<typeof libraryProductInputSchema>;
export type UpdateLibraryProduct = z.infer<typeof updateLibraryProductSchema>;
