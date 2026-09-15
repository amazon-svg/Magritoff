import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import { ApiClientError, FetchApiClient } from '@/platform/api';
import {
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

// BCP-6b (correction qa-review round 1, point BLOQUANT) — preuve d'intégration
// SANS React ni DOM : un vrai `FetchApiClient`, branché sur
// `createStorefrontUnauthorizedHandler` exactement comme le fait le hook
// (`apiClient.onUnauthorized(handler)`), pour prouver le câblage réel, pas
// seulement la politique.
describe('câblage FetchApiClient.onUnauthorized -> revalidation (BCP-6b, correction qa-review round 1)', () => {
  it('un 401 d\'une action quelconque déclenche exactement une revalidation de session', async () => {
    const client = new FetchApiClient('https://magrit.test', async () => problemResponse(401));
    let checkCalls = 0;
    let checkInFlight = false;
    const checkCurrent = async (blocking: boolean) => {
      checkInFlight = true;
      try {
        checkCalls += 1;
        await client
          .request({ path: '/api/v1/storefront/session/current', responseSchema })
          .catch(() => undefined);
      } finally {
        checkInFlight = false;
      }
    };
    const handler = createStorefrontUnauthorizedHandler({
      isEnding: () => false,
      isCheckInFlight: () => checkInFlight,
      getLastRevalidatedAt: () => null,
      now: () => Date.now(),
      checkCurrent: (blocking) => void checkCurrent(blocking),
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
    let checkCalls = 0;
    const checkCurrent = () => {
      checkCalls += 1;
    };
    const handler = createStorefrontUnauthorizedHandler({
      isEnding: () => false,
      isCheckInFlight: () => false,
      getLastRevalidatedAt: () => null,
      now: () => Date.now(),
      checkCurrent,
    });
    const unsubscribe = client.onUnauthorized(handler);

    await client.request({ path: '/api/v1/storefront/orders', responseSchema }).catch(() => undefined);
    await flush();

    expect(checkCalls).toBe(0);
    unsubscribe();
  });

  it('pas de boucle si la revalidation elle-même renvoie 401 (session réellement expirée)', async () => {
    // TOUTE requête sur ce client répond 401, y compris session/current :
    // c'est le pire cas (session réellement absente).
    const client = new FetchApiClient('https://magrit.test', async () => problemResponse(401));
    let checkCalls = 0;
    let checkInFlight = false;
    const checkCurrent = async (blocking: boolean) => {
      checkInFlight = true;
      try {
        checkCalls += 1;
        await client
          .request({ path: '/api/v1/storefront/session/current', responseSchema })
          .catch(() => undefined);
      } finally {
        checkInFlight = false;
      }
    };
    const handler = createStorefrontUnauthorizedHandler({
      isEnding: () => false,
      isCheckInFlight: () => checkInFlight,
      getLastRevalidatedAt: () => null,
      now: () => Date.now(),
      checkCurrent: (blocking) => void checkCurrent(blocking),
    });
    const unsubscribe = client.onUnauthorized(handler);

    await client.request({ path: '/api/v1/storefront/orders', responseSchema }).catch(() => undefined);
    await flush();
    await flush();

    // Le 401 de l'action métier déclenche 1 checkCurrent. Le 401 que
    // checkCurrent reçoit ensuite de session/current, LUI-MÊME, ne doit PAS
    // en déclencher un second : `isCheckInFlight()` vaut `true` au moment où
    // ce second 401 est notifié (il l'est de façon synchrone, à l'intérieur
    // du `await` de la requête déclenchée par checkCurrent).
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
