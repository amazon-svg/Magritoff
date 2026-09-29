import type { OidcIdentityDirectory } from '../../adapters/postgres/oidc-identity-directory.ts';
import type { ActorResolver } from '../api/api-v1-handler.ts';

export const LOCAL_AUTH_ISSUER = 'urn:magrit:local';

export type LocalSessionReader = Readonly<{
  getSession(options: Readonly<{ headers: Headers }>): Promise<Readonly<{
    user: Readonly<{ id: string }>;
  }> | null>;
}>;

export class LocalSessionActorResolver implements ActorResolver {
  constructor(
    private readonly sessions: LocalSessionReader,
    private readonly identities: OidcIdentityDirectory,
  ) {}

  async resolve(request: Request, context: Parameters<ActorResolver['resolve']>[1]) {
    const session = await this.sessions.getSession({ headers: request.headers });
    if (session === null) return null;
    const pathTenant = context.params['tenantId'];
    const headerTenant = normalizedHeader(request.headers.get('x-magrit-tenant'));
    if (pathTenant !== undefined && headerTenant !== null && pathTenant !== headerTenant) return null;
    const actor = await this.identities.resolve(
      { issuer: LOCAL_AUTH_ISSUER, subject: session.user.id },
      pathTenant ?? headerTenant ?? undefined,
    );
    return actor === null ? null : Object.freeze({ kind: 'user' as const, ...actor });
  }
}

export class CredentialActorResolver implements ActorResolver {
  constructor(
    private readonly bearer: ActorResolver | null,
    private readonly session: ActorResolver | null,
  ) {}

  resolve(request: Request, context: Parameters<ActorResolver['resolve']>[1]) {
    // Une Authorization explicite ne retombe jamais sur un cookie : un bearer
    // invalide doit etre refuse, pas masque par une session navigateur active.
    if (request.headers.has('authorization')) return this.bearer?.resolve(request, context) ?? Promise.resolve(null);
    return this.session?.resolve(request, context) ?? Promise.resolve(null);
  }
}

function normalizedHeader(value: string | null): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length === 0 ? null : normalized;
}
