import { useStorefrontApi, useStorefrontUiRuntime } from '@/platform/runtime/storefront-ui-runtime';
import { StorefrontIdentityApiClient } from '@/modules/shop-customers';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StorefrontSession } from '@/modules/shop-customers';
import { ApiClientError } from '@/platform/api';

export function isMissingStorefrontSession(cause: unknown): boolean {
  return cause instanceof ApiClientError && cause.problem.status === 401;
}

/** Cycle de vie de la session boutique, indépendant de l'identité Magrit. */
export function useStorefrontSession() {
  const api = useStorefrontApi(StorefrontIdentityApiClient);
  const [session, setSessionState] = useState<StorefrontSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [ending, setEnding] = useState(false);
  const requestVersion = useRef(0);
  const endingRequest = useRef(false);

  const checkCurrent = useCallback(async (blocking: boolean) => {
    const version = ++requestVersion.current;
    if (blocking) setLoading(true);
    try {
      const current = await api.current();
      if (version !== requestVersion.current) return;
      setSessionState(current);
      setUnavailable(false);
    } catch (cause) {
      if (version !== requestVersion.current) return;
      setSessionState(null);
      setUnavailable(!isMissingStorefrontSession(cause));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [api]);

  const refresh = useCallback(async () => {
    await checkCurrent(true);
  }, [checkCurrent]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasSession = session !== null;
  useEffect(() => {
    const revalidate = () => {
      if (!endingRequest.current) void checkCurrent(false);
    };
    window.addEventListener('focus', revalidate);
    const timer = hasSession
      ? window.setInterval(() => {
          if (document.visibilityState === 'visible') revalidate();
        }, 15_000)
      : null;
    return () => {
      window.removeEventListener('focus', revalidate);
      if (timer !== null) window.clearInterval(timer);
    };
  }, [checkCurrent, hasSession]);

  const setSession = useCallback((next: StorefrontSession) => {
    requestVersion.current += 1;
    setLoading(false);
    setUnavailable(false);
    setSessionState(next);
  }, []);

  const end = useCallback(async (): Promise<boolean> => {
    const version = ++requestVersion.current;
    endingRequest.current = true;
    setEnding(true);
    try {
      await api.end();
      if (version !== requestVersion.current) return false;
      setSessionState(null);
      setUnavailable(false);
      setLoading(false);
      return true;
    } catch {
      return false;
    } finally {
      endingRequest.current = false;
      setEnding(false);
    }
  }, [api]);

  return { session, loading, unavailable, ending, refresh, setSession, end } as const;
}
