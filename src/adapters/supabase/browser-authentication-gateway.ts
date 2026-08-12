import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../../utils/supabase/client.ts';
import type { AuthenticationGateway } from '../../modules/account/application/authentication-gateway.ts';

export class SupabaseBrowserAuthenticationGateway implements AuthenticationGateway {
  constructor(private readonly client: SupabaseClient) {}

  async persistedSession() {
    const { data } = await this.client.auth.getSession();
    return data.session;
  }
  async verifiedUser() {
    const { data, error } = await this.client.auth.getUser();
    return { user: data.user, error };
  }
  async clearLocalSession() { await this.client.auth.signOut({ scope: 'local' }); }
  subscribe(listener: Parameters<AuthenticationGateway['subscribe']>[0]) {
    const { data: { subscription } } = this.client.auth.onAuthStateChange((event, session) => {
      if (event !== 'INITIAL_SESSION') listener({ session, user: session?.user ?? null });
    });
    return () => subscription.unsubscribe();
  }
  async signIn(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    return { error, session: data.session };
  }
  async signUp(email: string, password: string, metadata: { fullName: string; company?: string }) {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: { data: { full_name: metadata.fullName, ...(metadata.company ? { company: metadata.company } : {}) } },
    });
    return { error, session: data.session };
  }
  async refreshSession() {
    const { data, error } = await this.client.auth.refreshSession();
    return { error, session: data.session };
  }
  async signOut() { await this.client.auth.signOut(); }
  async resetPassword(email: string, redirectTo: string) { const { error } = await this.client.auth.resetPasswordForEmail(email, { redirectTo }); return { error }; }
  async updatePassword(password: string) { const { error } = await this.client.auth.updateUser({ password }); return { error }; }
  async updateProfile(fullName: string) { const { error } = await this.client.auth.updateUser({ data: { full_name: fullName } }); return { error }; }
}

export const browserAuthenticationGateway: AuthenticationGateway = new SupabaseBrowserAuthenticationGateway(supabase);
