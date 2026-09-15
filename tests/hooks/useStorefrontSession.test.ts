import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import { ApiClientError, FetchApiClient } from '@/platform/api';
import {
  createSessionChecker,
  createStorefrontUnauthorizedHandler,
  isMissingStorefrontSession,
  shouldRevalidateStorefrontSession,
  STOREFRONT_SESSION_REVALIDATION_MIN_INTERVAL_MS,
  type StorefrontSessionRefreshEvent,
} from '@/modules/shop-customers/ui/hooks/useStorefrontSession';

function apiError(status: number, code: string): ApiClientError {
  return new ApiClientError({
    type: 'about:blank',
    title: 'Erreur storefront',
    status,
    code,
    requestId: 'test-request',
  });
}

describe('useStorefrontSession helpers', () => {
  it('traite uniquement un 401 comme une absence normale de session', () => {
    expect(isMissingStorefrontSession(apiError(401, 'storefront.session_required'))).toBe(true);
  });

  it('ne transforme pas une panne du BFF en visiteur déconnecté', () => {
    expect(isMissingStorefrontSession(apiError(503, 'api.unavailable'))).toBe(false);
    expect(isMissingStorefrontSession(new TypeError('network failed'))).toBe(false);
  });
});

const SECOND = 1_000;
const MINUTE = 60 * SECOND;

// BCP-6b (CONVENTIONS.md §8.25 point 5.2) — politique pure de revalidation de
// session, testée à horloge simulée. Elle remplace le duo `focus` +
// `setInterval(15_000)` mesuré en recette le 2026-09-16.
describe('shouldRevalidateStorefrontSession (BCP-6b)', () => {
  it('un focus ne déclenche jamais rien, quel que soit le passé connu', () => {
    expect(shouldRevalidateStorefrontSession({ type: 'focus', at: 5 * SECOND }, null)).toBe(false);
    expect(shouldRevalidateStorefrontSession({ type: 'focus', at: 5 * SECOND }, 0)).toBe(false);
    expect(shouldRevalidateStorefrontSession({ type: 'focus', at: 2 * MINUTE }, 0)).toBe(false);
  });

  it('un retour au premier plan revalide au plus une fois par minute', () => {
    expect(shouldRevalidateStorefrontSession({ type: 'visible', at: 30 * SECOND }, 0)).toBe(false);
    expect(shouldRevalidateStorefrontSession({ type: 'visible', at: MINUTE - 1 }, 0)).toBe(false);
    expect(shouldRevalidateStorefrontSession({ type: 'visible', at: MINUTE }, 0)).toBe(true);
    expect(shouldRevalidateStorefrontSession({ type: 'visible', at: MINUTE + SECOND }, 0)).toBe(true);
  });

  it('un premier retour au premier plan, sans revalidation connue, revalide toujours', () => {
    expect(shouldRevalidateStorefrontSession({ type: 'visible', at: 0 }, null)).toBe(true);
  });

  it('un 401 déclenche toujours la revalidation, sans délai ni exception', () => {
    expect(shouldRevalidateStorefrontSession({ type: 'unauthorized', at: 1 * SECOND }, null)).toBe(true);
    expect(shouldRevalidateStorefrontSession({ type: 'unauthorized', at: 1 * SECOND }, 999)).toBe(true);
    expect(shouldRevalidateStorefrontSession({ type: 'unauthorized', at: 1 * SECOND }, 1 * SECOND)).toBe(true);
  });

  it('la constante opposable reste 1 minute', () => {
    expect(STOREFRONT_SESSION_REVALIDATION_MIN_INTERVAL_MS).toBe(MINUTE);
  });
});

// BCP-6b — preuve à horloge simulée : la politique d'avant (setInterval(15s),
// tant que l'onglet est visible, sans aucun événement) produit des appels
// SEULEMENT à cause du temps qui passe. La nouvelle politique n'en produit
// jamais sans événement explicite : 60 s de repos, onglet visible, 0 appel.
describe('BCP-6b — horloge simulée, 60 s au repos, onglet visible (canal session)', () => {
  it('la politique d\'avant revalidait 4 fois en 60 s via son setInterval(15 000)', () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const visible = true;
      // Reproduction fidèle du code d'avant BCP-6b (useStorefrontSession.ts,
      // avant ce commit) : un setInterval de 15 s, actif tant qu'une session
      // existe, qui revalide si l'onglet est visible. Ceci n'est PAS du code
      // de production : la fonction ci-dessus ne s'appelle plus ainsi.
      const legacyTimer = setInterval(() => {
        if (visible) calls += 1;
      }, 15_000);
      vi.advanceTimersByTime(60_000);
      clearInterval(legacyTimer);
      expect(calls).toBe(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it('BCP-6b : sans événement, 60 s de repos ne produisent aucun appel (aucun setInterval armé)', () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const events: StorefrontSessionRefreshEvent[] = []; // aucun événement en 60 s de repos
      let lastRevalidatedAt: number | null = 0;
      vi.advanceTimersByTime(60_000);
      for (const event of events) {
        if (shouldRevalidateStorefrontSession(event, lastRevalidatedAt)) {
          calls += 1;
          lastRevalidatedAt = event.at;
        }
      }
      expect(calls).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

function flush(): Promise<void> {
  // Laisse s'écouler les micro-tâches ET macro-tâches en attente (le
  // pipeline reel FetchApiClient.send -> parseResponse -> readJson()
  // enchaîne plusieurs `await`) avant de lire un compteur de test.
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const responseSchema = z.object({ ok: z.boolean() }).optional();

function problemResponse(status: number): Response {
  return new Response(
    JSON.stringify({
      type: 'about:blank',
      title: 'Erreur storefront',
      status,
      code: status === 401 ? 'storefront.session_required' : 'api.error',
      request_id: 'req-test',
    }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

// BCP-6b (correction qa-review round 1, point BLOQUANT) — `createStorefrontUnauthorizedHandler`
// est pure : testée en isolation, sans FetchApiClient ni React.
describe('createStorefrontUnauthorizedHandler (BCP-6b, correction qa-review round 1)', () => {
  it('déclenche checkCurrent(false) sur un événement, si la politique l\'autorise', () => {
    const checkCurrent = vi.fn();
    const handler = createStorefrontUnauthorizedHandler({
      isEnding: () => false,
      isCheckInFlight: () => false,
      getLastRevalidatedAt: () => null,
      now: () => 1_000,
      checkCurrent,
    });

    handler();

    expect(checkCurrent).toHaveBeenCalledTimes(1);
    expect(checkCurrent).toHaveBeenCalledWith(false);
  });

  it('ne déclenche rien si une session est en train de se terminer', () => {
    const checkCurrent = vi.fn();
    const handler = createStorefrontUnauthorizedHandler({
      isEnding: () => true,
      isCheckInFlight: () => false,
      getLastRevalidatedAt: () => null,
      now: () => 1_000,
      checkCurrent,
    });

    handler();

    expect(checkCurrent).not.toHaveBeenCalled();
  });

  it('ne déclenche rien si un checkCurrent est déjà en vol (anti-boucle)', () => {
    const checkCurrent = vi.fn();
    const handler = createStorefrontUnauthorizedHandler({
      isEnding: () => false,
      isCheckInFlight: () => true,
      getLastRevalidatedAt: () => null,
      now: () => 1_000,
      checkCurrent,
    });

    handler();

    expect(checkCurrent).not.toHaveBeenCalled();
  });
});

// BCP-6b (correction qa-review round 2, point BLOQUANT A1/A2) —
// `createSessionChecker` est pure : testée en isolation, sans FetchApiClient
// ni React. C'est la SEULE source de vérité d'`isInFlight()`, partagée par
// `checkCurrent` et par le gestionnaire de 401 (round 1 les dupliquait dans
// deux drapeaux distincts, susceptibles de diverger — voir le round 3).
describe('createSessionChecker (BCP-6b, correction qa-review round 2)', () => {
  it("n'est jamais en vol avant le premier appel", () => {
    const checker = createSessionChecker({ api: { current: () => Promise.resolve({} as never) } });
    expect(checker.isInFlight()).toBe(false);
  });

  it('est en vol PENDANT check(), plus après sa résolution', async () => {
    let resolveCurrent!: (value: never) => void;
    const pending = new Promise<never>((resolve) => { resolveCurrent = resolve; });
    const checker = createSessionChecker({ api: { current: () => pending } });

    const checkPromise = checker.check();
    expect(checker.isInFlight()).toBe(true);
    resolveCurrent({ identity: { kind: 'shop_customer' } } as never);
    await checkPromise;
    expect(checker.isInFlight()).toBe(false);
  });

  it('rend un résultat "resolved" sur un succès', async () => {
    const session = { identity: { kind: 'shop_customer', shopId: 's1' } } as never;
    const checker = createSessionChecker({ api: { current: () => Promise.resolve(session) } });

    await expect(checker.check()).resolves.toEqual({ outcome: 'resolved', session });
  });

  it('rend "missing" sur un 401, "unavailable" sur toute autre panne, sans jamais rejeter', async () => {
    const checkerMissing = createSessionChecker({
      api: { current: () => Promise.reject(apiError(401, 'storefront.session_required')) },
    });
    const checkerDown = createSessionChecker({
      api: { current: () => Promise.reject(new TypeError('network failed')) },
    });

    await expect(checkerMissing.check()).resolves.toEqual({ outcome: 'missing' });
    const downResult = await checkerDown.check();
    expect(downResult.outcome).toBe('unavailable');
  });

  it("reste en vol pendant l'échec aussi (redevient false dans le finally)", async () => {
    const checker = createSessionChecker({
      api: { current: () => Promise.reject(apiError(401, 'storefront.session_required')) },
    });

    const checkPromise = checker.check();
    expect(checker.isInFlight()).toBe(true);
    await checkPromise;
    expect(checker.isInFlight()).toBe(false);
  });
});

/**
 * BCP-6b (correction qa-review round 3, point BLOQUANT A1/A2) — le round 1
 * dupliquait le drapeau anti-boucle dans une variable locale du test
 * (`let checkInFlight = false`), au lieu d'exercer celui posé par le vrai
 * `checkCurrent`/`createSessionChecker` du hook : retirer la garde du VRAI
 * code n'y changeait rien, et le test restait vert (A2). De plus, retirer
 * la garde du GESTIONNAIRE bloquait le worker par récursion de micro-tâches
 * sans jamais lever d'assertion propre (A1).
 *
 * Correction : `createSessionChecker` est la fabrique RÉELLEMENT exportée
 * par `useStorefrontSession.ts`, construite ici sur un vrai `FetchApiClient`
 * dont le faux `fetch` est BORNÉ (`createBoundedUnauthorizedFetch`) — au-delà
 * de N réponses 401, il rend un 500, qui ne notifie plus rien. Si la garde
 * manque (A1 ou A2), la boucle s'arrête donc d'elle-même après N tours, et
 * l'assertion `checkCalls === 1` échoue PROPREMENT (jamais par délai
 * d'attente, jamais par épuisement CPU) — vérifié en secondes, pas en
 * minutes (voir le rapport de fin de story pour la durée mesurée).
 */
function createBoundedUnauthorizedFetch(maxUnauthorizedResponses: number): typeof fetch {
  let calls = 0;
  return (async () => {
    calls += 1;
    return calls <= maxUnauthorizedResponses ? problemResponse(401) : problemResponse(500);
  }) as typeof fetch;
}

describe('câblage FetchApiClient.onUnauthorized -> createSessionChecker (BCP-6b, correction qa-review round 3)', () => {
  it('un 401 d\'une action quelconque déclenche exactement une revalidation de session', async () => {
    const client = new FetchApiClient('https://magrit.test', createBoundedUnauthorizedFetch(5));
    const checker = createSessionChecker({
      api: { current: () => client.request({ path: '/api/v1/storefront/session/current', responseSchema }) },
    });
    let checkCalls = 0;
    const handler = createStorefrontUnauthorizedHandler({
      isEnding: () => false,
      isCheckInFlight: () => checker.isInFlight(),
      getLastRevalidatedAt: () => null,
      now: () => Date.now(),
      checkCurrent: () => { checkCalls += 1; void checker.check(); },
    });
    const unsubscribe = client.onUnauthorized(handler);

    // Un 401 rendu par une action METIER (pas session/current elle-même).
    await client.request({ path: '/api/v1/storefront/orders', responseSchema }).catch(() => undefined);
    await flush();

    expect(checkCalls).toBe(1);
    unsubscribe();
  });

  it('un autre statut (500) ne déclenche aucune revalidation', async () => {
    const client = new FetchApiClient('https://magrit.test', async () => problemResponse(500));
    const checker = createSessionChecker({
      api: { current: () => client.request({ path: '/api/v1/storefront/session/current', responseSchema }) },
    });
    let checkCalls = 0;
    const handler = createStorefrontUnauthorizedHandler({
      isEnding: () => false,
      isCheckInFlight: () => checker.isInFlight(),
      getLastRevalidatedAt: () => null,
      now: () => Date.now(),
      checkCurrent: () => { checkCalls += 1; },
    });
    const unsubscribe = client.onUnauthorized(handler);

    await client.request({ path: '/api/v1/storefront/orders', responseSchema }).catch(() => undefined);
    await flush();

    expect(checkCalls).toBe(0);
    unsubscribe();
  });

  it('pas de boucle si la revalidation elle-même renvoie 401 (session réellement expirée)', async () => {
    // TOUTES les réponses sont 401 jusqu'à la borne (5), puis 500 : si la
    // garde manque, la boucle s'arrête donc à `checkCalls` proche de 5, pas
    // à l'infini — l'assertion `toBe(1)` échoue proprement dans ce cas.
    const client = new FetchApiClient('https://magrit.test', createBoundedUnauthorizedFetch(5));
    const checker = createSessionChecker({
      api: { current: () => client.request({ path: '/api/v1/storefront/session/current', responseSchema }) },
    });
    let checkCalls = 0;
    const handler = createStorefrontUnauthorizedHandler({
      isEnding: () => false,
      isCheckInFlight: () => checker.isInFlight(),
      getLastRevalidatedAt: () => null,
      now: () => Date.now(),
      checkCurrent: () => { checkCalls += 1; void checker.check(); },
    });
    const unsubscribe = client.onUnauthorized(handler);

    await client.request({ path: '/api/v1/storefront/orders', responseSchema }).catch(() => undefined);
    await flush();
    await flush();

    // Le 401 de l'action métier déclenche 1 checkCurrent. Le 401 que
    // checker.check() reçoit ensuite de session/current, LUI-MÊME, ne doit
    // PAS en déclencher un second : `checker.isInFlight()` vaut `true` au
    // moment où ce second 401 est notifié (il l'est de façon synchrone, à
    // l'intérieur de l'`await` que `checker.check()` a lui-même engagé).
    expect(checkCalls).toBe(1);
    unsubscribe();
  });

  it('se désabonne : plus aucune notification après unsubscribe()', async () => {
    const client = new FetchApiClient('https://magrit.test', async () => problemResponse(401));
    let checkCalls = 0;
    const handler = createStorefrontUnauthorizedHandler({
      isEnding: () => false,
      isCheckInFlight: () => false,
      getLastRevalidatedAt: () => null,
      now: () => Date.now(),
      checkCurrent: () => { checkCalls += 1; },
    });
    const unsubscribe = client.onUnauthorized(handler);
    unsubscribe();

    await client.request({ path: '/api/v1/storefront/orders', responseSchema }).catch(() => undefined);
    await flush();

    expect(checkCalls).toBe(0);
  });
});
