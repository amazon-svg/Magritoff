import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type { CommercialSettingsDto, UpdateCommercialSettingsCommand } from '../api/contracts.ts';

/** L acteur n a pas le droit metier `can_manage_pricing` (E10.11) requis pour modifier les reglages. */
export class CommercialSettingsAccessDeniedError extends Error {
  constructor(message = 'Le droit can_manage_pricing est requis pour modifier les reglages commerciaux.') {
    super(message);
    this.name = 'CommercialSettingsAccessDeniedError';
  }
}

/**
 * E10.15a — l acteur porte le droit MINIMAL de l operation (`can_manage_pricing`)
 * mais pas `can_manage_notifications`, requis EN PLUS pour ecrire un ou
 * plusieurs des trois champs de notification (contrat §8.23 §2 : « refus au
 * CHAMP pres »). DISTINCT de `CommercialSettingsAccessDeniedError` : la route
 * traduit celle-ci en 403 `identity.capability_required`
 * (`capabilityRequired()`), jamais en `identity.role_required`.
 */
export class CommercialSettingsFieldCapabilityDeniedError extends Error {
  constructor(
    readonly capability: string,
    readonly fields: readonly string[],
    message = `Le droit ${capability} est requis pour modifier : ${fields.join(', ')}.`,
  ) {
    super(message);
    this.name = 'CommercialSettingsFieldCapabilityDeniedError';
  }
}

/**
 * Port (interface) du referentiel Reglages commerciaux. L implementation
 * Supabase vit dans src/adapters/supabase/commercial-settings-repository.ts.
 */
export interface CommercialSettingsRepository {
  /**
   * Lit les reglages du tenant, les CREE IMPLICITEMENT avec les valeurs par
   * defaut s ils n existent pas encore (ressource singleton, contrat
   * `CommercialSettings` : « un tenant en a exactement un »). Ouvert a tout
   * membre du tenant, sans droit metier.
   */
   get(tenantId: TenantId): Promise<CommercialSettingsDto>;

  /**
   * Modifie les reglages (garde `can_manage_pricing` deja verifiee par le
   * service AVANT cet appel). Cree la ligne si elle n existe pas encore
   * (meme semantique que `get`).
   */
  update(tenantId: TenantId, command: UpdateCommercialSettingsCommand): Promise<CommercialSettingsDto>;

  /**
   * Evalue le droit metier `can_manage_pricing` (E10.11) de l acteur dans le
   * tenant. Meme mecanisme que `CommercialQuotesRepository.actorHasCapability`
   * (E10.9/E10.11) — pas partage entre modules par convention du depot (un
   * adaptateur reste autonome), re-implemente ici a l identique.
   */
  actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean>;
}

/**
 * `default_validity_days` du tenant (E10.10a, point 9) est LU DIRECTEMENT en
 * SQL par `api_send_commercial_quote` (meme transaction que la transition de
 * statut et l ecriture d audit, migration `20260906160000_gescom_e10_10a_...`)
 * plutot que par un aller-retour TS depuis `CommercialQuotesService` : ce
 * module N EXPOSE donc AUCUN port de lecture etroit vers `commercial-quotes`
 * — la seule dependance croisee reelle entre les deux domaines est la table
 * elle-meme, lue par la fonction Postgres qui porte deja l atomicite de
 * l envoi. Documente ici pour qu une story future ne (re)cree pas ce port par
 * habitude du pattern `projects`/`priceRules` (dependances TS croisees
 * utilisees ailleurs dans `CommercialQuotesService`).
 */
