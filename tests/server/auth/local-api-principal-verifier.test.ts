import { describe, expect, it, vi } from 'vitest';
import { LocalApiPrincipalVerifier } from '@/server/auth/local-api-principal-verifier';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const TENANT_ID = '20000000-0000-4000-8000-000000000001';

describe('LocalApiPrincipalVerifier', () => {
  it('resout une session Better Auth avec le tenant selectionne', async () => {
    const getSession = vi.fn().mockResolvedValue({ user: { id: 'local-subject' } });
    const resolve = vi.fn().mockResolvedValue({ userId: USER_ID, tenantId: TENANT_ID });
    const verifier = new LocalApiPrincipalVerifier({
      sessions: { getSession },
      identities: { resolve },
    });
    const request = new Request('http://localhost/api/v1/commercial-settings', {
      headers: { cookie: 'better-auth.session_token=opaque', 'x-magrit-tenant': TENANT_ID },
    });

    await expect(verifier.verify({ kind: 'request_session' }, { request })).resolves.toEqual({
      kind: 'user', userId: USER_ID, tenantId: TENANT_ID,
    });
    expect(getSession).toHaveBeenCalledWith({ headers: request.headers });
    expect(resolve).toHaveBeenCalledWith(
      { issuer: 'urn:magrit:local', subject: 'local-subject' },
      TENANT_ID,
    );
  });

  it('exige une selection quand l identite appartient a plusieurs espaces', async () => {
    const verifier = new LocalApiPrincipalVerifier({
      sessions: { getSession: vi.fn().mockResolvedValue({ user: { id: 'local-subject' } }) },
      identities: { resolve: vi.fn().mockResolvedValue({ userId: USER_ID }) },
    });

    const rejection = verifier.verify(
      { kind: 'request_session' },
      { request: new Request('http://localhost/api/v1/commercial-settings', { headers: { cookie: 'session=x' } }) },
    );
    await expect(rejection).rejects.toMatchObject({
      init: { status: 400, code: 'identity.tenant_selection_required' },
    });
  });

  it('refuse sans fuite un tenant selectionne mais inaccessible', async () => {
    const verifier = new LocalApiPrincipalVerifier({
      sessions: { getSession: vi.fn().mockResolvedValue({ user: { id: 'local-subject' } }) },
      identities: { resolve: vi.fn().mockResolvedValue(null) },
    });

    await expect(verifier.verify(
      { kind: 'request_session' },
      { request: new Request('http://localhost/api/v1/commercial-settings', {
        headers: { cookie: 'session=x', 'x-magrit-tenant': TENANT_ID },
      }) },
    )).rejects.toMatchObject({
      init: { status: 403, code: 'identity.tenant_not_resolved' },
    });
  });

  it('verifie aussi un bearer OIDC puis applique le meme annuaire', async () => {
    const verify = vi.fn().mockResolvedValue({ issuer: 'https://idp.example', subject: 'alice' });
    const resolve = vi.fn().mockResolvedValue({ userId: USER_ID, tenantId: TENANT_ID });
    const verifier = new LocalApiPrincipalVerifier({ identities: { resolve }, oidc: { verify } });

    await expect(verifier.verify(
      { kind: 'bearer', token: 'jwt' },
      { request: new Request('http://localhost/api/v1/commercial-settings') },
    )).resolves.toMatchObject({ kind: 'user', tenantId: TENANT_ID });
    expect(verify).toHaveBeenCalledWith('jwt');
  });
});
