import { useStorefrontApi } from '@/platform/runtime/storefront-ui-runtime';
import { StorefrontIdentityApiClient } from '@/modules/shop-customers';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StorefrontSession } from '@/modules/shop-customers';
import { ApiClientError } from '@/platform/api';

export function isMissingStorefrontSession(cause: unknown): boolean {
  return cause instanceof ApiClientError && cause.problem.status === 401;
}

/**
 * BCP-6b (CONVENTIONS.md §8.25 point 5.2) — la barrière réelle est le
 * serveur : une session expirée est refusée en 401 à la première action.
 * Cet intervalle ne sert qu'à tenir l'en-tête à jour, d'où une tolérance de
 * fraîcheur, pas un seuil métier.
 */
export const STOREFRONT_SESSION_REVALIDATION_MIN_INTERVAL_MS = 60_000;

export type StorefrontSessionRefreshEvent =
  | { type: 'visible'; at: number }
  | { type: 'focus'; at: number }
  | { type: 'unauthorized'; at: number };

/**
 * Politique pure de revalidation silencieuse de la session storefront
 * (BCP-6b). `focus` ne déclenche jamais rien : seul `visibilitychange` →
 * visible compte, et seulement au-delà du délai minimal depuis la dernière
 * revalidation connue. Un 401 déclenche toujours la revalidation, sans délai
 * ni exception.
 */
export function shouldRevalidateStorefrontSession(
  event: StorefrontSessionRefreshEvent,
  lastRevalidatedAt: number | null,
): boolean {
  if (event.type === 'unauthorized') return true;
  if (event.type !== 'visible') return false;
  if (lastRevalidatedAt === null) return true;
  return event.at - lastRevalidatedAt >= STOREFRONT_SESSION_REVALIDATION_MIN_INTERVAL_MS;
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
  // BCP-6b — horodatage de la dernière résolution connue (succès ou échec),
  // utilisé par la politique pure ci-dessus pour espacer les revalidations.
  const lastRevalidatedAtRef = useRef<number | null>(null);

  const checkCurrent = useCallback(async (blocking: boolean) => {
    const version = ++requestVersion.current;
    if (blocking) setLoading(true);
    try {
      const current = await api.current();
      if (version !== requestVersion.current) return;
      lastRevalidatedAtRef.current = Date.now();
      setSessionState(current);
      setUnavailable(false);
    } catch (cause) {
      if (version !== requestVersion.current) return;
      lastRevalidatedAtRef.current = Date.now();
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

  // BCP-6b — plus aucun intervalle, plus aucun `focus` : seul le retour de
  // l'onglet au premier plan peut revalider, et seulement au-delà du délai
  // minimal (voir la politique pure ci-dessus). La revalidation est
  // silencieuse (`blocking = false`) : elle ne bascule jamais `loading`, donc
  // ne relance jamais le catalogue (qui ne dépend plus que de la toute
  // première résolution de session, cf. `usePublicShopCatalog`).
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || endingRequest.current) return;
      const shouldRevalidate = shouldRevalidateStorefrontSession(
        { type: 'visible', at: Date.now() },
        lastRevalidatedAtRef.current,
      );
      if (!shouldRevalidate) return;
      void checkCurrent(false);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [checkCurrent]);

  // BCP-6b — porte d'entrée pour un 401 rencontré par une action storefront
  // (hors périmètre de cette story : les points d'appel restent à brancher
  // par les modules qui portent ces actions). Toujours immédiat, jamais
  // throttlé (cf. politique pure : `unauthorized` retourne toujours `true`).
  const notifyUnauthorized = useCallback(() => {
    if (endingRequest.current) return;
    if (!shouldRevalidateStorefrontSession({ type: 'unauthorized', at: Date.now() }, lastRevalidatedAtRef.current)) {
      return;
    }
    void checkCurrent(false);
  }, [checkCurrent]);

  const setSession = useCallback((next: StorefrontSession) => {
    requestVersion.current += 1;
    lastRevalidatedAtRef.current = Date.now();
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

  return { session, loading, unavailable, ending, refresh, setSession, end, notifyUnauthorized } as const;
}
