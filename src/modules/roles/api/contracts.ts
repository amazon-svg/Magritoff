import { z } from 'zod';

export const roleDefinitionSchema = z.object({
  id: z.string().uuid(), name: z.string(), description: z.string(),
  capabilities: z.record(z.string(), z.boolean()), orderingIndex: z.number(),
});
export const roleAssignmentSchema = z.object({ id: z.string().uuid(), roleId: z.string().uuid(), userId: z.string().uuid() });
export const roleMemberSchema = z.object({ userId: z.string().uuid(), email: z.string().email(), legacyRole: z.string() });
export const rolesOverviewSchema = z.object({
  roles: z.array(roleDefinitionSchema), members: z.array(roleMemberSchema), assignments: z.array(roleAssignmentSchema),
});
export const userRolesDetailSchema = z.object({
  roles: z.array(roleDefinitionSchema), assignments: z.array(roleAssignmentSchema),
  shops: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
  accessScope: z.enum(['magrit_full', 'shop_only']), allowedShopIds: z.array(z.string().uuid()),
});
export const setRoleAssignmentCommandSchema = z.object({ active: z.boolean() });
export const setRoleAssignmentResultSchema = z.object({ active: z.boolean(), assignmentId: z.string().uuid().nullable() });

export type RolesOverview = z.infer<typeof rolesOverviewSchema>;
export type UserRolesDetail = z.infer<typeof userRolesDetailSchema>;
export type SetRoleAssignmentResult = z.infer<typeof setRoleAssignmentResultSchema>;
