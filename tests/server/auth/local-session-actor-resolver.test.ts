import { describe, expect, it, vi } from 'vitest';
import {
  CredentialActorResolver,
  LOCAL_AUTH_ISSUER,
  LocalSessionActorResolver,
} from '../../../src/server/auth/local-session-actor-resolver.ts';

const tenantId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const context = { requestId: 'request-1' as never, params: { tenantId } };

describe('resolution des sessions locales', () => {
  it('traduit l utilisateur Better Auth via l annuaire Magrit', async () => {
    const resolve = vi.fn().mockResolvedValue({ userId, tenantId });
    const resolver = new LocalSessionActorResolver({
      getSession: vi.fn().mockResolvedValue({ user: { id: 'better-auth-user' } }),
    }, { resolve });

    await expect(resolver.resolve(new Request('http://api.local'), context))
      .resolves.toEqual({ kind: 'user', userId, tenantId });
    expect(resolve).toHaveBeenCalledWith(
      { issuer: LOCAL_AUTH_ISSUER, subject: 'better-auth-user' },
      tenantId,
    );
  });

  it('ne retombe pas sur le cookie lorsqu un bearer explicite est invalide', async () => {
    const bearer = { resolve: vi.fn().mockResolvedValue(null) };
    const session = { resolve: vi.fn().mockResolvedValue({ kind: 'user', userId, tenantId }) };
    const resolver = new CredentialActorResolver(bearer, session);

    await expect(resolver.resolve(new Request('http://api.local', {
      headers: { authorization: 'Bearer invalid' },
    }), context)).resolves.toBeNull();
    expect(session.resolve).not.toHaveBeenCalled();
  });
});
