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
 *
 * **Correction qa-review round 2 (point BLOQUANT A1/A2)** : `isCheckInFlight`
 * doit lire le MÊME drapeau que celui posé par le `checkCurrent` réellement
 * exécuté, jamais une copie maintenue en parallèle — sinon rien ne garantit
 * qu'ils restent synchronisés (et un test qui maintient sa propre copie ne
 * prouve rien sur le hook). C'est exactement le rôle de `createSessionChecker`
 * ci-dessous : son unique instance porte `isInFlight()`, lue ICI et par
 * `checkCurrent`.
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

export type SessionCheckResult =
  | { outcome: 'resolved'; session: StorefrontSession }
  | { outcome: 'missing' }
  | { outcome: 'unavailable'; cause: unknown };

export interface SessionChecker {
  /** Vrai pendant toute la durée d'un `check()` en cours, y compris son propre échec réseau. */
  isInFlight(): boolean;
  /** N'échoue jamais : toute panne réseau ou 401 se traduit par un résultat discriminé. */
  check(): Promise<SessionCheckResult>;
}

/**
 * BCP-6b (correction qa-review round 2, point BLOQUANT A1/A2) — extrait
 * l'appel réseau ET son drapeau « en vol » dans une fabrique PURE,
 * indépendante de React. Une seule instance par montage du hook
 * (`useStorefrontSession` la crée une fois, via une ref) : `checkCurrent` et
 * le gestionnaire de 401 lisent tous deux CE `isInFlight()`, jamais une copie
 * séparée. Testable de bout en bout avec un vrai `FetchApiClient`, fetch
 * mocké borné (voir `tests/hooks/useStorefrontSession.test.ts`) : le round 1
 * dupliquait ce drapeau dans une variable locale du test, qui ne prouvait
 * rien sur le hook lui-même — corrigé ici en ne laissant plus qu'UNE seule
 * source de vérité, exportée et directement testable.
 */
export function createSessionChecker(params: {
  api: Pick<StorefrontIdentityApiClient, 'current'>;
}): SessionChecker {
  let inFlight = false;
  return {
    isInFlight: () => inFlight,
    async check(): Promise<SessionCheckResult> {
      inFlight = true;
      try {
        const session = await params.api.current();
        return { outcome: 'resolved', session };
      } catch (cause) {
        if (isMissingStorefrontSession(cause)) return { outcome: 'missing' };
        return { outcome: 'unavailable', cause };
      } finally {
        inFlight = false;
      }
    },
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
  // BCP-6b (correction qa-review round 2) — UNE seule instance pour la durée
  // de vie du hook (ref, jamais recréée par un rendu). Son `isInFlight()`
  // est la SEULE source de vérité du drapeau anti-boucle : `checkCurrent`
  // (juste en dessous) et le gestionnaire de 401 (plus bas) lisent tous
  // deux CETTE instance, jamais une copie.
  const checkerRef = useRef<SessionChecker | null>(null);
  if (checkerRef.current === null) checkerRef.current = createSessionChecker({ api });

  const checkCurrent = useCallback(async (blocking: boolean) => {
    const version = ++requestVersion.current;
    if (blocking) setLoading(true);
    const result = await checkerRef.current!.check();
    if (version !== requestVersion.current) return;
    lastRevalidatedAtRef.current = Date.now();
    if (result.outcome === 'resolved') {
      setSessionState(result.session);
      setUnavailable(false);
    } else {
      setSessionState(null);
      setUnavailable(result.outcome === 'unavailable');
    }
    if (version === requestVersion.current) setLoading(false);
  }, []);

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
      isCheckInFlight: () => checkerRef.current!.isInFlight(),
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
