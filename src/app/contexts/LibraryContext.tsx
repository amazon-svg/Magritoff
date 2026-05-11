/**
 * LibraryContext — v3 tenant-scoped
 * ─────────────────────────────────
 * Bibliotheques et items par tenant. Quand on change de tenant, la liste
 * est rechargee automatiquement.
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '/utils/supabase/client';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface Library {
  id: string;
  tenant_id?: string;
  user_id?: string;
  client_id: string | null;
  name: string;
  description: string;
  created_at?: string;
}

export interface LibraryProduct {
  id: string;
  tenant_id?: string;
  user_id?: string;
  client_id: string | null;
  library_id: string | null;
  name: string;
  category: string;
  description: string;
  price_ht: number;
  image_url: string;
  /** R4 : Record<string, unknown> au lieu de `any`. */
  config: Record<string, unknown>;
  active: boolean;
  created_at?: string;
}

export type LibraryProductInput = Omit<LibraryProduct, 'id' | 'user_id' | 'tenant_id' | 'created_at'>;

interface LibraryContextType {
  libraries: Library[];
  librariesLoading: boolean;
  refreshLibraries: () => Promise<void>;
  createLibrary: (input: { name: string; description?: string; client_id?: string | null }) => Promise<Library | null>;
  updateLibrary: (id: string, patch: Partial<Library>) => Promise<void>;
  deleteLibrary: (id: string) => Promise<void>;

  products: LibraryProduct[];
  loading: boolean;
  refresh: () => Promise<void>;
  addProduct: (data: LibraryProductInput) => Promise<LibraryProduct | null>;
  addProductsBulk: (items: LibraryProductInput[]) => Promise<LibraryProduct[]>;
  updateProduct: (id: string, patch: Partial<LibraryProduct>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  productsByLibrary: (libraryId: string) => LibraryProduct[];
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [librariesLoading, setLibrariesLoading] = useState(false);
  const [products, setProducts] = useState<LibraryProduct[]>([]);
  const [loading, setLoading] = useState(false);

  // ─── Libraries ──────────────────────────────────────────────────────────
  const refreshLibraries = useCallback(async () => {
    if (!user || !currentTenant) {
      setLibraries([]);
      return;
    }
    setLibrariesLoading(true);
    const { data, error } = await supabase
      .from('libraries')
      .select('*')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false });
    if (error) console.error('[Libraries] fetch failed', error.message);
    if (data) setLibraries(data as Library[]);
    setLibrariesLoading(false);
  }, [user, currentTenant?.id]);

  const createLibrary = useCallback(
    async (input: { name: string; description?: string; client_id?: string | null }) => {
      if (!user || !currentTenant) return null;
      const { data, error } = await supabase
        .from('libraries')
        .insert({
          user_id: user.id,
          tenant_id: currentTenant.id,
          name: input.name,
          description: input.description ?? '',
          client_id: input.client_id ?? null,
        })
        .select()
        .single();
      if (error || !data) {
        console.error('[Libraries] create failed', error?.message);
        return null;
      }
      setLibraries((prev) => [data as Library, ...prev]);
      return data as Library;
    },
    [user, currentTenant?.id]
  );

  const updateLibrary = useCallback(
    async (id: string, patch: Partial<Library>) => {
      if (!user || !currentTenant) return;
      const { data, error } = await supabase
        .from('libraries')
        .update(patch)
        .eq('id', id)
        .eq('tenant_id', currentTenant.id)
        .select()
        .single();
      if (error) console.error('[Libraries] update failed', error.message);
      if (data) setLibraries((prev) => prev.map((l) => (l.id === id ? (data as Library) : l)));
    },
    [user, currentTenant?.id]
  );

  const deleteLibrary = useCallback(
    async (id: string) => {
      if (!user || !currentTenant) return;
      const { error } = await supabase
        .from('libraries')
        .delete()
        .eq('id', id)
        .eq('tenant_id', currentTenant.id);
      if (error) console.error('[Libraries] delete failed', error.message);
      else {
        setLibraries((prev) => prev.filter((l) => l.id !== id));
        setProducts((prev) => prev.filter((p) => p.library_id !== id));
      }
    },
    [user, currentTenant?.id]
  );

  // ─── Products ───────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!user || !currentTenant) {
      setProducts([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('product_library')
      .select('*')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false });
    if (error) console.error('[Library] fetch failed', error.message);
    if (data) setProducts(data as LibraryProduct[]);
    setLoading(false);
  }, [user, currentTenant?.id]);

  useEffect(() => {
    refreshLibraries();
    refresh();
  }, [refreshLibraries, refresh]);

  const addProduct = useCallback(
    async (data: LibraryProductInput) => {
      if (!user || !currentTenant) return null;
      const { data: inserted, error } = await supabase
        .from('product_library')
        .insert({ ...data, user_id: user.id, tenant_id: currentTenant.id })
        .select()
        .single();
      if (error || !inserted) {
        console.error('[Library] insert failed', error?.message);
        return null;
      }
      setProducts((prev) => [inserted as LibraryProduct, ...prev]);
      return inserted as LibraryProduct;
    },
    [user, currentTenant?.id]
  );

  const addProductsBulk = useCallback(
    async (items: LibraryProductInput[]) => {
      if (!user || !currentTenant || items.length === 0) return [];
      const rows = items.map((data) => ({
        ...data,
        user_id: user.id,
        tenant_id: currentTenant.id,
      }));
      const { data: inserted, error } = await supabase
        .from('product_library')
        .insert(rows)
        .select();
      if (error || !inserted) {
        console.error('[Library] bulk insert failed', error?.message);
        return [];
      }
      setProducts((prev) => [...(inserted as LibraryProduct[]), ...prev]);
      return inserted as LibraryProduct[];
    },
    [user, currentTenant?.id]
  );

  const updateProduct = useCallback(
    async (id: string, patch: Partial<LibraryProduct>) => {
      if (!user || !currentTenant) return;
      const { data, error } = await supabase
        .from('product_library')
        .update(patch)
        .eq('id', id)
        .eq('tenant_id', currentTenant.id)
        .select()
        .single();
      if (error) console.error('[Library] update failed', error.message);
      if (data) setProducts((prev) => prev.map((p) => (p.id === id ? (data as LibraryProduct) : p)));
    },
    [user, currentTenant?.id]
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      if (!user || !currentTenant) return;
      const { error } = await supabase
        .from('product_library')
        .delete()
        .eq('id', id)
        .eq('tenant_id', currentTenant.id);
      if (error) console.error('[Library] delete failed', error.message);
      else setProducts((prev) => prev.filter((p) => p.id !== id));
    },
    [user, currentTenant?.id]
  );

  const productsByLibrary = useCallback(
    (libraryId: string) => products.filter((p) => p.library_id === libraryId),
    [products]
  );

  return (
    <LibraryContext.Provider
      value={{
        libraries,
        librariesLoading,
        refreshLibraries,
        createLibrary,
        updateLibrary,
        deleteLibrary,
        products,
        loading,
        refresh,
        addProduct,
        addProductsBulk,
        updateProduct,
        deleteProduct,
        productsByLibrary,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within a LibraryProvider');
  return ctx;
}
