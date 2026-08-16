import { z } from 'zod';

export function normalizeShopCustomerEmail(email: string): string {
  return email.trim().normalize('NFKC').toLowerCase();
}

export const shopCustomerEmailSchema = z.string().trim().email().max(320);

export const normalizedShopCustomerEmailSchema = z.string()
  .trim()
  .email()
  .max(320)
  .refine(
    (email) => email === normalizeShopCustomerEmail(email),
    'L’email doit être normalisé.',
  );

export const shopCustomerAccountStatusSchema = z.enum([
  'delegated_only',
  'invited',
  'active',
  'suspended',
]);

export const shopCustomerAccountSchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid(),
  email: shopCustomerEmailSchema,
  normalizedEmail: normalizedShopCustomerEmailSchema,
  fullName: z.string().trim().min(1).max(200),
  authSubjectId: z.string().uuid().nullable(),
  status: shopCustomerAccountStatusSchema,
  createdByMagritUserId: z.string().uuid().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  activatedAt: z.iso.datetime({ offset: true }).nullable(),
  suspendedAt: z.iso.datetime({ offset: true }).nullable(),
}).strict().superRefine((account, context) => {
  if (account.normalizedEmail !== normalizeShopCustomerEmail(account.email)) {
    context.addIssue({
      code: 'custom',
      path: ['normalizedEmail'],
      message: 'L’email normalisé doit correspondre à l’email métier.',
    });
  }
});

export const directShopCustomerSessionSchema = z.object({
  kind: z.literal('shop_customer'),
  shopId: z.string().uuid(),
  shopCustomerAccountId: z.string().uuid(),
}).strict();

export const delegatedShopCustomerSessionSchema = z.object({
  kind: z.literal('delegated_shop_customer'),
  shopId: z.string().uuid(),
  shopCustomerAccountId: z.string().uuid(),
  delegationId: z.string().uuid(),
  actorMagritUserId: z.string().uuid(),
}).strict();

export const storefrontIdentitySchema = z.discriminatedUnion('kind', [
  directShopCustomerSessionSchema,
  delegatedShopCustomerSessionSchema,
]);

export const shopCustomerDelegationSchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid(),
  shopCustomerAccountId: z.string().uuid(),
  actorMagritUserId: z.string().uuid(),
  issuedAt: z.iso.datetime({ offset: true }),
  expiresAt: z.iso.datetime({ offset: true }),
  revokedAt: z.iso.datetime({ offset: true }).nullable(),
  reason: z.string().trim().max(500).nullable(),
}).strict();

export const createShopCustomerDelegationCommandSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
}).strict();

export const selfShopCustomerDelegationResultSchema = z.object({
  customer: shopCustomerAccountSchema,
  delegation: shopCustomerDelegationSchema,
  storefrontPath: z.string().startsWith('/').max(500),
}).strict();

export function shopCustomerAccountKey(shopId: string, email: string): string {
  return `${shopId}:${normalizeShopCustomerEmail(email)}`;
}

export type ShopCustomerAccountStatus = z.infer<typeof shopCustomerAccountStatusSchema>;
export type ShopCustomerAccount = z.infer<typeof shopCustomerAccountSchema>;
export type DirectShopCustomerSession = z.infer<typeof directShopCustomerSessionSchema>;
export type DelegatedShopCustomerSession = z.infer<typeof delegatedShopCustomerSessionSchema>;
export type StorefrontIdentity = z.infer<typeof storefrontIdentitySchema>;
export type ShopCustomerDelegation = z.infer<typeof shopCustomerDelegationSchema>;
export type CreateShopCustomerDelegationCommand = z.infer<typeof createShopCustomerDelegationCommandSchema>;
export type SelfShopCustomerDelegationResult = z.infer<typeof selfShopCustomerDelegationResultSchema>;
