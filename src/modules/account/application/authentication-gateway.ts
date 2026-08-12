export type AuthenticationUser = {
  id: string;
  email?: string;
  user_metadata: Record<string, unknown>;
};
export type AuthenticationSession = {
  access_token: string;
  user: AuthenticationUser;
};

export type AuthenticationResult = { error: Error | null; session: AuthenticationSession | null };
export type AuthenticationState = { session: AuthenticationSession | null; user: AuthenticationUser | null };

export interface AuthenticationGateway {
  persistedSession(): Promise<AuthenticationSession | null>;
  verifiedUser(): Promise<{ user: AuthenticationUser | null; error: Error | null }>;
  clearLocalSession(): Promise<void>;
  subscribe(listener: (state: AuthenticationState) => void): () => void;
  signIn(email: string, password: string): Promise<AuthenticationResult>;
  signUp(email: string, password: string, metadata: { fullName: string; company?: string }): Promise<AuthenticationResult>;
  refreshSession(): Promise<AuthenticationResult>;
  signOut(): Promise<void>;
  resetPassword(email: string, redirectTo: string): Promise<{ error: Error | null }>;
  updatePassword(password: string): Promise<{ error: Error | null }>;
  updateProfile(fullName: string): Promise<{ error: Error | null }>;
}
