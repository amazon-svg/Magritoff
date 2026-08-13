/**
 * useUserCapability — Hook React qui interroge le RPC SQL user_has_capability
 * (Sprint 5 S-USERS-REFONTE Phase A, 2026-05-25).
 *
 * Interroge l'API Magrit pour déterminer si l'utilisateur courant a une
 * capability donnée via au moins un rôle actif (non révoqué + non archivé)
 * dans le tenant courant. Le RPC fournisseur reste confiné à l'adaptateur.
 *
 * Usage type :
 *   const { hasIt, loading } = useUserCapability('can_validate');
 *   if (loading) return <Loader />;
 *   return hasIt ? <ValidateButton /> : null;
 *
 * Performance : 1 query par (tenant, capability). Cache trivial via state
 * React. Si tu as besoin de plusieurs capabilities, fais plusieurs appels —
 * c'est OK car chaque RPC est < 5ms (index sur user_id partiel).
 *
 * Note v1.1 : le RPC retourne true pour super_admin sans check role assignment.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTenant } from '../contexts/TenantContext';
import { RolesApiClient } from '../../modules/roles';
import { useApiRuntimeClient } from '../contexts/ApiRuntimeContext';

export interface UseUserCapabilityResult {
  /** null pendant le chargement initial ; true/false sinon. */
  hasIt: boolean | null;
  loading: boolean;
  error: string | null;
}

export function useUserCapability(capability: string): UseUserCapabilityResult {
  const { currentTenant } = useTenant();
  const apiClient = useApiRuntimeClient();
  const rolesApi = useMemo(() => new RolesApiClient(apiClient), [apiClient]);
  const [hasIt, setHasIt] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentTenant?.id) {
      setHasIt(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const granted = await rolesApi.userCapability(currentTenant.id, capability);
        if (cancelled) return;
        setHasIt(granted);
      } catch (capabilityError) {
        if (cancelled) return;
        const message = capabilityError instanceof Error ? capabilityError.message : 'Vérification de capability impossible.';
        console.warn('[useUserCapability] API failed:', message);
        setError(message);
        setHasIt(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentTenant?.id, capability, rolesApi]);

  return { hasIt, loading, error };
}
