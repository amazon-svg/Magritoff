import { z } from 'zod';

const optionalHttpUrlSchema = z.string().trim().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === 'https:' || protocol === 'http:';
}, 'Une URL HTTP(S) est requise.');

/**
 * Commande d administration. Un mot de passe absent signifie « conserver » ;
 * null signifie « supprimer ». Le secret ne figure jamais dans le contrat de lecture.
 */
export const updateHopeStudioTenantSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  hopeStudioUrl: optionalHttpUrlSchema.nullable().optional(),
  clariprintUser: z.string().trim().min(1).max(512).nullable().optional(),
  clariprintPassword: z.string().min(1).max(4096).nullable().optional(),
  clariprintUrl: optionalHttpUrlSchema.nullable().optional(),
}).strict().refine(
  (value) => Object.values(value).some((item) => item !== undefined),
  'Au moins une modification est requise.',
);

/** Vue administrateur expurgée : le mot de passe ne ressort jamais de l API. */
export const hopeStudioTenantSettingsSchema = z.object({
  enabled: z.boolean(),
  hopeStudioUrl: z.string().url().nullable(),
  clariprintUser: z.string().nullable(),
  clariprintPasswordConfigured: z.boolean(),
  clariprintUrl: z.string().url().nullable(),
}).strict();

export const hopeStudioTenantSettingsUpdatedSchema = z.object({
  updated: z.literal(true),
}).strict();

export type UpdateHopeStudioTenantSettings = z.infer<typeof updateHopeStudioTenantSettingsSchema>;
export type HopeStudioTenantSettings = z.infer<typeof hopeStudioTenantSettingsSchema>;
