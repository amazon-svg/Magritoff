import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/modules/account/ui/runtime/AuthContext';
import { useSessionBootstrap } from '@/modules/session/ui/runtime';

import type { Plan } from '@/modules/plans/ui/helpers';

export interface UserPreferences {
  theme: 'light' | 'dark';
  language: 'fr' | 'en';
  default_delivery_zone: string;
  notifications_email: boolean;
  plan: Plan;
  is_admin: boolean;
}

const DEFAULTS: UserPreferences = {
  theme: 'light',
  language: 'fr',
  default_delivery_zone: 'FR-75',
  notifications_email: true,
  plan: 'freemium',
  is_admin: false,
};

interface PreferencesContextType {
  prefs: UserPreferences;
  loading: boolean;
  update: (patch: Partial<UserPreferences>) => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const bootstrap = useSessionBootstrap();
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULTS);

  useEffect(() => {
    if (!user?.id) {
      const local = localStorage.getItem('magrit_prefs');
      if (local) {
        try { setPrefs({ ...DEFAULTS, ...JSON.parse(local) }); } catch {}
      } else {
        setPrefs(DEFAULTS);
      }
      return;
    }
    if (bootstrap.data?.user.id === user.id) {
      setPrefs({ ...DEFAULTS, ...bootstrap.data.preferences });
    } else {
      setPrefs(DEFAULTS);
    }
  }, [bootstrap.data, user?.id]);

  const update = async (patch: Partial<UserPreferences>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);

    if (!user) {
      localStorage.setItem('magrit_prefs', JSON.stringify(next));
      return;
    }

    try {
      await bootstrap.updatePreferences(patch);
    } catch (error) {
      setPrefs(prefs);
      console.error('[Prefs] API update failed', error);
    }
  };

  return (
    <PreferencesContext.Provider value={{ prefs, loading: !!user && bootstrap.loading, update }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within a PreferencesProvider');
  return ctx;
}
