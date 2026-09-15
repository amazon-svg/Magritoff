import { useStorefrontApi, useStorefrontUiRuntime } from '@/platform/runtime/storefront-ui-runtime';
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

/**
 * BCP-6b (correction qa-review round 1, point BLOQUANT) — fabrique le
 * gestionnaire branché sur `FetchApiClient.onUnauthorized()`. Fonction pure,
 * injectée d'états de garde plutôt que de lire des refs directement : elle
 * se teste donc sans React ni DOM, en composant un vrai `FetchApiClient`
 * (voir `tests/hooks/useStorefrontSession.test.ts`).
 *
 * Le hook ne fait que la brancher (principe (b1) d'E10.18e-1) : AUCUNE
 * décision n'est prise dans l'effet lui-même.
 *
 * Anti-boucle : si la revalidation qu'elle déclenche échoue elle-même en
 * 401 (session réellement absente), `isCheckInFlight()` doit déjà répondre
 * `true` au moment où `FetchApiClient` notifie ce même 401 — la notification
 * est synchrone, à l'intérieur du `await` de la requête déclenchée par
 * `checkCurrent`. Le gestionnaire se tait donc lui-même sans throttle ad hoc.
 */
export function createStorefrontUnauthorizedHandler(params: {
  isEnding: () => boolean;
  isCheckInFlight: () => boolean;
  getLastRevalidatedAt: () => number | null;
  now: () => number;
  checkCurrent: (blocking: boolean) => void;
}): () => void {
  return () => {
    if (params.isEnding() || params.isCheckInFlight()) return;
    if (!shouldRevalidateStorefrontSession({ type: 'unauthorized', at: params.now() }, params.getLastRevalidatedAt())) {
      return;
    }
    params.checkCurrent(false);
  };
}

/** Cycle de vie de la session boutique, indépendant de l'identité Magrit. */
export function useStorefrontSession() {
  const { apiClient } = useStorefrontUiRuntime();
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
  // BCP-6b (correction qa-review round 1) — vrai pendant toute la durée d'un
  // `checkCurrent`, y compris son propre appel réseau. Empêche un 401 rendu
  // PAR `api.current()` lui-même de redéclencher un `checkCurrent` imbriqué.
  const checkInFlightRef = useRef(false);

  const checkCurrent = useCallback(async (blocking: boolean) => {
    const version = ++requestVersion.current;
    checkInFlightRef.current = true;
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
      checkInFlightRef.current = false;
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

  // BCP-6b (correction qa-review round 1, point BLOQUANT) — TOUTE action
  // storefront passe par l'`apiClient` unique du runtime (`useStorefrontApi`
  // le mémoïse dessus) : s'abonner ICI à `onUnauthorized()` couvre déjà
  // `useStorefrontOrderLifecycle`, `useStorefrontOrderList`,
  // `useStorefrontOrderEditor`, etc., sans toucher à aucun de ces fichiers.
  useEffect(() => {
    const handler = createStorefrontUnauthorizedHandler({
      isEnding: () => endingRequest.current,
      isCheckInFlight: () => checkInFlightRef.current,
      getLastRevalidatedAt: () => lastRevalidatedAtRef.current,
      now: () => Date.now(),
      checkCurrent: (blocking) => void checkCurrent(blocking),
    });
    return apiClient.onUnauthorized(handler);
  }, [apiClient, checkCurrent]);

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

  return { session, loading, unavailable, ending, refresh, setSession, end } as const;
}
