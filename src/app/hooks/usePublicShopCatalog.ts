import { useCallback, useEffect, useState } from 'react';
import type { PublicShopCatalog, Shop, ShopProduct } from '../../modules/shops';
import type { Gamme, ProductDefinition } from '../utils/productEnrichment';
import { DEFAULT_TAX_RATE, getTaxRate } from '../utils/tax';
import { useStorefrontShopsApi } from '../contexts/StorefrontModuleClientsContext';
import { resolveShopAccess } from '../components/shop/ShopAccessGuard.helpers';
import { classifyShopLoadFailure } from '../components/shop/shopLoadFailure';

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

export function usePublicShopCatalog({
  slug,
  sessionLoading,
  sessionShopId,
}: {
  slug?: string;
  sessionLoading: boolean;
  sessionShopId: string | null;
}) {
  const api = useStorefrontShopsApi();
  const [state, setState] = useState<PublicShopCatalogState>(() => emptyState('loading'));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!slug || sessionLoading) return;
    let cancelled = false;
    let focusHandler: (() => void) | null = null;
    let refreshTimer: number | null = null;
    setState(emptyState('loading'));

    void (async () => {
      let gate;
      try {
        gate = await api.publicProbe(slug);
      } catch (cause) {
        if (!cancelled) setState(emptyState(classifyShopLoadFailure(cause, 'probe')));
        return;
      }
      if (cancelled) return;

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
        if (cancelled) return;
        setState(mapPublicShopCatalog(catalog));
      } catch (cause) {
        if (!cancelled) setState(emptyState(classifyShopLoadFailure(cause, 'catalog')));
        return;
      }

      focusHandler = () => {
        void api.publicCatalog(slug)
          .then((catalog) => { if (!cancelled) setState(mapPublicShopCatalog(catalog)); })
          .catch(() => undefined);
      };
      window.addEventListener('focus', focusHandler);
      refreshTimer = window.setInterval(() => {
        if (document.visibilityState === 'visible') focusHandler?.();
      }, 15_000);
    })();

    return () => {
      cancelled = true;
      if (focusHandler) window.removeEventListener('focus', focusHandler);
      if (refreshTimer !== null) window.clearInterval(refreshTimer);
    };
  }, [api, attempt, sessionLoading, sessionShopId, slug]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  return { ...state, retry } as const;
}
