/**
 * LibraryContext — v3 tenant-scoped
 * ─────────────────────────────────
 * Bibliotheques et items par tenant. Quand on change de tenant, la liste
 * est rechargee automatiquement.
 */

import { createContext, useContext, useEffect, useMemo, useState, useCallback, ReactNode } from 'react';
import {
  LibrariesApiClient,
  LibraryProductsApiClient,
  type LibraryProductDto,
  type LibraryProductInput as ApiLibraryProductInput,
  type UpdateLibraryProduct,
} from '../../modules/libraries';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';
import { useApiRuntimeClient } from './ApiRuntimeContext';
import type { Gamme } from '../utils/productEnrichment';
import {
  buildPimGeneratedProducts,
} from '../utils/buildPimGeneratedProducts';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface Library {
  id: string;
  tenant_id?: string;
  user_id?: string;
  name: string;
  description: string;
  created_at?: string;
}

export type LibraryProduct = LibraryProductDto;
export type LibraryProductInput = ApiLibraryProductInput;

interface LibraryContextType {
  libraries: Library[];
  librariesLoading: boolean;
  refreshLibraries: () => Promise<void>;
  createLibrary: (input: { name: string; description?: string }) => Promise<Library | null>;
  updateLibrary: (id: string, patch: Partial<Library>) => Promise<void>;
  deleteLibrary: (id: string) => Promise<void>;

  products: LibraryProduct[];
  loading: boolean;
  refresh: () => Promise<void>;
  addProduct: (data: LibraryProductInput) => Promise<LibraryProduct | null>;
  addProductsBulk: (items: LibraryProductInput[]) => Promise<LibraryProduct[]>;
  /** S2.33 — Genere/regenere les produits vendables depuis les gammes du PIM
   *  (idempotent : remplace les precedents generes, garde les manuels). */
  generateFromPim: (gammes: Gamme[]) => Promise<{ created: number }>;
  /** S2.33 — Supprime les produits generes depuis le PIM (garde les manuels). */
  clearPimGenerated: () => Promise<{ removed: number }>;
  updateProduct: (id: string, patch: Partial<LibraryProduct>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  productsByLibrary: (libraryId: string) => LibraryProduct[];
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const apiClient = useApiRuntimeClient();
  const { currentTenant } = useTenant();
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [librariesLoading, setLibrariesLoading] = useState(false);
  const [products, setProducts] = useState<LibraryProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const librariesApi = useMemo(() => new LibrariesApiClient(apiClient), [apiClient]);
  const productsApi = useMemo(() => new LibraryProductsApiClient(apiClient), [apiClient]);

  // ─── Libraries ──────────────────────────────────────────────────────────
  const refreshLibraries = useCallback(async () => {
    if (!user || !currentTenant) {
      setLibraries([]);
      return;
    }
    setLibrariesLoading(true);
    try {
      setLibraries(await librariesApi.list(currentTenant.id));
    } catch (error) {
      console.error('[Libraries] fetch failed', error);
    } finally {
      setLibrariesLoading(false);
    }
  }, [user, currentTenant?.id, librariesApi]);

  const createLibrary = useCallback(
    async (input: { name: string; description?: string }) => {
      if (!user || !currentTenant) return null;
      try {
        const data = await librariesApi.create(currentTenant.id, {
          name: input.name,
          description: input.description ?? '',
        });
        setLibraries((prev) => [data, ...prev]);
        return data;
      } catch (error) {
        console.error('[Libraries] create failed', error);
        return null;
      }
    },
    [user, currentTenant?.id, librariesApi]
  );

  const updateLibrary = useCallback(
    async (id: string, patch: Partial<Library>) => {
      if (!user || !currentTenant) return;
      try {
        const update: { name?: string; description?: string } = {};
        if (patch.name !== undefined) update.name = patch.name;
        if (patch.description !== undefined) update.description = patch.description;
        const data = await librariesApi.update(currentTenant.id, id, update);
        setLibraries((prev) => prev.map((library) => (library.id === id ? data : library)));
      } catch (error) {
        console.error('[Libraries] update failed', error);
      }
    },
    [user, currentTenant?.id, librariesApi]
  );

  const deleteLibrary = useCallback(
    async (id: string) => {
      if (!user || !currentTenant) return;
      try {
        await librariesApi.remove(currentTenant.id, id);
        setLibraries((prev) => prev.filter((l) => l.id !== id));
        setProducts((prev) => prev.filter((p) => p.library_id !== id));
      } catch (error) {
        console.error('[Libraries] delete failed', error);
      }
    },
    [user, currentTenant?.id, librariesApi]
  );

  // ─── Products ───────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!user || !currentTenant) {
      setProducts([]);
      return;
    }
    setLoading(true);
    try {
      setProducts(await productsApi.list(currentTenant.id));
    } catch (error) {
      console.error('[Library] fetch failed', error);
    } finally {
      setLoading(false);
    }
  }, [user, currentTenant?.id, productsApi]);

  useEffect(() => {
    refreshLibraries();
    refresh();
  }, [refreshLibraries, refresh]);

  const addProduct = useCallback(
    async (data: LibraryProductInput) => {
      if (!user || !currentTenant) return null;
      try {
        const inserted = await productsApi.create(currentTenant.id, data);
        setProducts((prev) => [inserted, ...prev]);
        return inserted;
      } catch (error) {
        console.error('[Library] insert failed', error);
        return null;
      }
    },
    [user, currentTenant?.id, productsApi]
  );

  const addProductsBulk = useCallback(
    async (items: LibraryProductInput[]) => {
      if (!user || !currentTenant || items.length === 0) return [];
      try {
        const inserted = await productsApi.createMany(currentTenant.id, items);
        setProducts((prev) => [...inserted, ...prev]);
        return inserted;
      } catch (error) {
        console.error('[Library] bulk insert failed', error);
        return [];
      }
    },
    [user, currentTenant?.id, productsApi]
  );

  // S2.33 — Materialise des produits vendables depuis les gammes du PIM.
  // Idempotent : on supprime d'abord les produits precedemment generes (marques
  // config.source='pim-generated'), puis on reinsere. Les produits manuels
  // (sans ce marqueur) ne sont jamais touches.
  const generateFromPim = useCallback(
    async (gammes: Gamme[]) => {
      if (!user || !currentTenant || gammes.length === 0) return { created: 0 };
      try {
        const result = await productsApi.replacePimGenerated(currentTenant.id, buildPimGeneratedProducts(gammes));
        await refresh();
        return result;
      } catch (error) {
        console.error('[Library] generateFromPim failed', error);
        return { created: 0 };
      }
    },
    [user, currentTenant?.id, refresh, productsApi]
  );

  const clearPimGenerated = useCallback(async () => {
    if (!user || !currentTenant) return { removed: 0 };
    try {
      const result = await productsApi.clearPimGenerated(currentTenant.id);
      await refresh();
      return result;
    } catch (error) {
      console.error('[Library] clearPimGenerated failed', error);
      return { removed: 0 };
    }
  }, [user, currentTenant?.id, refresh, productsApi]);

  const updateProduct = useCallback(
    async (id: string, patch: Partial<LibraryProduct>) => {
      if (!user || !currentTenant) return;
      try {
        const data = await productsApi.update(currentTenant.id, id, toProductUpdate(patch));
        setProducts((prev) => prev.map((product) => (product.id === id ? data : product)));
      } catch (error) {
        console.error('[Library] update failed', error);
      }
    },
    [user, currentTenant?.id, productsApi]
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      if (!user || !currentTenant) return;
      try {
        await productsApi.remove(currentTenant.id, id);
        setProducts((prev) => prev.filter((product) => product.id !== id));
      } catch (error) {
        console.error('[Library] delete failed', error);
      }
    },
    [user, currentTenant?.id, productsApi]
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
        generateFromPim,
        clearPimGenerated,
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

function toProductUpdate(patch: Partial<LibraryProduct>): UpdateLibraryProduct {
  const update: UpdateLibraryProduct = {};
  if (patch.library_id !== undefined) update.library_id = patch.library_id;
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.price_ht !== undefined) update.price_ht = patch.price_ht;
  if (patch.image_url !== undefined) update.image_url = patch.image_url;
  if (patch.config !== undefined) update.config = patch.config;
  if (patch.active !== undefined) update.active = patch.active;
  if (patch.gamme_slug !== undefined) update.gamme_slug = patch.gamme_slug;
  return update;
}
