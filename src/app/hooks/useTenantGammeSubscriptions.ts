import { useCallback, useEffect, useRef, useState } from 'react';
import type { GammeSubscription } from '../../modules/catalog';
import type { Gamme } from '../utils/productEnrichment';
import { useCatalogApi } from '../contexts/ModuleClientsContext';

export function activeGammeSlugs(
  subscriptions: readonly GammeSubscription[],
): Set<string> {
  return new Set(
    subscriptions.filter((item) => item.active).map((item) => item.gammeSlug),
  );
}

export function gammeSubscriptionError(error: unknown): string {
  return error instanceof Error ? error.message : 'erreur réseau';
}

export function useTenantGammeSubscriptions({
  tenantId,
  canWrite,
  gammes,
}: {
  tenantId: string | null;
  canWrite: boolean;
  gammes: readonly Gamme[];
}) {
  const catalogApi = useCatalogApi();
  const requestVersion = useRef(0);
  const tenantIdRef = useRef(tenantId);
  tenantIdRef.current = tenantId;
  const [activeSlugs, setActiveSlugs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!tenantId) {
      setActiveSlugs(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const subscriptions = await catalogApi.gammeSubscriptions(tenantId);
      if (version === requestVersion.current) {
        setActiveSlugs(activeGammeSlugs(subscriptions));
      }
    } catch (cause) {
      if (version === requestVersion.current) {
        setError(`Chargement impossible : ${gammeSubscriptionError(cause)}`);
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [catalogApi, tenantId]);

  useEffect(() => {
    setSaving(null);
    void refresh();
    return () => {
      requestVersion.current += 1;
    };
  }, [refresh]);

  const setSubscriptions = async (
    savingSlug: string,
    slugs: string[],
    active: boolean,
    fallback: string,
  ) => {
    if (!tenantId || !canWrite) return;
    const operationTenant = tenantId;
    setSaving(savingSlug);
    setError(null);
    try {
      const subscriptions = await catalogApi.setGammeSubscriptions(tenantId, {
        subscriptions: slugs.map((gammeSlug) => ({ gammeSlug, active })),
      });
      if (operationTenant === tenantIdRef.current) {
        setActiveSlugs(activeGammeSlugs(subscriptions));
      }
    } catch (cause) {
      if (operationTenant === tenantIdRef.current) {
        setError(`${fallback} : ${gammeSubscriptionError(cause)}`);
      }
    } finally {
      if (operationTenant === tenantIdRef.current) setSaving(null);
    }
  };

  const toggle = async (slug: string) => {
    await setSubscriptions(slug, [slug], !activeSlugs.has(slug), 'Modification impossible');
  };

  const toggleGroup = async (parentSlug: string) => {
    const children = gammes
      .filter((gamme) => gamme.parent_slug === parentSlug)
      .map((gamme) => gamme.slug);
    const slugs = [parentSlug, ...children];
    await setSubscriptions(
      parentSlug,
      slugs,
      !slugs.every((slug) => activeSlugs.has(slug)),
      'Modification du groupe impossible',
    );
  };

  return { activeSlugs, loading, saving, error, refresh, toggle, toggleGroup } as const;
}
