import { useWorkspaceApi, useWorkspaceUiRuntime } from '@/platform/runtime/workspace-ui-runtime';
import { RolesApiClient } from '@/modules/roles';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { UserAccessProfile } from '@/modules/roles';
import { useTenant } from '@/modules/tenants/ui/runtime';
import { resolveCapability } from '@/modules/roles/ui/runtime/accessProfile.helpers';

export interface AccessProfileValue {
  profile: UserAccessProfile | null;
  loading: boolean;
  error: string | null;
  hasCapability: (capability: string) => boolean | null;
  reload: () => void;
}

const AccessProfileContext = createContext<AccessProfileValue | null>(null);

export function AccessProfileProvider({ children }: { children: ReactNode }) {
  const { currentTenant, isSuperAdmin } = useTenant();
  const rolesApi = useWorkspaceApi(RolesApiClient);
  const [profile, setProfile] = useState<UserAccessProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const tenantId = currentTenant?.id ?? null;

  useEffect(() => {
    if (!tenantId) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }
    let current = true;
    setProfile(null);
    setLoading(true);
    setError(null);
    rolesApi.accessProfile(tenantId)
      .then((data) => { if (current) setProfile(data); })
      .catch((cause: unknown) => {
        if (!current) return;
        setError(cause instanceof Error ? cause.message : 'Profil d accès indisponible.');
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [attempt, rolesApi, tenantId]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const value = useMemo<AccessProfileValue>(() => ({
    profile,
    loading,
    error,
    hasCapability: (capability) => resolveCapability(profile, loading, isSuperAdmin, capability),
    reload,
  }), [error, isSuperAdmin, loading, profile, reload]);

  return <AccessProfileContext.Provider value={value}>{children}</AccessProfileContext.Provider>;
}

export function useAccessProfile(): AccessProfileValue {
  const value = useContext(AccessProfileContext);
  if (!value) throw new Error('useAccessProfile requiert AccessProfileProvider.');
  return value;
}
