import { z } from 'zod';

export const shopThemeSchema = z.object({
  primaryColor: z.string(), accentColor: z.string(), mode: z.enum(['light', 'dark']),
  secondaryColor: z.string().optional(), textColor: z.string().optional(),
  bgColor: z.string().optional(), fontPairing: z.string().optional(),
});

export const shopSchema = z.object({
  id: z.string().uuid(), tenantId: z.string().uuid(), ownerUserId: z.string().uuid(),
  slug: z.string(), name: z.string(), description: z.string(), theme: shopThemeSchema,
  logoUrl: z.string(), address: z.string(), contactEmail: z.string(), active: z.boolean(),
  libraryIds: z.array(z.string().uuid()), excludedProductIds: z.array(z.string().uuid()),
  heroImageUrl: z.string().nullable(), tagline: z.string().nullable(),
  pimCatalogMode: z.boolean(), pimGammeSlugs: z.array(z.string()),
  accessMode: z.enum(['invite_only', 'self_signup']), createdAt: z.iso.datetime({ offset: true }),
});
export const tenantShopsSchema = z.array(shopSchema);

export const createShopCommandSchema = z.object({
  name: z.string().trim().min(1).max(120), description: z.string().max(2000).default(''),
  logoUrl: z.string().default(''), address: z.string().default(''),
  contactEmail: z.string().default(''), theme: shopThemeSchema.partial().default({}),
  heroImageUrl: z.string().nullable().default(null), tagline: z.string().max(120).nullable().default(null),
});

export const updateShopCommandSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(), description: z.string().max(2000).optional(),
  logoUrl: z.string().optional(), address: z.string().optional(), contactEmail: z.string().optional(),
  theme: shopThemeSchema.optional(), active: z.boolean().optional(),
  libraryIds: z.array(z.string().uuid()).optional(), excludedProductIds: z.array(z.string().uuid()).optional(),
  heroImageUrl: z.string().nullable().optional(), tagline: z.string().max(120).nullable().optional(),
  pimCatalogMode: z.boolean().optional(), pimGammeSlugs: z.array(z.string()).optional(),
  accessMode: z.enum(['invite_only', 'self_signup']).optional(),
}).refine((value) => Object.keys(value).length > 0, 'Une modification est requise.');

export const shopProductSchema = z.object({
  id: z.string().uuid(), shopId: z.string().uuid(), productId: z.string().uuid().nullable(),
  name: z.string(), category: z.string(), description: z.string(), priceHt: z.number(),
  imageUrl: z.string(), config: z.record(z.string(), z.unknown()), displayOrder: z.number().int(),
  createdAt: z.iso.datetime({ offset: true }), tenantId: z.string().uuid().nullable(),
  gammeSlug: z.string().nullable(),
});
export const shopProductsSchema = z.array(shopProductSchema);
export const createShopProductCommandSchema = shopProductSchema.omit({
  id: true, shopId: true, createdAt: true, tenantId: true,
});
export const updateShopProductCommandSchema = createShopProductCommandSchema.partial()
  .refine((value) => Object.keys(value).length > 0, 'Une modification est requise.');
export const shopMutationResultSchema = z.object({ updated: z.literal(true) });
export const shopRemovalResultSchema = z.object({ removed: z.literal(true) });

export const publicShopProbeSchema = z.object({
  id: z.string().uuid(), tenantId: z.string().uuid(),
  accessMode: z.enum(['invite_only', 'self_signup']),
});
export const publicShopSchema = shopSchema.omit({
  ownerUserId: true, libraryIds: true, excludedProductIds: true,
  pimCatalogMode: true, pimGammeSlugs: true,
});
export const publicShopProductSchema = shopProductSchema.extend({ id: z.string() });
export const publicGammeSchema = z.object({
  id: z.string().uuid(), slug: z.string(), name: z.string(), parent_slug: z.string().nullable(),
  matching_rules: z.record(z.string(), z.unknown()), display_order: z.number().int(),
  image_url: z.string().nullable().optional(),
});
export const publicShopCatalogSchema = z.object({
  shop: publicShopSchema,
  products: z.array(publicShopProductSchema),
  gammes: z.array(publicGammeSchema),
  definitions: z.array(z.record(z.string(), z.unknown())),
  subscribedSlugs: z.array(z.string()),
});

export type ShopDto = z.infer<typeof shopSchema>;
export type ShopProductDto = z.infer<typeof shopProductSchema>;
export type CreateShopCommand = z.input<typeof createShopCommandSchema>;
export type UpdateShopCommand = z.infer<typeof updateShopCommandSchema>;
export type CreateShopProductCommand = z.infer<typeof createShopProductCommandSchema>;
export type UpdateShopProductCommand = z.infer<typeof updateShopProductCommandSchema>;
export type PublicShopProbe = z.infer<typeof publicShopProbeSchema>;
export type PublicShopCatalog = z.infer<typeof publicShopCatalogSchema>;
