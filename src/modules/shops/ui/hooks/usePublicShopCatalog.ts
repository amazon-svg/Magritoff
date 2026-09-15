import { useStorefrontApi } from '@/platform/runtime/storefront-ui-runtime';
import { ShopsApiClient } from '@/modules/shops';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicShopCatalog, Shop, ShopProduct } from '@/modules/shops';
import type { Gamme, ProductDefinition } from '@/modules/catalog/ui/helpers';
import { DEFAULT_TAX_RATE, getTaxRate } from '@/modules/orders/ui/helpers';
import { resolveShopAccess } from '@/modules/shops/ui/storefront/ShopAccessGuard.helpers';
import { classifyShopLoadFailure } from '@/modules/shops/ui/storefront/shopLoadFailure';

export type PublicShopCatalogStatus =
  | 'loading'
  | 'ready'
  | 'authentication_required'
  | 'not_found'
  | 'unavailable';

export interface PublicShopCatalogState {
  status: PublicShopCatalogStatus;
  shop: Shop | null;
  products: ShopProduct[];
  taxRate: number;
  pimGammes: Gamme[];
  pimDefinitions: ProductDefinition[];
  subscribedSlugs: Set<string> | null;
}

function emptyState(status: PublicShopCatalogStatus): PublicShopCatalogState {
  return {
    status,
    shop: null,
    products: [],
    taxRate: DEFAULT_TAX_RATE,
    pimGammes: [],
    pimDefinitions: [],
    subscribedSlugs: null,
  };
}

export function mapPublicShopCatalog(catalog: PublicShopCatalog): PublicShopCatalogState {
  const source = catalog.shop;
  const shop: Shop = {
    id: source.id, tenant_id: source.tenantId, slug: source.slug, name: source.name,
    description: source.description, theme: source.theme, logo_url: source.logoUrl,
    address: source.address, contact_email: source.contactEmail, active: source.active,
    library_ids: [], excluded_product_ids: [], hero_image_url: source.heroImageUrl,
    tagline: source.tagline, pim_catalog_mode: false, pim_gamme_slugs: [],
    access_mode: source.accessMode, created_at: source.createdAt,
    custom_mockups: catalog.customMockups,
  };
  return {
    status: 'ready',
    shop,
    taxRate: getTaxRate({ tax_regime: catalog.taxRegime }),
    products: catalog.products.map((product) => ({
      id: product.id, shop_id: product.shopId, product_id: product.productId,
      name: product.name, category: product.category, description: product.description,
      price_ht: product.priceHt, image_url: product.imageUrl, config: product.config,
      display_order: product.displayOrder, created_at: product.createdAt,
      tenant_id: product.tenantId, gamme_slug: product.gammeSlug,
    })),
    pimGammes: catalog.gammes as Gamme[],
    pimDefinitions: catalog.definitions as unknown as ProductDefinition[],
    subscribedSlugs: new Set(catalog.subscribedSlugs),
  };
}

/**
 * BCP-6b (CONVENTIONS.md §8.25 point 5.2) — le catalogue change par un geste
 * rare de l'atelier. Un onglet laissé ouvert n'a donc pas à le revoir avant
 * ce délai, même de retour au premier plan.
 */
export const PUBLIC_SHOP_CATALOG_REFRESH_MIN_INTERVAL_MS = 10 * 60_000;

export type PublicShopCatalogRefreshEvent =
  | { type: 'visible'; at: number }
  | { type: 'focus'; at: number };

export interface PublicShopCatalogRefreshState {
  status: PublicShopCatalogStatus;
  lastLoadedAt: number | null;
}

/**
 * Politique pure de rechargement du catalogue public au retour au premier
 * plan (BCP-6b). `focus` ne déclenche jamais rien : seul `visibilitychange`
 * → visible compte. Deux conditions cumulatives (correction qa-review
 * round 1, D1) :
 * - le statut connu doit être `ready` — sinon (chargement en cours, boutique
 *   privée sans session, échec de chargement, boutique introuvable), rien ne
 *   se passe : un premier chargement en échec se rejoue par `retry`, jamais
 *   par un simple retour d'onglet ;
 * - le dernier chargement réussi doit dater de plus de
 *   `PUBLIC_SHOP_CATALOG_REFRESH_MIN_INTERVAL_MS`.
 *
 * Un changement d'identité de session, un `retry` ou un rechargement de page
 * ne passent pas par cette fonction : ce sont des changements de dépendances
 * d'effet React, déjà couverts structurellement par `usePublicShopCatalog`.
 */
export function shouldReloadPublicShopCatalogOnVisible(
  event: PublicShopCatalogRefreshEvent,
  state: PublicShopCatalogRefreshState,
): boolean {
  if (event.type !== 'visible') return false;
  if (state.status !== 'ready') return false;
  if (state.lastLoadedAt === null) return false;
  return event.at - state.lastLoadedAt >= PUBLIC_SHOP_CATALOG_REFRESH_MIN_INTERVAL_MS;
}

export function usePublicShopCatalog({
  slug,
  sessionLoading,
  sessionShopId,
}: {
  slug?: string;
  sessionLoading: boolean;
  sessionShopId: string | null;
}) {
  const api = useStorefrontApi(ShopsApiClient);
  const [state, setState] = useState<PublicShopCatalogState>(() => emptyState('loading'));
  const [attempt, setAttempt] = useState(0);
  // BCP-6b — bascule UNE SEULE FOIS, de false à true, à la première résolution
  // de la session. Les revalidations silencieuses ultérieures de la session
  // (cf. useStorefrontSession) ne la font plus jamais repasser à false, donc
  // ne relancent plus cet effet : seul un changement d'identité (sessionShopId)
  // ou un `retry` (attempt) le fait désormais.
  const [sessionReady, setSessionReady] = useState(false);
  const lastLoadedAtRef = useRef<number | null>(null);
  // BCP-6b (correction qa-review round 1, D2) — incrémenté à chaque
  // (re)lancement ET à chaque nettoyage de l'effet principal (identité,
  // retry, démontage). Une réponse de rechargement déclenchée par le retour
  // au premier plan capture la génération courante à son départ ; si elle
  // change avant que la réponse n'arrive (nouvelle identité en cours), la
  // réponse obsolète est jetée au lieu d'écraser le catalogue de la nouvelle
  // identité.
  const generationRef = useRef(0);
  // BCP-6b (correction qa-review round 1, D1) — lu par l'écouteur
  // `visibilitychange`, qui ne dépend pas du rendu (pas de resouscription à
  // chaque changement d'état).
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!sessionLoading) setSessionReady(true);
  }, [sessionLoading]);

  useEffect(() => {
    if (!slug || !sessionReady) return;
    const generation = ++generationRef.current;
    setState(emptyState('loading'));

    void (async () => {
      let gate;
      try {
        gate = await api.publicProbe(slug);
      } catch (cause) {
        if (generation === generationRef.current) setState(emptyState(classifyShopLoadFailure(cause, 'probe')));
        return;
      }
      if (generation !== generationRef.current) return;

      const access = resolveShopAccess({
        accessMode: gate.accessMode,
        shopId: gate.id,
        storefrontShopId: sessionShopId,
      });
      if (access === 'authentication_required') {
        setState(emptyState('authentication_required'));
        return;
      }

      try {
        const catalog = await api.publicCatalog(slug);
        if (generation !== generationRef.current) return;
        lastLoadedAtRef.current = Date.now();
        setState(mapPublicShopCatalog(catalog));
      } catch (cause) {
        if (generation === generationRef.current) setState(emptyState(classifyShopLoadFailure(cause, 'catalog')));
      }
    })();

    return () => {
      generationRef.current += 1;
    };
  }, [api, attempt, sessionReady, sessionShopId, slug]);

  // BCP-6b — plus aucun intervalle, plus aucun `focus` : seul le retour de
  // l'onglet au premier plan peut recharger le catalogue, et seulement si le
  // statut connu est `ready` et que le dernier chargement dépasse le seuil
  // de fraîcheur (voir la politique pure ci-dessus).
  useEffect(() => {
    if (!slug || !sessionReady) return;
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const shouldReload = shouldReloadPublicShopCatalogOnVisible(
        { type: 'visible', at: Date.now() },
        { status: stateRef.current.status, lastLoadedAt: lastLoadedAtRef.current },
      );
      if (!shouldReload) return;
      const generation = generationRef.current;
      void api.publicCatalog(slug)
        .then((catalog) => {
          if (generation !== generationRef.current) return;
          lastLoadedAtRef.current = Date.now();
          setState(mapPublicShopCatalog(catalog));
        })
        .catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [api, sessionReady, slug]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  return { ...state, retry } as const;
}
