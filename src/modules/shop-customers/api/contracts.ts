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
  if (account.status === 'active' && account.activatedAt === null) {
    context.addIssue({ code: 'custom', path: ['activatedAt'], message: 'Un compte actif doit être activé.' });
  }
  if (account.status === 'suspended' && account.suspendedAt === null) {
    context.addIssue({ code: 'custom', path: ['suspendedAt'], message: 'Un compte suspendu doit être horodaté.' });
  }
});

export const shopCustomerAccountsSchema = z.array(shopCustomerAccountSchema);

export const createShopCustomerCommandSchema = z.object({
  email: shopCustomerEmailSchema,
  fullName: z.string().trim().min(1).max(200),
  initialStatus: z.enum(['delegated_only', 'invited']).default('invited'),
}).strict();

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

export const storefrontCustomerProfileSchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid(),
  email: shopCustomerEmailSchema,
  fullName: z.string().trim().min(1).max(200),
  status: z.enum(['active', 'delegated_only']),
}).strict();

export const storefrontSessionSchema = z.object({
  identity: storefrontIdentitySchema,
  customer: storefrontCustomerProfileSchema,
  expiresAt: z.iso.datetime({ offset: true }),
}).strict().superRefine((session, context) => {
  if (session.identity.shopId !== session.customer.shopId) {
    context.addIssue({
      code: 'custom',
      path: ['customer', 'shopId'],
      message: 'La session et le compte doivent appartenir à la même boutique.',
    });
  }
  if (session.identity.shopCustomerAccountId !== session.customer.id) {
    context.addIssue({
      code: 'custom',
      path: ['customer', 'id'],
      message: 'La session doit désigner le compte affiché.',
    });
  }
});

export const createStorefrontSessionCommandSchema = z.object({
  email: shopCustomerEmailSchema,
  password: z.string().min(8).max(1024),
}).strict();

export const storefrontShopSlugSchema = z.string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const createStorefrontSessionResultSchema = z.object({
  session: storefrontSessionSchema,
}).strict();

export const endStorefrontSessionResultSchema = z.object({
  ended: z.literal(true),
}).strict();

export const issueStorefrontActivationCommandSchema = z.object({
  expiresInSeconds: z.number().int().min(900).max(604_800).default(86_400),
}).strict();

export const issueStorefrontActivationResultSchema = z.object({
  activationToken: z.string().regex(/^[A-Za-z0-9_-]{32,512}$/),
  expiresInSeconds: z.number().int().min(900).max(604_800),
}).strict();

export const activateStorefrontCredentialCommandSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{32,512}$/),
  password: z.string().min(8).max(1024),
}).strict();

export const activateStorefrontCredentialResultSchema = z.object({
  activated: z.literal(true),
}).strict();

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
export type CreateShopCustomerCommand = z.input<typeof createShopCustomerCommandSchema>;
export type DirectShopCustomerSession = z.infer<typeof directShopCustomerSessionSchema>;
export type DelegatedShopCustomerSession = z.infer<typeof delegatedShopCustomerSessionSchema>;
export type StorefrontIdentity = z.infer<typeof storefrontIdentitySchema>;
export type StorefrontCustomerProfile = z.infer<typeof storefrontCustomerProfileSchema>;
export type StorefrontSession = z.infer<typeof storefrontSessionSchema>;
export type CreateStorefrontSessionCommand = z.infer<typeof createStorefrontSessionCommandSchema>;
export type CreateStorefrontSessionResult = z.infer<typeof createStorefrontSessionResultSchema>;
export type EndStorefrontSessionResult = z.infer<typeof endStorefrontSessionResultSchema>;
export type IssueStorefrontActivationCommand = z.input<typeof issueStorefrontActivationCommandSchema>;
export type IssueStorefrontActivationResult = z.infer<typeof issueStorefrontActivationResultSchema>;
export type ActivateStorefrontCredentialCommand = z.infer<typeof activateStorefrontCredentialCommandSchema>;
export type ShopCustomerDelegation = z.infer<typeof shopCustomerDelegationSchema>;
export type CreateShopCustomerDelegationCommand = z.infer<typeof createShopCustomerDelegationCommandSchema>;
export type SelfShopCustomerDelegationResult = z.infer<typeof selfShopCustomerDelegationResultSchema>;
