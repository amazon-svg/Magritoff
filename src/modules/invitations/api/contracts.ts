import { z } from 'zod';

export const invitationAccessScopeSchema = z.enum(['magrit_full', 'shop_only']);

export const createInvitationCommandSchema = z.object({
  email: z.string().email(),
  tenantId: z.string().uuid(),
  baseUrl: z.string().url(),
  accessScope: invitationAccessScopeSchema,
  allowedShopIds: z.array(z.string().uuid()),
  roleDefinitionIds: z.array(z.string().uuid()),
});

export const createInvitationResultSchema = z.object({
  invitationId: z.string().uuid(),
  sent: z.boolean(),
  link: z.string().url(),
  reason: z.string().optional(),
});

export type CreateInvitationCommand = z.infer<typeof createInvitationCommandSchema>;
export type CreateInvitationResult = z.infer<typeof createInvitationResultSchema>;
