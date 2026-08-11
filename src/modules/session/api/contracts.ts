import { z } from 'zod';

export const tenantRoleSchema = z.enum(['owner', 'admin', 'member', 'partner']);
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
  .omit({ last_tenant_id: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Au moins une préférence est requise.');

export const updateCurrentTenantSchema = z.object({ tenantId: z.string().min(1) });

export type SessionTenant = z.infer<typeof sessionTenantSchema>;
export type SessionBootstrap = z.infer<typeof sessionBootstrapSchema>;
export type SessionUserPreferences = z.infer<typeof userPreferencesSchema>;
export type UpdatePreferences = z.infer<typeof updatePreferencesSchema>;
