import { useWorkspaceApi, useWorkspaceUiRuntime } from '@/platform/runtime/workspace-ui-runtime';
import { ShopsApiClient } from '@/modules/shops';
/**
 * ShopsContext — v3 tenant-scoped
 * ───────────────────────────────
 * Les shops (et leurs shop_products) appartiennent a un tenant. Les RLS
 * v3 exigent tenant_id pour insert/select. On denormalise tenant_id sur
 * shop_products a l'insert pour eviter un join a chaque select.
 */
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuth } from '@/modules/account/ui/runtime';
import { useTenant } from '@/modules/tenants/ui/runtime';
import type { Shop, ShopDto, ShopProduct, ShopProductDto, ShopTheme } from '@/modules/shops';

export type { Shop, ShopProduct, ShopTheme } from '@/modules/shops';

export type NewShopInput = {
  name: string;
  description?: string;
  logo_url?: string;
  address?: string;
  contact_email?: string;
  theme?: Partial<ShopTheme>;
  hero_image_url?: string | null;
  tagline?: string | null;
};

interface ShopsContextType {
  shops: Shop[];
  loading: boolean;
  refresh: () => Promise<void>;
  createShop: (input: NewShopInput) => Promise<Shop | null>;
  updateShop: (id: string, patch: Partial<Shop>) => Promise<void>;
  deleteShop: (id: string) => Promise<void>;
  getShopProducts: (shopId: string) => Promise<ShopProduct[]>;
  addShopProduct: (shopId: string, product: Omit<ShopProduct, 'id' | 'shop_id' | 'created_at'>) => Promise<void>;
  updateShopProduct: (shopId: string, id: string, patch: Partial<ShopProduct>) => Promise<void>;
  removeShopProduct: (shopId: string, id: string) => Promise<void>;
  /** Ajoute un product_library.id a shops.excluded_product_ids : masque
   *  ce produit de la boutique sans le supprimer de la bibliotheque. */
  excludeProduct: (shopId: string, libraryProductId: string) => Promise<void>;
  /** Retire un product_library.id de shops.excluded_product_ids (le produit
   *  reapparait dans la boutique si sa bibliotheque est toujours liee). */
  includeProduct: (shopId: string, libraryProductId: string) => Promise<void>;
}

const ShopsContext = createContext<ShopsContextType | undefined>(undefined);

export function ShopsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(false);
  const shopsApi = useWorkspaceApi(ShopsApiClient);

  const refresh = useCallback(async () => {
    if (!user || !currentTenant) {
      setShops([]);
      return;
    }
    setLoading(true);
    try { setShops((await shopsApi.list(currentTenant.id)).map(fromShopDto)); }
    catch (error) { console.error('[Shops] fetch failed', error instanceof Error ? error.message : error); }
    finally { setLoading(false); }
  }, [user, currentTenant?.id, shopsApi]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createShop = async (input: NewShopInput) => {
    if (!user || !currentTenant) return null;
    const created = fromShopDto(await shopsApi.create(currentTenant.id, {
      name: input.name, description: input.description ?? '', logoUrl: input.logo_url ?? '',
      address: input.address ?? '', contactEmail: input.contact_email ?? '',
      theme: input.theme ?? {}, heroImageUrl: input.hero_image_url ?? null, tagline: input.tagline ?? null,
    }));
    setShops((prev) => [created, ...prev]);
    return created;
  };

  const updateShop = async (id: string, patch: Partial<Shop>) => {
    if (!user) return;
    if (!currentTenant) return;
    const updated = fromShopDto(await shopsApi.update(currentTenant.id, id, toUpdateCommand(patch)));
    setShops((prev) => prev.map((shop) => shop.id === id ? updated : shop));
  };

  const deleteShop = async (id: string) => {
    if (!user) return;
    if (!currentTenant) return;
    await shopsApi.remove(currentTenant.id, id);
    setShops((prev) => prev.filter((s) => s.id !== id));
  };

  const getShopProducts = async (shopId: string): Promise<ShopProduct[]> => {
    if (!currentTenant) return [];
    return (await shopsApi.products(currentTenant.id, shopId)).map(fromProductDto);
  };

  const addShopProduct = async (
    shopId: string,
    product: Omit<ShopProduct, 'id' | 'shop_id' | 'created_at'>
  ) => {
    if (!currentTenant) return;
    await shopsApi.addProduct(currentTenant.id, shopId, toCreateProductCommand(product));
  };

  const updateShopProduct = async (shopId: string, id: string, patch: Partial<ShopProduct>) => {
    if (!currentTenant) return;
    await shopsApi.updateProduct(currentTenant.id, shopId, id, toUpdateProductCommand(patch));
  };

  const removeShopProduct = async (shopId: string, id: string) => {
    if (!currentTenant) return;
    await shopsApi.removeProduct(currentTenant.id, shopId, id);
  };

  // Exclusions : ajoute/retire un product_library.id du array
  // shops.excluded_product_ids. Permet de masquer un produit dans une
  // boutique sans le supprimer de la bibliotheque associee.
  const excludeProduct = async (shopId: string, libraryProductId: string) => {
    const target = shops.find((s) => s.id === shopId);
    if (!target) return;
    const current = target.excluded_product_ids ?? [];
    if (current.includes(libraryProductId)) return;
    const next = [...current, libraryProductId];
    await updateShop(shopId, { excluded_product_ids: next });
  };

  const includeProduct = async (shopId: string, libraryProductId: string) => {
    const target = shops.find((s) => s.id === shopId);
    if (!target) return;
    const current = target.excluded_product_ids ?? [];
    if (!current.includes(libraryProductId)) return;
    const next = current.filter((id) => id !== libraryProductId);
    await updateShop(shopId, { excluded_product_ids: next });
  };

  return (
    <ShopsContext.Provider
      value={{
        shops,
        loading,
        refresh,
        createShop,
        updateShop,
        deleteShop,
        getShopProducts,
        addShopProduct,
        updateShopProduct,
        removeShopProduct,
        excludeProduct,
        includeProduct,
      }}
    >
      {children}
    </ShopsContext.Provider>
  );
}

function fromShopDto(shop: ShopDto): Shop { return { id: shop.id, owner_user_id: shop.ownerUserId, tenant_id: shop.tenantId, slug: shop.slug, name: shop.name, description: shop.description, theme: shop.theme, logo_url: shop.logoUrl, address: shop.address, contact_email: shop.contactEmail, active: shop.active, library_ids: shop.libraryIds, excluded_product_ids: shop.excludedProductIds, hero_image_url: shop.heroImageUrl, tagline: shop.tagline, pim_catalog_mode: shop.pimCatalogMode, pim_gamme_slugs: shop.pimGammeSlugs, access_mode: shop.accessMode, created_at: shop.createdAt }; }
function fromProductDto(product: ShopProductDto): ShopProduct { return { id: product.id, shop_id: product.shopId, product_id: product.productId, name: product.name, category: product.category, description: product.description, price_ht: product.priceHt, image_url: product.imageUrl, config: product.config, display_order: product.displayOrder, created_at: product.createdAt, tenant_id: product.tenantId, gamme_slug: product.gammeSlug }; }
function toUpdateCommand(patch: Partial<Shop>) { return { name: patch.name, description: patch.description, logoUrl: patch.logo_url, address: patch.address, contactEmail: patch.contact_email, theme: patch.theme, active: patch.active, libraryIds: patch.library_ids, excludedProductIds: patch.excluded_product_ids, heroImageUrl: patch.hero_image_url, tagline: patch.tagline, pimCatalogMode: patch.pim_catalog_mode, pimGammeSlugs: patch.pim_gamme_slugs, accessMode: patch.access_mode }; }
function toCreateProductCommand(product: Omit<ShopProduct, 'id' | 'shop_id' | 'created_at'>) {
  return { productId: product.product_id, name: product.name, category: product.category, description: product.description, priceHt: product.price_ht, imageUrl: product.image_url, config: product.config, displayOrder: product.display_order, gammeSlug: product.gamme_slug ?? null };
}
function toUpdateProductCommand(product: Partial<ShopProduct>) {
  return Object.fromEntries(Object.entries({ productId: product.product_id, name: product.name, category: product.category, description: product.description, priceHt: product.price_ht, imageUrl: product.image_url, config: product.config, displayOrder: product.display_order, gammeSlug: product.gamme_slug }).filter(([, value]) => value !== undefined));
}

export function useShops() {
  const ctx = useContext(ShopsContext);
  if (!ctx) throw new Error('useShops must be used within a ShopsProvider');
  return ctx;
}
