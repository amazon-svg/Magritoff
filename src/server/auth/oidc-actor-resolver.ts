import type { OidcJwtVerifier } from '../../adapters/oidc/jwt-verifier.ts';
import type { OidcIdentityDirectory } from '../../adapters/postgres/oidc-identity-directory.ts';
import type { ActorResolver } from '../api/api-v1-handler.ts';

export class OidcActorResolver implements ActorResolver {
  constructor(
    private readonly verifier: Pick<OidcJwtVerifier, 'verify'>,
    private readonly identities: OidcIdentityDirectory,
  ) {}

  async resolve(request: Request, context: Parameters<ActorResolver['resolve']>[1]) {
    const token = bearerToken(request.headers.get('authorization'));
    if (token === null) return null;

    const identity = await this.verifier.verify(token);
    if (identity === null) return null;

    const pathTenant = context.params['tenantId'];
    const headerTenant = normalizedHeader(request.headers.get('x-magrit-tenant'));
    if (pathTenant !== undefined && headerTenant !== null && pathTenant !== headerTenant) return null;

    const actor = await this.identities.resolve(identity, pathTenant ?? headerTenant ?? undefined);
    if (actor === null) return null;
    return Object.freeze({ kind: 'user' as const, ...actor });
  }
}

function bearerToken(value: string | null): string | null {
  if (value === null) return null;
  const match = /^Bearer[ \t]+([^ \t]+)[ \t]*$/i.exec(value);
  return match?.[1] ?? null;
}

function normalizedHeader(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}
