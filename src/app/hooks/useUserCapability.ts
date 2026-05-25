/**
 * useUserCapability — Hook React qui interroge le RPC SQL user_has_capability
 * (Sprint 5 S-USERS-REFONTE Phase A, 2026-05-25).
 *
 * Wrap la query Supabase RPC pour déterminer si l'utilisateur courant a une
 * capability donnée via au moins un rôle actif (non révoqué + non archivé)
 * dans le tenant courant.
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

import { useEffect, useState } from 'react';
import { supabase } from '/utils/supabase/client';
import { useTenant } from '../contexts/TenantContext';

export interface UseUserCapabilityResult {
  /** null pendant le chargement initial ; true/false sinon. */
  hasIt: boolean | null;
  loading: boolean;
  error: string | null;
}

export function useUserCapability(capability: string): UseUserCapabilityResult {
  const { currentTenant } = useTenant();
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
      const { data, error: rpcErr } = await supabase.rpc('user_has_capability', {
        p_tenant_id: currentTenant.id,
        p_capability: capability,
      });
      if (cancelled) return;
      if (rpcErr) {
        console.warn('[useUserCapability] RPC failed:', rpcErr.message);
        setError(rpcErr.message);
        setHasIt(false);
      } else {
        setHasIt(Boolean(data));
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentTenant?.id, capability]);

  return { hasIt, loading, error };
}
