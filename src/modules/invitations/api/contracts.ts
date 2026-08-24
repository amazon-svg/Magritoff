import { z } from 'zod';

export const invitationAccessScopeSchema = z.enum(['magrit_full', 'shop_only']);

export const createInvitationCommandSchema = z.object({
  email: z.string().email(),
  tenantId: z.string().uuid(),
  baseUrl: z.string().url(),
  roleDefinitionIds: z.array(z.string().uuid()),
}).strict();

export const createInvitationResultSchema = z.object({
  invitationId: z.string().uuid(),
  sent: z.boolean(),
  link: z.string().url(),
  reason: z.string().optional(),
});

export const invitationOptionsSchema = z.object({
  roles: z.array(z.object({ id: z.string().uuid(), name: z.string(), description: z.string() })),
  shops: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
});

export const pendingInvitationSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member', 'partner']),
  expiresAt: z.string(),
  createdAt: z.string(),
  accessScope: invitationAccessScopeSchema,
  allowedShopIds: z.array(z.string().uuid()),
  permissions: z.object({ canQuote: z.boolean(), canOrder: z.boolean(), canInvite: z.boolean() }),
});

export const pendingInvitationsSchema = z.array(pendingInvitationSchema);
export const resendInvitationCommandSchema = z.object({ baseUrl: z.string().url() });
export const resendInvitationResultSchema = createInvitationResultSchema.omit({ invitationId: true });
export const revokeInvitationResultSchema = z.object({ revoked: z.literal(true) });

export type CreateInvitationCommand = z.infer<typeof createInvitationCommandSchema>;
export type CreateInvitationResult = z.infer<typeof createInvitationResultSchema>;
export type InvitationOptions = z.infer<typeof invitationOptionsSchema>;
export type PendingInvitation = z.infer<typeof pendingInvitationSchema>;
export type ResendInvitationResult = z.infer<typeof resendInvitationResultSchema>;
