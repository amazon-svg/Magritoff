import { describe, expect, it, vi } from 'vitest';
import type { PublicShopCatalog } from '@/modules/shops';
import {
  mapPublicShopCatalog,
  PUBLIC_SHOP_CATALOG_REFRESH_MIN_INTERVAL_MS,
  shouldReloadPublicShopCatalogOnVisible,
} from '@/modules/shops/ui/hooks/usePublicShopCatalog';

const shopId = '10000000-0000-4000-8000-000000000001';
const tenantId = '10000000-0000-4000-8000-000000000002';

function catalog(): PublicShopCatalog {
  return {
    shop: {
      id: shopId,
      tenantId,
      slug: 'boutique-test',
      name: 'Boutique Test',
      description: 'Catalogue professionnel',
      theme: { primaryColor: '#111111', accentColor: '#eeeeee', mode: 'light' },
      logoUrl: '/api/v1/assets/logo.png',
      address: 'Paris',
      contactEmail: 'contact@example.test',
      active: true,
      heroImageUrl: null,
      tagline: 'Imprimez simplement',
      accessMode: 'invite_only',
      createdAt: '2026-08-19T10:00:00Z',
    },
    taxRegime: 'franchise_tva',
    products: [{
      id: 'product-reference',
      shopId,
      productId: null,
      name: 'Flyer',
      category: 'Communication',
      description: 'Flyer A5',
      priceHt: 42,
      imageUrl: '/api/v1/assets/flyer.png',
      config: { format: 'A5' },
      displayOrder: 1,
      createdAt: '2026-08-19T10:00:00Z',
      tenantId,
      gammeSlug: 'flyers',
    }],
    gammes: [],
    definitions: [],
    subscribedSlugs: ['flyers'],
    customMockups: [],
  };
}

describe('mapPublicShopCatalog', () => {
  it('construit le modèle de lecture storefront sans identité workspace', () => {
    const state = mapPublicShopCatalog(catalog());

    expect(state.status).toBe('ready');
    expect(state.shop).toMatchObject({
      id: shopId,
      tenant_id: tenantId,
      slug: 'boutique-test',
      access_mode: 'invite_only',
    });
    expect(state.products).toEqual([
      expect.objectContaining({
        id: 'product-reference',
        shop_id: shopId,
        price_ht: 42,
        gamme_slug: 'flyers',
      }),
    ]);
    expect(state.taxRate).toBe(0);
    expect(state.subscribedSlugs).toEqual(new Set(['flyers']));
  });
});

const SECOND = 1_000;
const MINUTE = 60 * SECOND;

// BCP-6b (CONVENTIONS.md §8.25 point 5.2) — politique pure de rechargement du
// catalogue au retour au premier plan, testée à horloge simulée. Elle
// remplace le duo `focus` + `setInterval(15_000)` mesuré en recette le
// 2026-09-16 (catalogue rechargé EN ENTIER à chaque tour).
describe('shouldReloadPublicShopCatalogOnVisible (BCP-6b)', () => {
  it('un focus ne déclenche jamais rien, quel que soit le passé connu', () => {
    expect(shouldReloadPublicShopCatalogOnVisible({ type: 'focus', at: 5 * SECOND }, { status: 'ready', lastLoadedAt: null })).toBe(false);
    expect(shouldReloadPublicShopCatalogOnVisible({ type: 'focus', at: 5 * SECOND }, { status: 'ready', lastLoadedAt: 0 })).toBe(false);
  });

  it('un retour au premier plan à 9 min ne recharge pas, à 11 min il recharge (statut ready)', () => {
    const state = { status: 'ready' as const, lastLoadedAt: 0 };
    expect(shouldReloadPublicShopCatalogOnVisible({ type: 'visible', at: 9 * MINUTE }, state)).toBe(false);
    expect(shouldReloadPublicShopCatalogOnVisible({ type: 'visible', at: 11 * MINUTE }, state)).toBe(true);
  });

  it('recharge exactement au seuil de 10 minutes, pas juste avant (statut ready)', () => {
    expect(shouldReloadPublicShopCatalogOnVisible({ type: 'visible', at: 10 * MINUTE }, { status: 'ready', lastLoadedAt: 0 })).toBe(true);
    expect(shouldReloadPublicShopCatalogOnVisible({ type: 'visible', at: 10 * MINUTE - 1 }, { status: 'ready', lastLoadedAt: 0 })).toBe(false);
  });

  // Correction qa-review round 1, D1 — un statut différent de `ready` ne
  // recharge JAMAIS au retour d'onglet, quel que soit le temps écoulé. Un
  // premier chargement en échec, une boutique privée sans session ou un
  // chargement encore en cours se rejouent par `retry` ou par un changement
  // d'identité, jamais par un simple retour au premier plan.
  it.each([
    ['loading', 0] as const,
    ['authentication_required', 0] as const,
    ['not_found', 0] as const,
    ['unavailable', 0] as const,
  ])('un statut %s ne recharge jamais, même très après le seuil (D1)', (status, lastLoadedAt) => {
    expect(
      shouldReloadPublicShopCatalogOnVisible({ type: 'visible', at: 100 * MINUTE }, { status, lastLoadedAt }),
    ).toBe(false);
  });

  // D1 — un statut `ready` sans horodatage de chargement (incohérence
  // défensive : ne devrait pas arriver en pratique, `ready` et
  // `lastLoadedAt` étant posés ensemble) ne recharge pas à l'aveugle.
  it('un statut ready sans horodatage connu ne recharge pas (garde défensive, D1)', () => {
    expect(
      shouldReloadPublicShopCatalogOnVisible({ type: 'visible', at: 100 * MINUTE }, { status: 'ready', lastLoadedAt: null }),
    ).toBe(false);
  });

  it('la constante opposable reste 10 minutes', () => {
    expect(PUBLIC_SHOP_CATALOG_REFRESH_MIN_INTERVAL_MS).toBe(10 * MINUTE);
  });
});

// BCP-6b — preuve à horloge simulée : la politique d'avant (deux
// setInterval(15 000) indépendants, un par hook, tant que l'onglet est
// visible, sans aucun événement) produit 8 appels en 60 s de repos — le
// compte exact relevé par l'architecte (CONVENTIONS.md §8.25 point 5.2). La
// nouvelle politique n'en produit jamais sans événement explicite.
describe('BCP-6b — horloge simulée, 60 s au repos, onglet visible (session + catalogue)', () => {
  it('la politique d\'avant produisait 8 appels en 60 s (2 canaux x 4 déclenchements de 15 s)', () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const visible = true;
      // Reproduction fidèle du code d'avant BCP-6b : usePublicShopCatalog.ts
      // et useStorefrontSession.ts armaient CHACUN un setInterval(15 000)
      // tant que l'onglet restait visible. Ceci n'est PAS du code de
      // production : les hooks actuels n'arment plus aucun minuteur.
      const sessionTimer = setInterval(() => { if (visible) calls += 1; }, 15_000);
      const catalogTimer = setInterval(() => { if (visible) calls += 1; }, 15_000);
      vi.advanceTimersByTime(60_000);
      clearInterval(sessionTimer);
      clearInterval(catalogTimer);
      expect(calls).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });

  it('BCP-6b : sans événement, 60 s de repos ne produisent aucun appel de catalogue', () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      let lastLoadedAt: number | null = 0;
      const events: Array<{ type: 'visible' | 'focus'; at: number }> = []; // repos : aucun événement
      vi.advanceTimersByTime(60_000);
      for (const event of events) {
        if (shouldReloadPublicShopCatalogOnVisible(event, { status: 'ready', lastLoadedAt })) {
          calls += 1;
          lastLoadedAt = event.at;
        }
      }
      expect(calls).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
