import { describe, expect, it, vi } from 'vitest';
import { BetterAuthBrowserAuthenticationGateway } from '../../../src/adapters/better-auth/browser-authentication-gateway.ts';

const user = { id: 'user-1', email: 'dev@example.test', name: 'Dev Magrit' };

describe('BetterAuthBrowserAuthenticationGateway', () => {
  it('lit une session cookie sans exposer de bearer au navigateur', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ user, session: { id: 'session-1' } }));
    const gateway = new BetterAuthBrowserAuthenticationGateway(fetchMock);

    await expect(gateway.persistedSession()).resolves.toEqual({
      user: {
        id: 'user-1',
        email: 'dev@example.test',
        user_metadata: { full_name: 'Dev Magrit' },
      },
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/get-session', expect.objectContaining({
      credentials: 'same-origin',
    }));
  });

  it('notifie le contexte apres connexion et deconnexion', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ token: null, user }))
      .mockResolvedValueOnce(Response.json({ user, session: { id: 'session-1' } }))
      .mockResolvedValueOnce(Response.json({ success: true }));
    const gateway = new BetterAuthBrowserAuthenticationGateway(fetchMock);
    const listener = vi.fn();
    gateway.subscribe(listener);

    await expect(gateway.signIn('dev@example.test', 'mot-de-passe'))
      .resolves.toMatchObject({ error: null, session: { user: { id: 'user-1' } } });
    await gateway.signOut();

    expect(listener).toHaveBeenNthCalledWith(1, expect.objectContaining({
      user: expect.objectContaining({ id: 'user-1' }),
    }));
    expect(listener).toHaveBeenNthCalledWith(2, { session: null, user: null });
  });

  it('maintient la creation de compte sur invitation uniquement', async () => {
    const gateway = new BetterAuthBrowserAuthenticationGateway(vi.fn());
    const result = await gateway.signUp('new@example.test', 'mot-de-passe', { fullName: 'New' });

    expect(result.session).toBeNull();
    expect(result.error?.message).toMatch(/invitation/);
  });

  it('cree puis connecte un compte portant un jeton d invitation', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ token: null, user }))
      .mockResolvedValueOnce(Response.json({ token: null, user }))
      .mockResolvedValueOnce(Response.json({ user, session: { id: 'session-1' } }));
    const gateway = new BetterAuthBrowserAuthenticationGateway(fetchMock);

    await expect(gateway.signUp('new@example.test', 'mot-de-passe-solide', {
      fullName: 'New', invitationToken: 'invitation-token',
    })).resolves.toMatchObject({ error: null, session: { user: { id: 'user-1' } } });
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/auth/sign-up/email', expect.objectContaining({
      body: JSON.stringify({
        email: 'new@example.test',
        password: 'mot-de-passe-solide',
        name: 'New',
        invitationToken: 'invitation-token',
      }),
    }));
  });

  it('retourne une erreur serveur stable sans perdre le message utile', async () => {
    const gateway = new BetterAuthBrowserAuthenticationGateway(vi.fn().mockResolvedValue(
      Response.json({ message: 'Invalid email or password' }, { status: 401 }),
    ));

    const result = await gateway.signIn('dev@example.test', 'incorrect');

    expect(result.session).toBeNull();
    expect(result.error?.message).toBe('Invalid email or password');
  });
});
