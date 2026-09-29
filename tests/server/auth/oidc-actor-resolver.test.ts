import { describe, expect, it, vi } from 'vitest';
import { OidcActorResolver } from '../../../src/server/auth/oidc-actor-resolver.ts';

const tenantId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';

describe('OidcActorResolver', () => {
  it('resout un bearer valide uniquement via l annuaire des appartenances', async () => {
    const verify = vi.fn().mockResolvedValue({ issuer: 'https://id.example', subject: 'alice' });
    const resolve = vi.fn().mockResolvedValue({ userId, tenantId });
    const resolver = new OidcActorResolver({ verify }, { resolve });

    await expect(resolver.resolve(new Request('https://api.example', {
      headers: { authorization: 'Bearer signed-token' },
    }), context({ tenantId }))).resolves.toEqual({ kind: 'user', userId, tenantId });
    expect(verify).toHaveBeenCalledWith('signed-token');
    expect(resolve).toHaveBeenCalledWith(
      { issuer: 'https://id.example', subject: 'alice' },
      tenantId,
    );
  });

  it('refuse les formats non Bearer et les jetons invalides', async () => {
    const verify = vi.fn().mockResolvedValue(null);
    const resolve = vi.fn();
    const resolver = new OidcActorResolver({ verify }, { resolve });

    await expect(resolver.resolve(new Request('https://api.example'), context({}))).resolves.toBeNull();
    await expect(resolver.resolve(new Request('https://api.example', {
      headers: { authorization: 'Basic secret' },
    }), context({}))).resolves.toBeNull();
    await expect(resolver.resolve(new Request('https://api.example', {
      headers: { authorization: 'Bearer invalid' },
    }), context({}))).resolves.toBeNull();
    expect(resolve).not.toHaveBeenCalled();
  });

  it('refuse une divergence entre tenant du chemin et en-tete', async () => {
    const resolve = vi.fn();
    const resolver = new OidcActorResolver({
      verify: vi.fn().mockResolvedValue({ issuer: 'https://id.example', subject: 'alice' }),
    }, { resolve });

    await expect(resolver.resolve(new Request('https://api.example', {
      headers: {
        authorization: 'Bearer token',
        'x-magrit-tenant': '33333333-3333-4333-8333-333333333333',
      },
    }), context({ tenantId }))).resolves.toBeNull();
    expect(resolve).not.toHaveBeenCalled();
  });
});

function context(params: Readonly<Record<string, string>>) {
  return { requestId: 'request-1' as never, params };
}
