import type { OidcIdentityDirectory } from '../../adapters/postgres/oidc-identity-directory.ts';
import type { OidcJwtVerifier } from '../../adapters/oidc/jwt-verifier.ts';
import { TENANT_SELECTION_HEADER } from '../../modules/_shared/api/index.ts';
import {
  problem,
  SHARED_PROBLEM_CODES,
  type ApiCredential,
  type ApiPrincipal,
  type PrincipalVerificationContext,
  type PrincipalVerifier,
} from '../../modules/_shared/application/index.ts';
import { LOCAL_AUTH_ISSUER, type LocalSessionReader } from './local-session-actor-resolver.ts';

type LocalApiPrincipalVerifierOptions = Readonly<{
  identities: OidcIdentityDirectory;
  oidc?: Pick<OidcJwtVerifier, 'verify'>;
  sessions?: LocalSessionReader;
}>;

/**
 * Verifie les identites back-office du runtime Node sans SDK Supabase.
 * Le jeton ou la session etablit l identite ; X-Magrit-Tenant ne fait que
 * choisir une appartenance deja accordee par PostgreSQL.
 */
export class LocalApiPrincipalVerifier implements PrincipalVerifier {
  constructor(private readonly options: LocalApiPrincipalVerifierOptions) {}

  async verify(
    credential: ApiCredential,
    context?: PrincipalVerificationContext,
  ): Promise<ApiPrincipal | null> {
    if (credential.kind === 'bearer') {
      if (this.options.oidc === undefined) return null;
      const identity = await this.options.oidc.verify(credential.token);
      return identity === null ? null : this.resolveUser(identity, context);
    }

    if (credential.kind === 'request_session') {
      if (this.options.sessions === undefined || context === undefined) return null;
      const session = await this.options.sessions.getSession({ headers: context.request.headers });
      if (session === null) return null;
      return this.resolveUser(
        { issuer: LOCAL_AUTH_ISSUER, subject: session.user.id },
        context,
      );
    }

    // Les cles de service, sessions boutique et liens de depot seront branches
    // module par module. Ils restent fermes par defaut dans le runtime local.
    return null;
  }

  private async resolveUser(
    identity: Readonly<{ issuer: string; subject: string }>,
    context?: PrincipalVerificationContext,
  ): Promise<ApiPrincipal | null> {
    const requestedTenantId = normalizedHeader(
      context?.request.headers.get(TENANT_SELECTION_HEADER) ?? null,
    );
    const actor = await this.options.identities.resolve(
      identity,
      requestedTenantId ?? undefined,
    );

    if (actor === null) {
      if (requestedTenantId !== null) throw tenantNotResolved();
      return null;
    }
    if (actor.tenantId === undefined) {
      throw problem({
        status: 400,
        title: 'Selection d espace requise',
        code: SHARED_PROBLEM_CODES.tenantSelectionRequired,
        detail: `${TENANT_SELECTION_HEADER} est requis pour un utilisateur appartenant a plusieurs espaces.`,
      });
    }

    return Object.freeze({
      kind: 'user' as const,
      userId: actor.userId,
      tenantId: actor.tenantId,
    });
  }
}

function normalizedHeader(value: string | null): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length === 0 ? null : normalized;
}

function tenantNotResolved() {
  return problem({
    status: 403,
    title: 'Espace inaccessible',
    code: SHARED_PROBLEM_CODES.tenantNotResolved,
    detail: 'Aucun espace accessible ne correspond a la selection.',
  });
}
