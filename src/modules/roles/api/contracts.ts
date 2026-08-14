import { z } from 'zod';

export const roleDefinitionSchema = z.object({
  id: z.string().uuid(), name: z.string(), description: z.string(),
  capabilities: z.record(z.string(), z.boolean()), orderingIndex: z.number(),
});
export const roleCatalogDefinitionSchema = roleDefinitionSchema.extend({
  tenantId: z.string().uuid(),
  notifyPolicy: z.enum(['chain_next', 'all_roles', 'none']),
  scope: z.enum(['tenant', 'shop']),
  scopeShopId: z.string().uuid().nullable(),
  archivedAt: z.iso.datetime({ offset: true }).nullable(),
});
export const roleAssignmentSchema = z.object({ id: z.string().uuid(), roleId: z.string().uuid(), userId: z.string().uuid() });
export const roleMemberSchema = z.object({ userId: z.string().uuid(), email: z.string().email(), legacyRole: z.string() });
export const rolesOverviewSchema = z.object({
  roles: z.array(roleDefinitionSchema), members: z.array(roleMemberSchema), assignments: z.array(roleAssignmentSchema),
});
export const rolesCatalogSchema = z.object({
  roles: z.array(roleCatalogDefinitionSchema),
  members: z.array(roleMemberSchema),
  assignments: z.array(roleAssignmentSchema),
});
export const userRolesDetailSchema = z.object({
  roles: z.array(roleDefinitionSchema), assignments: z.array(roleAssignmentSchema),
  shops: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
  accessScope: z.enum(['magrit_full', 'shop_only']), allowedShopIds: z.array(z.string().uuid()),
});
/**
 * UM2 — réponse unique à « quelles surfaces et quelles actions pour cet
 * utilisateur ? ». L UX interroge ce contrat, jamais le stockage : la
 * superposition access_scope / allowed_shop_ids / rôles reste un détail
 * d implémentation en voie de résorption.
 *
 * `surface: 'shop'` désigne la population transitoire des membres `shop_only`,
 * appelée à migrer vers des comptes boutique (SPEC-IDENTITY-STORE-01, UM7).
 */
export const accessSurfaceSchema = z.enum(['workspace', 'backoffice', 'shop']);
export const userAccessProfileSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  membership: z.enum(['admin', 'member', 'partner']),
  isAdmin: z.boolean(),
  surfaces: z.array(accessSurfaceSchema),
  allowedShopIds: z.array(z.string().uuid()),
  /**
   * Capabilities effectives : union des rôles actifs ; pour un admin, toutes
   * celles déclarées dans le catalogue de l espace (l admin porte tout).
   */
  capabilities: z.array(z.string()),
});
export const setRoleAssignmentCommandSchema = z.object({ active: z.boolean() });
export const setRoleAssignmentResultSchema = z.object({ active: z.boolean(), assignmentId: z.string().uuid().nullable() });
export const saveRoleDefinitionCommandSchema = z.object({
  name: z.string().trim().min(2).max(50),
  description: z.string().max(500).default(''),
  capabilities: z.record(z.string(), z.boolean()).refine(
    (capabilities) => Object.values(capabilities).some(Boolean),
    'Au moins une capability est requise.',
  ),
  notifyPolicy: z.enum(['chain_next', 'all_roles', 'none']),
  scope: z.enum(['tenant', 'shop']),
  scopeShopId: z.string().uuid().nullable(),
  orderingIndex: z.number().int(),
}).superRefine((command, context) => {
  const validScope = command.scope === 'tenant'
    ? command.scopeShopId === null
    : command.scopeShopId !== null;
  if (!validScope) context.addIssue({ code: 'custom', path: ['scopeShopId'], message: 'La boutique doit correspondre à la portée.' });
});
export const reorderRolesCommandSchema = z.object({
  firstRoleId: z.string().uuid(),
  secondRoleId: z.string().uuid(),
});
export const archiveRoleResultSchema = z.object({ archived: z.literal(true) });
export const reorderRolesResultSchema = z.object({ reordered: z.literal(true) });
export const userCapabilitySchema = z.object({
  capability: z.string().trim().min(1).max(80).regex(/^can_[a-z0-9_]+$/),
  granted: z.boolean(),
});

export type RolesOverview = z.infer<typeof rolesOverviewSchema>;
export type RolesCatalog = z.infer<typeof rolesCatalogSchema>;
export type UserRolesDetail = z.infer<typeof userRolesDetailSchema>;
export type SetRoleAssignmentResult = z.infer<typeof setRoleAssignmentResultSchema>;
export type RoleCatalogDefinition = z.infer<typeof roleCatalogDefinitionSchema>;
export type SaveRoleDefinitionCommand = z.infer<typeof saveRoleDefinitionCommandSchema>;
export type UserCapability = z.infer<typeof userCapabilitySchema>;
export type UserAccessProfile = z.infer<typeof userAccessProfileSchema>;
export type AccessSurface = z.infer<typeof accessSurfaceSchema>;
