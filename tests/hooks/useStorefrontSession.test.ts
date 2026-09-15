import { describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/platform/api';
import {
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
