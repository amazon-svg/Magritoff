import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '/utils/supabase/client';
import type { Gamme, ProductDefinition } from '../utils/productEnrichment';

interface PIMContextType {
  gammes: Gamme[];
  definitions: ProductDefinition[];
  loading: boolean;
  refresh: () => Promise<void>;
  upsertGamme: (input: Partial<Gamme> & { slug: string; name: string }) => Promise<Gamme | null>;
  deleteGamme: (slug: string) => Promise<boolean>;
  upsertDefinition: (input: Partial<ProductDefinition> & { gamme_slug: string; locale: string }) => Promise<ProductDefinition | null>;
  deleteDefinition: (id: string) => Promise<boolean>;
}

const PIMContext = createContext<PIMContextType | undefined>(undefined);

export function PIMProvider({ children }: { children: ReactNode }) {
  const [gammes, setGammes] = useState<Gamme[]>([]);
  const [definitions, setDefinitions] = useState<ProductDefinition[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [gammesRes, defsRes] = await Promise.all([
      supabase.from('product_gammes').select('*').order('display_order'),
      supabase.from('product_definitions').select('*'),
    ]);
    if (gammesRes.error) console.error('[PIM] gammes fetch failed', gammesRes.error.message);
    if (defsRes.error) console.error('[PIM] definitions fetch failed', defsRes.error.message);
    if (gammesRes.data) setGammes(gammesRes.data as Gamme[]);
    if (defsRes.data) setDefinitions(defsRes.data as ProductDefinition[]);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const upsertGamme = async (input: Partial<Gamme> & { slug: string; name: string }) => {
    const { data, error } = await supabase
      .from('product_gammes')
      .upsert(input, { onConflict: 'slug' })
      .select()
      .single();
    if (error) {
      console.error('[PIM] upsertGamme failed', error.message);
      return null;
    }
    setGammes((prev) => {
      const idx = prev.findIndex((g) => g.slug === (data as Gamme).slug);
      if (idx >= 0) return prev.map((g) => (g.slug === (data as Gamme).slug ? (data as Gamme) : g));
      return [...prev, data as Gamme].sort((a, b) => a.display_order - b.display_order);
    });
    return data as Gamme;
  };

  const deleteGamme = async (slug: string) => {
    const { error } = await supabase.from('product_gammes').delete().eq('slug', slug);
    if (error) {
      console.error('[PIM] deleteGamme failed', error.message);
      return false;
    }
    setGammes((prev) => prev.filter((g) => g.slug !== slug));
    return true;
  };

  const upsertDefinition = async (
    input: Partial<ProductDefinition> & { gamme_slug: string; locale: string }
  ) => {
    const { data, error } = await supabase
      .from('product_definitions')
      .upsert(input, { onConflict: 'gamme_slug,variation_filter,locale' })
      .select()
      .single();
    if (error) {
      console.error('[PIM] upsertDefinition failed', error.message);
      return null;
    }
    setDefinitions((prev) => {
      const idx = prev.findIndex((d) => d.id === (data as ProductDefinition).id);
      if (idx >= 0) return prev.map((d) => (d.id === (data as ProductDefinition).id ? (data as ProductDefinition) : d));
      return [...prev, data as ProductDefinition];
    });
    return data as ProductDefinition;
  };

  const deleteDefinition = async (id: string) => {
    const { error } = await supabase.from('product_definitions').delete().eq('id', id);
    if (error) {
      console.error('[PIM] deleteDefinition failed', error.message);
      return false;
    }
    setDefinitions((prev) => prev.filter((d) => d.id !== id));
    return true;
  };

  return (
    <PIMContext.Provider
      value={{ gammes, definitions, loading, refresh, upsertGamme, deleteGamme, upsertDefinition, deleteDefinition }}
    >
      {children}
    </PIMContext.Provider>
  );
}

export function usePIM() {
  const ctx = useContext(PIMContext);
  if (!ctx) throw new Error('usePIM must be used within a PIMProvider');
  return ctx;
}
