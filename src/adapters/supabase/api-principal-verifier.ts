/**
 * Implementation Supabase du port `PrincipalVerifier` du socle E10.0.
 *
 * ------------------------------------------------------------------------
 * LE PROBLEME QU IL RESOUT
 * ------------------------------------------------------------------------
 * Le CA4 impose que le tenant vienne du jeton, jamais d un parametre de chemin
 * ou de requete. Mais un JWT Supabase ne porte AUCUN tenant Magrit, et un
 * utilisateur Magrit appartient regulierement a plusieurs espaces : un tenant
 * parent et ses sous-tenants, une agence et ses clients. Le front lui-meme
 * resout l espace courant depuis l URL `/t/:slug` (voir TenantContext), pas
 * depuis la session.
 *
 * Deviner « le » tenant d un utilisateur multi-espaces reviendrait a lui
 * montrer le referentiel client d un autre espace que celui qu il regarde.
 * C est un defaut de confidentialite, pas une approximation d ergonomie.
 *
 * ------------------------------------------------------------------------
 * LA REGLE RETENUE : LE JETON AUTORISE, L EN-TETE SELECTIONNE
 * ------------------------------------------------------------------------
 * - `X-Magrit-Tenant` absent et l utilisateur n a qu un seul espace
 *   accessible -> cet espace.
 * - absent et plusieurs espaces accessibles -> 400
 *   `identity.tenant_selection_required`. On ne devine pas.
 * - present et l utilisateur y a acces -> cet espace.
 * - present et il n y a PAS acces -> 403 `identity.tenant_not_resolved`,
 *   indistinguable d un espace inexistant (ne pas confirmer son existence).
 *
 * L en-tete ne peut donc jamais ELARGIR les droits : il ne fait que choisir
 * parmi ce que le jeton autorise deja, et l habilitation reelle reste tenue
 * par la RLS. C est le sens defendable du CA4 — interdire qu un parametre
 * fasse AUTORITE, ce que faisait `/tenants/{tenantId}/...`. Amendement
 * documente dans docs/api/CONVENTIONS.md §3.4.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseId, type TenantId, type UserId } from '../../kernel/ids/index.ts';
import { TENANT_SELECTION_HEADER } from '../../modules/_shared/api/index.ts';
import {
  problem,
  SHARED_PROBLEM_CODES,
  type ApiCredential,
  type ApiPrincipal,
  type PrincipalVerifier,
  type ServiceScope,
} from '../../modules/_shared/application/index.ts';
import type { Database } from '../../types/database.types.ts';

/** Cle de service d un module tiers (Studio, Clariprint Data). */
export type ServiceKeyRegistration = Readonly<{
  serviceId: string;
  tenantId: string;
  scopes: readonly ServiceScope[];
}>;

export type SupabaseApiPrincipalVerifierOptions = Readonly<{
  /** Lit l en-tete de selection d espace de la requete en cours. */
  requestedTenantId: string | null;
  /**
   * Cles de service connues, indexees par leur valeur secrete. Vide tant
   * qu aucune cle n est emise : la facade reste alors accessible aux seuls
   * jetons utilisateur.
   */
  serviceKeys?: ReadonlyMap<string, ServiceKeyRegistration>;
}>;

export class SupabaseApiPrincipalVerifier implements PrincipalVerifier {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly options: SupabaseApiPrincipalVerifierOptions,
  ) {}

  async verify(credential: ApiCredential): Promise<ApiPrincipal | null> {
    return credential.kind === 'bearer'
      ? this.verifyUser()
      : this.verifyServiceKey(credential.key);
  }

  /** Bearer JWT utilisateur Supabase. */
  private async verifyUser(): Promise<ApiPrincipal | null> {
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user) return null;

    const userId = parseId<'UserId'>(data.user.id);
    if (!userId.ok) return null;

    // E10.5 CA4 — un compte client boutique (`shop_customer_accounts`) n a
    // structurellement pas de membership tenant (CA5, exclusivite posee en
    // base) : sans ce garde-fou explicite, il tomberait dans le cas generique
    // « aucun espace accessible » (`identity.tenant_not_resolved`), qui
    // recouvre AUSSI un utilisateur Magrit legitime pas encore rattache a un
    // espace. Un code distinct nomme la vraie raison du refus.
    if (await this.isShopCustomer()) {
      throw problem({
        status: 403,
        title: 'Compte client boutique',
        code: SHARED_PROBLEM_CODES.scopeForbidden,
        detail: 'Ce compte est un compte client boutique : il n a acces a aucune route reservee au back-office.',
      });
    }

    const tenantId = await this.selectTenant();
    return Object.freeze({ kind: 'user' as const, userId: userId.value as UserId, tenantId });
  }

  /**
   * Meme principe que `current_user_tenant_ids()` : la facade et la RLS
   * partagent la MEME primitive SQL (`current_user_is_shop_customer()`,
   * security definer sur `shop_customer_accounts`, table fermee par defaut).
   */
  private async isShopCustomer(): Promise<boolean> {
    const { data, error } = await this.client.rpc('current_user_is_shop_customer');
    if (error) return false;
    return data === true;
  }

  /**
   * Cle de service : elle porte deja son tenant et ses scopes. L en-tete de
   * selection ne s applique pas — une cle est emise POUR un espace.
   */
  private verifyServiceKey(key: string): ApiPrincipal | null {
    const registration = this.options.serviceKeys?.get(key);
    if (!registration) return null;

    const tenantId = parseId<'TenantId'>(registration.tenantId);
    if (!tenantId.ok) return null;

    return Object.freeze({
      kind: 'service' as const,
      serviceId: registration.serviceId,
      tenantId: tenantId.value as TenantId,
      scopes: Object.freeze([...registration.scopes]),
    });
  }

  /**
   * Espaces accessibles a l utilisateur du jeton. `current_user_tenant_ids()`
   * est la MEME fonction que celle utilisee par les policies RLS : la facade
   * et la base ne peuvent pas etre en desaccord sur ce qui est accessible.
   */
  private async accessibleTenantIds(): Promise<readonly string[]> {
    const { data, error } = await this.client.rpc('current_user_tenant_ids');
    if (error) {
      throw problem({
        status: 503,
        title: 'Espaces accessibles indisponibles',
        code: SHARED_PROBLEM_CODES.tenantNotResolved,
        detail: 'La liste des espaces de l utilisateur n a pas pu etre lue.',
      });
    }
    return (data ?? []).filter((id): id is string => typeof id === 'string');
  }

  private async selectTenant(): Promise<TenantId> {
    const accessible = await this.accessibleTenantIds();
    const requested = this.options.requestedTenantId?.trim() ?? '';

    if (requested.length > 0) {
      if (!accessible.includes(requested)) {
        // Meme reponse qu un espace inexistant : confirmer son existence
        // renseignerait un appelant sur des espaces qui ne le regardent pas.
        throw problem({
          status: 403,
          title: 'Espace inaccessible',
          code: SHARED_PROBLEM_CODES.tenantNotResolved,
          detail: `L espace demande via ${TENANT_SELECTION_HEADER} n est pas accessible.`,
        });
      }
      return brandTenant(requested);
    }

    const only = accessible.length === 1 ? accessible[0] : undefined;
    if (only !== undefined) return brandTenant(only);

    if (accessible.length === 0) {
      throw problem({
        status: 403,
        title: 'Aucun espace accessible',
        code: SHARED_PROBLEM_CODES.tenantNotResolved,
        detail: 'Ce compte n est membre d aucun espace Magrit.',
      });
    }

    throw problem({
      status: 400,
      title: 'Espace a preciser',
      code: SHARED_PROBLEM_CODES.tenantSelectionRequired,
      detail:
        `Ce compte a acces a ${accessible.length} espaces. ` +
        `Preciser lequel via l en-tete ${TENANT_SELECTION_HEADER}.`,
    });
  }
}

function brandTenant(value: string): TenantId {
  const parsed = parseId<'TenantId'>(value);
  if (!parsed.ok) {
    throw problem({
      status: 403,
      title: 'Espace invalide',
      code: SHARED_PROBLEM_CODES.tenantNotResolved,
    });
  }
  return parsed.value as TenantId;
}
