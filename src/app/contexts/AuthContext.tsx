import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session, User, UserAttributes } from '@supabase/supabase-js';
import { supabase } from '/utils/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; session: Session | null }>;
  signUp: (email: string, password: string, fullName?: string, company?: string) => Promise<{ error: Error | null; session: Session | null }>;
  refreshSession: () => Promise<{ error: Error | null; session: Session | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  updateProfile: (profile: { fullName: string }) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const auth = supabase.auth;
const updateAuthUser = (attributes: UserAttributes) => auth.updateUser(attributes);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      const { data: { session: persistedSession } } = await auth.getSession();
      if (!persistedSession) {
        if (active) setLoading(false);
        return;
      }

      const { data: { user: verifiedUser }, error } = await auth.getUser();
      if (error || !verifiedUser) {
        await auth.signOut({ scope: 'local' });
        if (active) {
          setSession(null);
          setUser(null);
          setLoading(false);
        }
        return;
      }

      if (active) {
        setSession(persistedSession);
        setUser(verifiedUser);
        setLoading(false);
      }
    };

    void initialize();

    const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await auth.signInWithPassword({ email, password });
    return { error, session: data.session };
  };

  const signUp = async (email: string, password: string, fullName?: string, company?: string) => {
    const { data, error } = await auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName ?? '', ...(company ? { company } : {}) } },
    });
    return { error, session: data.session };
  };

  const refreshSession = async () => {
    const { data, error } = await auth.refreshSession();
    return { error, session: data.session };
  };

  const signOut = async () => {
    await auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await updateAuthUser({ password: newPassword });
    return { error };
  };

  const updateProfile = async ({ fullName }: { fullName: string }) => {
    const { error } = await updateAuthUser({ data: { full_name: fullName } });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, refreshSession, signOut, resetPassword, updatePassword, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
