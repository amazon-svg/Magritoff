/**
 * Contrats Zod du module Reglages commerciaux (story E10.10a).
 *
 * Ressource SINGLETON du tenant courant (`/commercial-settings`, pas
 * d identifiant au chemin — le tenant vient du jeton, CA4). Porte aujourd hui
 * la duree de validite par defaut appliquee aux devis A LEUR ENVOI (jamais a
 * leur creation, voir `docs/api/CONVENTIONS.md` §8.12, point 9).
 *
 * Domicile pose aussi pour accueillir le futur seuil configurable d alerte de
 * remise (`QuoteLineWarning.threshold`, laisse en constante par E10.9) — non
 * livre par cette story, juste la forme qui l accueillera sans une seconde
 * ressource de reglages.
 */
import { z } from 'zod';
import { timestampSchema, uuidSchema } from '../../_shared/api/index.ts';

/** `null` = aucune validite par defaut (etat initial d un tenant, decision explicite — pas "30 jours" invente). */
export const defaultValidityDaysSchema = z.number().int().min(1).max(3650).nullable();

export const commercialSettingsSchema = z
  .object({
    tenant_id: uuidSchema,
    default_validity_days: defaultValidityDaysSchema,
    updated_at: timestampSchema,
  })
  .strict();

export const updateCommercialSettingsCommandSchema = z
  .object({
    default_validity_days: defaultValidityDaysSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'La modification doit porter au moins un champ.',
  });

export type CommercialSettingsDto = z.infer<typeof commercialSettingsSchema>;
export type UpdateCommercialSettingsCommand = z.infer<typeof updateCommercialSettingsCommandSchema>;

// ---------------------------------------------------------------------------
// Alignement de compilation contrat <-> schemas (meme garde-fou que les
// autres modules E10.x).
// ---------------------------------------------------------------------------
import type {
  CommercialSettings as CommercialSettingsContract,
} from '../../../platform/api/generated/magrit-core.v1.ts';

type AssertAssignable<TSource, TTarget> = TSource extends TTarget ? true : never;

export const COMMERCIAL_SETTINGS_CONTRACT_ALIGNMENT = Object.freeze({
  tenantId: true as AssertAssignable<CommercialSettingsDto['tenant_id'], CommercialSettingsContract['tenant_id']>,
  defaultValidityDays: true as AssertAssignable<
    CommercialSettingsDto['default_validity_days'],
    CommercialSettingsContract['default_validity_days']
  >,
});
