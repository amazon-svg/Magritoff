import { z } from 'zod';

export const tenantRoleSchema = z.enum(['admin', 'member']);
export const tenantPlanSchema = z.enum(['freemium', 'pro', 'enterprise']);
export const accessScopeSchema = z.enum(['magrit_full', 'shop_only']);

export const memberPermissionsSchema = z.object({
  can_quote: z.boolean(),
  can_order: z.boolean(),
  can_invite: z.boolean(),
});

export const sessionTenantSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  parent_tenant_id: z.string().nullable(),
  plan: tenantPlanSchema,
  is_system_tenant: z.boolean(),
  settings: z.record(z.string(), z.unknown()),
  created_at: z.string(),
  siren: z.string().nullable().optional(),
  siren_data: z.record(z.string(), z.unknown()).nullable().optional(),
  verified: z.boolean().optional(),
  verified_at: z.string().nullable().optional(),
  tax_regime: z.string().nullable().optional(),
  myRole: tenantRoleSchema,
  accessScope: accessScopeSchema,
  allowedShopIds: z.array(z.string()),
  permissions: memberPermissionsSchema,
  inheritedFromParent: z.boolean(),
});

export const userPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark']),
  language: z.enum(['fr', 'en']),
  default_delivery_zone: z.string(),
  notifications_email: z.boolean(),
  plan: tenantPlanSchema,
  is_admin: z.boolean(),
  last_tenant_id: z.string().nullable(),
});

export const sessionBootstrapSchema = z.object({
  user: z.object({ id: z.string().min(1) }),
  tenants: z.array(sessionTenantSchema),
  isSuperAdmin: z.boolean(),
  preferences: userPreferencesSchema,
});

export const updatePreferencesSchema = userPreferencesSchema
  .omit({ last_tenant_id: true, plan: true, is_admin: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Au moins une préférence est requise.');

export const updateCurrentTenantSchema = z.object({ tenantId: z.string().min(1) });
export const updateTenantSettingsSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  slug: z.string().trim().min(3).max(60).regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/).optional(),
  plan: tenantPlanSchema.optional(),
}).refine(
  (value) => value.name !== undefined || value.slug !== undefined || value.plan !== undefined,
  'Au moins une modification est requise.',
);
export const tenantMutationResultSchema = z.object({ updated: z.literal(true) });
export const subTenantSchema = z.object({ id: z.string().min(1), slug: z.string(), name: z.string(), createdAt: z.string() });
export const subTenantKpiSchema = z.object({
  tenantId: z.string().min(1), tenantName: z.string(), tenantSlug: z.string(), createdAt: z.string(),
  memberCount: z.number().int().nonnegative(), monthOrderCount: z.number().int().nonnegative(), monthCaHt: z.number().nonnegative(),
});
export const subTenantsDashboardSchema = z.object({ subTenants: z.array(subTenantSchema), kpis: z.array(subTenantKpiSchema) });
export const createSubTenantSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z.string().trim().min(3).max(60).regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/),
});
export const createSubTenantResultSchema = z.object({ tenantId: z.string().min(1) });
export const removeSubTenantResultSchema = z.object({ removed: z.literal(true) });
export const tenantSlugResolutionSchema = z.object({ slug: z.string().nullable() });
export const createRootTenantSchema = createSubTenantSchema.extend({
  siren: z.string().trim().min(1).max(32).optional(),
  sirenData: z.record(z.string(), z.unknown()).optional(),
  gammeSlugs: z.array(z.string().trim().min(1).max(160)).max(200).optional(),
}).refine(
  ({ siren, sirenData }) => (siren === undefined) === (sirenData === undefined),
  { message: 'Le SIREN et ses données de vérification doivent être fournis ensemble.' },
);
export const createRootTenantResultSchema = z.object({ tenantId: z.string().min(1) });
export const acceptTenantInvitationSchema = z.object({ token: z.string().trim().min(1).max(512) });
export const acceptTenantInvitationResultSchema = z.object({ tenantId: z.string().min(1) });

export type SessionTenant = z.infer<typeof sessionTenantSchema>;
export type SessionBootstrap = z.infer<typeof sessionBootstrapSchema>;
export type SessionUserPreferences = z.infer<typeof userPreferencesSchema>;
export type UpdatePreferences = z.infer<typeof updatePreferencesSchema>;
export type UpdateTenantSettings = z.infer<typeof updateTenantSettingsSchema>;
export type SubTenant = z.infer<typeof subTenantSchema>;
export type SubTenantKpi = z.infer<typeof subTenantKpiSchema>;
export type SubTenantsDashboard = z.infer<typeof subTenantsDashboardSchema>;
export type CreateSubTenant = z.infer<typeof createSubTenantSchema>;
export type CreateRootTenant = z.infer<typeof createRootTenantSchema>;
export type AcceptTenantInvitation = z.infer<typeof acceptTenantInvitationSchema>;
export type TenantSlugResolution = z.infer<typeof tenantSlugResolutionSchema>;
