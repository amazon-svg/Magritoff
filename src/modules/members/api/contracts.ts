import { z } from 'zod';

export const memberRoleSchema = z.enum(['admin', 'member']);
export const memberAccessScopeSchema = z.enum(['magrit_full', 'shop_only']);
export const memberPermissionsSchema = z.object({
  canQuote: z.boolean(), canOrder: z.boolean(), canInvite: z.boolean(),
});
export const tenantMemberSchema = z.object({
  userId: z.string().uuid(), email: z.string().email().nullable(), role: memberRoleSchema,
  joinedAt: z.string(), accessScope: memberAccessScopeSchema,
  allowedShopIds: z.array(z.string().uuid()), permissions: memberPermissionsSchema,
});
export const tenantMembersSchema = z.array(tenantMemberSchema);
export const changeMemberRoleCommandSchema = z.object({ role: memberRoleSchema });
export const updateMemberAccessCommandSchema = z.object({
  accessScope: z.literal('magrit_full'),
  allowedShopIds: z.array(z.string().uuid()).max(0),
  permissions: memberPermissionsSchema,
}).strict();
export const memberMutationResultSchema = z.object({ updated: z.literal(true) });
export const memberRemovalResultSchema = z.object({ removed: z.literal(true) });

export type TenantMember = z.infer<typeof tenantMemberSchema>;
export type MemberRole = z.infer<typeof memberRoleSchema>;
export type ChangeMemberRoleCommand = z.infer<typeof changeMemberRoleCommandSchema>;
export type UpdateMemberAccessCommand = z.infer<typeof updateMemberAccessCommandSchema>;
