/**
 * ShopsContext — v3 tenant-scoped
 * ───────────────────────────────
 * Les shops (et leurs shop_products) appartiennent a un tenant. Les RLS
 * v3 exigent tenant_id pour insert/select. On denormalise tenant_id sur
 * shop_products a l'insert pour eviter un join a chaque select.
 */
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '/utils/supabase/client';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';

export interface ShopTheme {
  primaryColor: string;
  accentColor: string;
  mode: 'light' | 'dark';
  /** A4.2 — Couleur secondaire (highlights, badges). Optionnel pour back-compat. */
  secondaryColor?: string;
  /** A4.2 — Override couleur texte principale. */
  textColor?: string;
  /** A4.2 — Override couleur fond principal. */
  bgColor?: string;
  /** A4.2 — Clé d'un pairing de fonts curated (cf. fontPairings.ts). */
  fontPairing?: string;
}

export interface Shop {
  id: string;
  owner_user_id?: string;
  slug: string;
  name: string;
  description: string;
  theme: ShopTheme;
  logo_url: string;
  address: string;
  contact_email: string;
  active: boolean;
  library_ids: string[];
  excluded_product_ids: string[];
  /** A4.1 — URL image affichée en tête de boutique publique (null = pas de bannière). */
  hero_image_url: string | null;
  /** A4.1 — Phrase courte en overlay du hero (max 120 char côté UI). */
  tagline: string | null;
  created_at?: string;
}

export interface ShopProduct {
  id: string;
  shop_id: string;
  product_id: string | null;
  name: string;
  category: string;
  description: string;
  price_ht: number;
  image_url: string;
  /** R4 : Record<string, unknown> au lieu de `any` pour beneficier du TS narrowing. */
  config: Record<string, unknown>;
  display_order: number;
  created_at?: string;
  /** R4 : tenant_id ajoute par migration 20260424_02. */
  tenant_id?: string | null;
}

const DEFAULT_THEME: ShopTheme = {
  primaryColor: '#1e3a8a',
  accentColor: '#f59e0b',
  mode: 'light',
  secondaryColor: '#6b7280',
  textColor: '#0f172a',
  bgColor: '#ffffff',
  fontPairing: 'system',
};

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
  updateShopProduct: (id: string, patch: Partial<ShopProduct>) => Promise<void>;
  removeShopProduct: (id: string) => Promise<void>;
  /** Ajoute un product_library.id a shops.excluded_product_ids : masque
   *  ce produit de la boutique sans le supprimer de la bibliotheque. */
  excludeProduct: (shopId: string, libraryProductId: string) => Promise<void>;
  /** Retire un product_library.id de shops.excluded_product_ids (le produit
   *  reapparait dans la boutique si sa bibliotheque est toujours liee). */
  includeProduct: (shopId: string, libraryProductId: string) => Promise<void>;
}

const ShopsContext = createContext<ShopsContextType | undefined>(undefined);

function randomSlug(): string {
  const part = () => Math.random().toString(36).slice(2, 8);
  return `${part()}-${part()}`;
}

export function ShopsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !currentTenant) {
      setShops([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false });
    if (error) console.error('[Shops] fetch failed', error.message);
    if (data) setShops(data as Shop[]);
    setLoading(false);
  }, [user, currentTenant?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createShop = async (input: NewShopInput) => {
    if (!user || !currentTenant) return null;
    const { data, error } = await supabase
      .from('shops')
      .insert({
        owner_user_id: user.id,
        tenant_id: currentTenant.id,
        slug: randomSlug(),
        name: input.name,
        description: input.description ?? '',
        logo_url: input.logo_url ?? '',
        address: input.address ?? '',
        contact_email: input.contact_email ?? '',
        theme: { ...DEFAULT_THEME, ...(input.theme ?? {}) },
        active: true,
        library_ids: [],
        excluded_product_ids: [],
        hero_image_url: input.hero_image_url ?? null,
        tagline: input.tagline ?? null,
      })
      .select()
      .single();
    if (error || !data) {
      console.error('[Shops] create failed', {
        message: error?.message,
        details: (error as any)?.details,
        hint: (error as any)?.hint,
        code: (error as any)?.code,
      });
      throw new Error(error?.message || 'Impossible de créer la boutique');
    }
    setShops((prev) => [data as Shop, ...prev]);
    return data as Shop;
  };

  const updateShop = async (id: string, patch: Partial<Shop>) => {
    if (!user) return;
    console.log('[Shops] update', { id, patch });
    const { data, error } = await supabase
      .from('shops')
      .update(patch)
      .eq('id', id)
      .eq('owner_user_id', user.id)
      .select()
      .single();
    if (error) {
      console.error('[Shops] update failed', {
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
      });
      throw new Error(error.message);
    }
    if (data) {
      console.log('[Shops] update ok', { returned: data });
      setShops((prev) => prev.map((s) => (s.id === id ? (data as Shop) : s)));
    }
  };

  const deleteShop = async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('shops')
      .delete()
      .eq('id', id)
      .eq('owner_user_id', user.id);
    if (error) console.error('[Shops] delete failed', error.message);
    else setShops((prev) => prev.filter((s) => s.id !== id));
  };

  const getShopProducts = async (shopId: string): Promise<ShopProduct[]> => {
    const { data, error } = await supabase
      .from('shop_products')
      .select('*')
      .eq('shop_id', shopId)
      .order('display_order', { ascending: true });
    if (error) {
      console.error('[Shops] fetch products failed', error.message);
      return [];
    }
    return (data ?? []) as ShopProduct[];
  };

  const addShopProduct = async (
    shopId: string,
    product: Omit<ShopProduct, 'id' | 'shop_id' | 'created_at'>
  ) => {
    if (!currentTenant) return;
    const { error } = await supabase
      .from('shop_products')
      .insert({ ...product, shop_id: shopId, tenant_id: currentTenant.id });
    if (error) console.error('[Shops] add product failed', error.message);
  };

  const updateShopProduct = async (id: string, patch: Partial<ShopProduct>) => {
    const { error } = await supabase.from('shop_products').update(patch).eq('id', id);
    if (error) console.error('[Shops] update product failed', error.message);
  };

  const removeShopProduct = async (id: string) => {
    const { error } = await supabase.from('shop_products').delete().eq('id', id);
    if (error) console.error('[Shops] remove product failed', error.message);
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

export function useShops() {
  const ctx = useContext(ShopsContext);
  if (!ctx) throw new Error('useShops must be used within a ShopsProvider');
  return ctx;
}
