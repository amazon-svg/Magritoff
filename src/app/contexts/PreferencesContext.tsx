import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '/utils/supabase/client';
import { useAuth } from './AuthContext';

import type { Plan } from '../utils/plans';

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
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULTS);
  const [loading, setLoading] = useState(false);

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

    let cancelled = false;
    setLoading(true);
    supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error('[Prefs] fetch failed', error.message);
        if (data) {
          setPrefs({ ...DEFAULTS, ...data });
        } else {
          setPrefs(DEFAULTS);
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [user?.id]);

  const update = async (patch: Partial<UserPreferences>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);

    if (!user) {
      localStorage.setItem('magrit_prefs', JSON.stringify(next));
      return;
    }

    console.log('[Prefs] upsert attempt', { userId: user.id, patch });

    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({ user_id: user.id, ...next }, { onConflict: 'user_id' })
      .select()
      .maybeSingle();

    if (error) {
      console.error('[Prefs] upsert failed', {
        patch,
        code: (error as any).code,
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
      });
      const { data: fresh } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (fresh) setPrefs({ ...DEFAULTS, ...fresh });
      return;
    }

    console.log('[Prefs] upsert ok', { returned: data });
    if (data) setPrefs({ ...DEFAULTS, ...data });
  };

  return (
    <PreferencesContext.Provider value={{ prefs, loading, update }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within a PreferencesProvider');
  return ctx;
}
