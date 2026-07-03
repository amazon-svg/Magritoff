import { createClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';
import { getEnv } from './env';

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  token_type: 'bearer';
  user: { id: string; email: string };
}

export async function getSessionForCredentials(
  email: string,
  password: string,
): Promise<AuthSession> {
  const { url, anonKey } = getEnv();
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`signInWithPassword ${email} failed: ${error?.message ?? 'no session'}`);
  }
  return data.session as AuthSession;
}

export async function injectSupabaseSession(page: Page, session: AuthSession): Promise<void> {
  const { projectRef, url } = getEnv();
  const storageKey = `sb-${projectRef}-auth-token`;
  const origin = new URL(page.url() === 'about:blank' ? 'http://localhost:5177' : page.url()).origin;
  await page.addInitScript(
    ({ key, value }) => {
      try {
        localStorage.setItem(key, value);
      } catch {}
    },
    { key: storageKey, value: JSON.stringify(session) },
  );
  void url;
  void origin;
}

export async function loginAs(page: Page, email: string, password: string): Promise<AuthSession> {
  const session = await getSessionForCredentials(email, password);
  await injectSupabaseSession(page, session);
  return session;
}

export function adminClient() {
  const { url, serviceKey } = getEnv();
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
