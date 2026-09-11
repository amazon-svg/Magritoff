/**
 * Contrats Zod du module Reglages commerciaux (story E10.10a, ETENDU par
 * E10.22d).
 *
 * Ressource SINGLETON du tenant courant (`/commercial-settings`, pas
 * d identifiant au chemin — le tenant vient du jeton, CA4). Porte la duree de
 * validite par defaut appliquee aux devis A LEUR ENVOI (jamais a leur
 * creation, voir `docs/api/CONVENTIONS.md` §8.12, point 9) et, depuis
 * E10.22d (§8.22bis), le pilotage PAR ESPACE de la purge automatique des
 * fichiers de commande (E10.22) : `order_file_purge_enabled` (interrupteur,
 * `false` par defaut) et `order_file_purge_effective_from` (plancher
 * d activation, lecture seule).
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

/**
 * ABSENTS DE `required` DANS CET INCREMENT (contrat §9, meme methode que
 * `deposited_via`/`purge_at` en leur temps) : le declarer requis aujourd hui
 * rendrait NON CONFORME toute lecture qui ne les sert pas encore. Optionnel
 * -> requis est compatible au sens du CA13 ; ce lot les sert TOUJOURS (via
 * `SupabaseCommercialSettingsRepository`), l optionalite ne vient donc que du
 * contrat, jamais d une absence reelle cote implementation.
 */
export const orderFilePurgeEnabledSchema = z.boolean();
export const orderFilePurgeEffectiveFromSchema = timestampSchema.nullable();

export const commercialSettingsSchema = z
  .object({
    tenant_id: uuidSchema,
    default_validity_days: defaultValidityDaysSchema,
    order_file_purge_enabled: orderFilePurgeEnabledSchema.optional(),
    order_file_purge_effective_from: orderFilePurgeEffectiveFromSchema.optional(),
    updated_at: timestampSchema,
  })
  .strict();

export const updateCommercialSettingsCommandSchema = z
  .object({
    default_validity_days: defaultValidityDaysSchema.optional(),
    // PAS DE `null` (contrat) : « ne rien decider » se dit en n envoyant pas
    // le champ. Rearme le plancher d activation sur une transition
    // false->true (effet de bord ASSUME, porte cote base par le trigger
    // `commercial_settings_track_purge_activation` — jamais reimplemente ici).
    order_file_purge_enabled: orderFilePurgeEnabledSchema.optional(),
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
  orderFilePurgeEnabled: true as AssertAssignable<
    CommercialSettingsDto['order_file_purge_enabled'],
    CommercialSettingsContract['order_file_purge_enabled']
  >,
  orderFilePurgeEffectiveFrom: true as AssertAssignable<
    CommercialSettingsDto['order_file_purge_effective_from'],
    CommercialSettingsContract['order_file_purge_effective_from']
  >,
});
