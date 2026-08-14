/**
 * AccessProfileContext — le profil d accès de l utilisateur dans l espace
 * courant (UM2).
 *
 * UN appel réseau par (utilisateur, espace) : GET /access-profile, dont la
 * réponse alimente toutes les vérifications de capability des écrans. Avant
 * ce provider, chaque `useUserCapability(...)` déclenchait son propre appel —
 * le plan UM (AM4.3) demandait explicitement d éviter un appel réseau par
 * capability.
 *
 * `hasCapability` reproduit la sémantique serveur de `user_has_capability` :
 * super admin → tout ; admin de l espace → tout ; sinon l union des rôles
 * actifs. Le serveur reste seul juge au moment d agir — ce profil ne sert
 * qu à montrer ou masquer, jamais à autoriser.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { FetchApiClient } from '../../platform/api';
import { RolesApiClient, type UserAccessProfile } from '../../modules/roles';
import { resolveCapability } from './accessProfile.helpers';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';

export interface AccessProfileValue {
  /** null tant que le profil n est pas chargé (ou hors espace). */
  profile: UserAccessProfile | null;
  loading: boolean;
  error: string | null;
  /** null pendant le chargement ; ensuite la décision d affichage. */
  hasCapability: (capability: string) => boolean | null;
  reload: () => void;
}

const AccessProfileContext = createContext<AccessProfileValue | null>(null);

export function AccessProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { currentTenant, isSuperAdmin } = useTenant();
  const [profile, setProfile] = useState<UserAccessProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const rolesApi = useMemo(
    () => new RolesApiClient(new FetchApiClient('', globalThis.fetch, () => session?.access_token ?? null)),
    [session?.access_token],
  );

  const tenantId = currentTenant?.id ?? null;

  useEffect(() => {
    if (!tenantId || !session) {
      setProfile(null);
      setLoading(false);
      return;
    }

    // L espace peut changer pendant qu une réponse est en vol : sans ce
    // drapeau, le profil de l ancien espace écraserait celui du nouveau.
    let current = true;
    setLoading(true);
    setError(null);

    rolesApi
      .accessProfile(tenantId)
      .then((data) => {
        if (current) setProfile(data);
      })
      .catch((profileError: unknown) => {
        if (!current) return;
        setProfile(null);
        setError(profileError instanceof Error ? profileError.message : 'Profil d accès indisponible.');
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [tenantId, session, rolesApi, attempt]);

  const value = useMemo<AccessProfileValue>(
    () => ({
      profile,
      loading,
      error,
      hasCapability: (capability: string) => resolveCapability(profile, loading, isSuperAdmin, capability),
      reload: () => setAttempt((n) => n + 1),
    }),
    [profile, loading, error, isSuperAdmin],
  );

  return <AccessProfileContext.Provider value={value}>{children}</AccessProfileContext.Provider>;
}

export function useAccessProfile(): AccessProfileValue {
  const context = useContext(AccessProfileContext);
  if (!context) {
    throw new Error('useAccessProfile doit être appelé sous AccessProfileProvider.');
  }
  return context;
}
