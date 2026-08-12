import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { AuthenticationSession as Session, AuthenticationUser as User } from '../../modules/account';
import { browserAuthenticationGateway as auth } from '../../adapters/supabase/browser-authentication-gateway';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      const persistedSession = await auth.persistedSession();
      if (!persistedSession) {
        if (active) setLoading(false);
        return;
      }

      const { user: verifiedUser, error } = await auth.verifiedUser();
      if (error || !verifiedUser) {
        await auth.clearLocalSession();
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

    const unsubscribe = auth.subscribe(({ session, user }) => {
      setSession(session);
      setUser(user);
      setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    return auth.signIn(email, password);
  };

  const signUp = async (email: string, password: string, fullName?: string, company?: string) => {
    return auth.signUp(email, password, { fullName: fullName ?? '', ...(company ? { company } : {}) });
  };

  const refreshSession = async () => {
    return auth.refreshSession();
  };

  const signOut = async () => {
    await auth.signOut();
  };

  const resetPassword = async (email: string) => {
    return auth.resetPassword(email, `${window.location.origin}/reset-password`);
  };

  const updatePassword = async (newPassword: string) => {
    return auth.updatePassword(newPassword);
  };

  const updateProfile = async ({ fullName }: { fullName: string }) => {
    return auth.updateProfile(fullName);
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
