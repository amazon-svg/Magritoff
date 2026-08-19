import { useCallback, useEffect, useState } from 'react';
import type { StorefrontSession } from '../../modules/shop-customers';
import { ApiClientError } from '../../platform/api';
import { useStorefrontIdentityApi } from '../contexts/StorefrontModuleClientsContext';

export function isMissingStorefrontSession(cause: unknown): boolean {
  return cause instanceof ApiClientError && cause.problem.status === 401;
}

/** Cycle de vie de la session boutique, indépendant de l'identité Magrit. */
export function useStorefrontSession() {
  const api = useStorefrontIdentityApi();
  const [session, setSessionState] = useState<StorefrontSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [ending, setEnding] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setUnavailable(false);
    try {
      setSessionState(await api.current());
    } catch (cause) {
      setSessionState(null);
      if (!isMissingStorefrontSession(cause)) setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setSession = useCallback((next: StorefrontSession) => {
    setUnavailable(false);
    setSessionState(next);
  }, []);

  const end = useCallback(async (): Promise<boolean> => {
    setEnding(true);
    try {
      await api.end();
      setSessionState(null);
      setUnavailable(false);
      return true;
    } catch {
      return false;
    } finally {
      setEnding(false);
    }
  }, [api]);

  return { session, loading, unavailable, ending, refresh, setSession, end } as const;
}
