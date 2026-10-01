import type {
  AuthenticationGateway,
  AuthenticationSession,
  AuthenticationState,
  AuthenticationUser,
} from '../../modules/account/application/authentication-gateway.ts';

type BetterAuthSessionPayload = Readonly<{
  user?: Readonly<{
    id?: unknown;
    email?: unknown;
    name?: unknown;
  }>;
}> | null;

/** Adaptateur navigateur cookie-only : aucun token de session n'est lisible en JS. */
export class BetterAuthBrowserAuthenticationGateway implements AuthenticationGateway {
  private readonly listeners = new Set<(state: AuthenticationState) => void>();
  private readonly fetchImplementation: typeof fetch;
  private readonly basePath: string;

  constructor(
    fetchImplementation: typeof fetch = globalThis.fetch,
    basePath = '/api/v1/auth',
  ) {
    this.fetchImplementation = fetchImplementation.bind(globalThis);
    this.basePath = basePath;
  }

  async persistedSession(): Promise<AuthenticationSession | null> {
    return this.readSession();
  }

  async verifiedUser() {
    try {
      const session = await this.readSession();
      return { user: session?.user ?? null, error: null };
    } catch (cause) {
      return { user: null, error: asError(cause) };
    }
  }

  async clearLocalSession() {
    await this.signOut();
  }

  subscribe(listener: (state: AuthenticationState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async signIn(email: string, password: string) {
    try {
      const response = await this.post('/sign-in/email', { email, password });
      if (!response.ok) return { error: await responseError(response), session: null };
      const session = await this.readSession();
      this.notify(session);
      return { error: null, session };
    } catch (cause) {
      return { error: asError(cause), session: null };
    }
  }

  async signUp(email: string, password: string, metadata: {
    fullName: string;
    invitationToken?: string;
    callbackURL?: string;
  }) {
    try {
      const response = await this.post('/sign-up/email', {
        email,
        password,
        name: metadata.fullName,
        ...(metadata.invitationToken === undefined ? {} : { invitationToken: metadata.invitationToken }),
        ...(metadata.callbackURL === undefined ? {} : { callbackURL: metadata.callbackURL }),
      });
      if (!response.ok) return { error: await responseError(response), session: null };
      // Une inscription publique reste sans session jusqu'au clic sur le lien
      // de verification. Better Auth connecte alors l'utilisateur et le
      // redirige vers l'onboarding ou vers l'invitation d'origine.
      const session = await this.readSession();
      this.notify(session);
      return { error: null, session };
    } catch (cause) {
      return { error: asError(cause), session: null };
    }
  }

  async refreshSession() {
    try {
      const session = await this.readSession();
      this.notify(session);
      return { error: null, session };
    } catch (cause) {
      return { error: asError(cause), session: null };
    }
  }

  async signOut() {
    const response = await this.post('/sign-out', {});
    if (!response.ok) throw await responseError(response);
    this.notify(null);
  }

  async resetPassword(email: string, redirectTo: string) {
    try {
      const response = await this.post('/request-password-reset', { email, redirectTo });
      return { error: response.ok ? null : await responseError(response) };
    } catch (cause) {
      return { error: asError(cause) };
    }
  }

  async updatePassword(password: string, token?: string) {
    if (!token) return { error: new Error('Le lien de réinitialisation est invalide ou incomplet.') };
    try {
      const response = await this.post('/reset-password', { newPassword: password, token });
      return { error: response.ok ? null : await responseError(response) };
    } catch (cause) {
      return { error: asError(cause) };
    }
  }

  async updateProfile(fullName: string) {
    try {
      const response = await this.post('/update-user', { name: fullName });
      if (!response.ok) return { error: await responseError(response) };
      const session = await this.readSession();
      this.notify(session);
      return { error: null };
    } catch (cause) {
      return { error: asError(cause) };
    }
  }

  private async readSession(): Promise<AuthenticationSession | null> {
    const response = await this.fetchImplementation(`${this.basePath}/get-session`, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });
    if (!response.ok) throw await responseError(response);
    const payload = await response.json() as BetterAuthSessionPayload;
    if (payload === null || payload.user === undefined) return null;
    const user = mapUser(payload.user);
    return Object.freeze({ user });
  }

  private post(path: string, body: unknown) {
    return this.fetchImplementation(`${this.basePath}${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
  }

  private notify(session: AuthenticationSession | null) {
    const state = Object.freeze({ session, user: session?.user ?? null });
    for (const listener of this.listeners) listener(state);
  }
}

function mapUser(value: NonNullable<BetterAuthSessionPayload>['user']): AuthenticationUser {
  if (value === undefined || typeof value.id !== 'string' || value.id.length === 0) {
    throw new Error('Session locale invalide : utilisateur absent.');
  }
  return Object.freeze({
    id: value.id,
    ...(typeof value.email === 'string' ? { email: value.email } : {}),
    user_metadata: typeof value.name === 'string' ? { full_name: value.name } : {},
  });
}

async function responseError(response: Response): Promise<Error> {
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  const message = typeof payload?.['message'] === 'string'
    ? payload['message']
    : `Authentification indisponible (${response.status}).`;
  return new Error(message);
}

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error('Authentification indisponible.');
}
