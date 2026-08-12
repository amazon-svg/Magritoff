import { z } from 'zod';

export const scopeTypeSchema = z.enum(['tenant', 'group', 'user']);
export const targetTypeSchema = z.enum(['all', 'gamme', 'product']);
export const adjustModeSchema = z.enum(['margin_pct', 'discount_pct', 'fixed_price']);
export const clientPriceRuleSchema = z.object({
  id: z.string(), tenant_id: z.string(), name: z.string(), scope_type: scopeTypeSchema,
  group_id: z.string().nullable(), user_id: z.string().nullable(), target_type: targetTypeSchema,
  gamme_slug: z.string().nullable(), product_definition_id: z.string().nullable(),
  adjust_mode: adjustModeSchema, value: z.number(), priority: z.number().int(), active: z.boolean(),
  valid_from: z.string().nullable(), valid_until: z.string().nullable(), created_at: z.string(),
});
export const clientGroupSchema = z.object({ id: z.string(), tenant_id: z.string(), name: z.string(), created_at: z.string(), member_count: z.number().int().nonnegative().optional() });
export const commercialMemberSchema = z.object({ user_id: z.string(), email: z.string() });
export const commercialGammeSchema = z.object({ slug: z.string(), name: z.string() });
export const commercialOverviewSchema = z.object({
  available: z.boolean(), rules: z.array(clientPriceRuleSchema), groups: z.array(clientGroupSchema),
  members: z.array(commercialMemberSchema), gammes: z.array(commercialGammeSchema),
});

export type ClientPriceRuleDto = z.infer<typeof clientPriceRuleSchema>;
export type ClientGroupDto = z.infer<typeof clientGroupSchema>;
export type CommercialOverview = z.infer<typeof commercialOverviewSchema>;
