/**
 * QuoteTemplatesContext
 * ─────────────────────
 * CRUD sur la table `quote_templates` (Supabase, RLS par user_id) + fusion
 * avec les 3 gabarits `builtin` livres par Magrit.
 *
 * La liste exposee par `templates` combine :
 *   1. les 3 builtins (toujours disponibles, non supprimables)
 *   2. les gabarits custom de l'utilisateur (si connecte)
 *
 * Le gabarit par defaut est celui dont `is_default === true` (un seul a la
 * fois, contrainte applicative + DB). Si aucun, on utilise le premier builtin.
 */

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '/utils/supabase/client';
import { useAuth } from './AuthContext';
import { BUILTIN_QUOTE_TEMPLATES, QuoteTemplate } from '../utils/quote';

interface QuoteTemplatesContextType {
  templates: QuoteTemplate[];
  customTemplates: QuoteTemplate[];
  defaultTemplateId: string | null;
  loading: boolean;
  createTemplate: (input: Partial<QuoteTemplate>) => Promise<QuoteTemplate | null>;
  updateTemplate: (id: string, input: Partial<QuoteTemplate>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  setDefault: (id: string) => Promise<void>;
  /** Cloner un builtin en template editable. Utile quand l'utilisateur veut
   *  personnaliser un des 3 gabarits sans partir d'une page blanche. */
  cloneBuiltin: (builtinId: string, overrides?: Partial<QuoteTemplate>) => Promise<QuoteTemplate | null>;
  reload: () => Promise<void>;
}

const QuoteTemplatesContext = createContext<QuoteTemplatesContextType | undefined>(undefined);

export function QuoteTemplatesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [customTemplates, setCustomTemplates] = useState<QuoteTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!user) {
      setCustomTemplates([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('quote_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('[quote_templates] load error:', error.message);
      setCustomTemplates([]);
    } else if (data) {
      setCustomTemplates(
        data.map((row: any) => ({
          id: row.id,
          builtin: false,
          style: row.style || 'custom',
          name: row.name,
          company_name: row.company_name,
          address: row.address,
          postal_code: row.postal_code,
          city: row.city,
          country: row.country,
          phone: row.phone,
          email: row.email,
          website: row.website,
          siret: row.siret,
          tva_number: row.tva_number,
          logo_url: row.logo_url,
          brand_color: row.brand_color,
          accent_color: row.accent_color,
          font_family: row.font_family,
          validity_days: row.validity_days,
          footer_text: row.footer_text,
        }))
      );
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  // id du template par defaut : stocke dans user_preferences.default_quote_template_id
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(null);
  useEffect(() => {
    if (!user) {
      setDefaultTemplateId(null);
      return;
    }
    supabase
      .from('user_preferences')
      .select('default_quote_template_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setDefaultTemplateId(data?.default_quote_template_id ?? null);
      });
  }, [user, customTemplates.length]);

  const templates: QuoteTemplate[] = useMemo(
    () => [...BUILTIN_QUOTE_TEMPLATES, ...customTemplates],
    [customTemplates]
  );

  // ─── Actions ────────────────────────────────────────────────────────────

  const createTemplate = async (
    input: Partial<QuoteTemplate>
  ): Promise<QuoteTemplate | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('quote_templates')
      .insert({
        user_id: user.id,
        name: input.name || 'Nouveau gabarit',
        style: input.style || 'custom',
        company_name: input.company_name,
        address: input.address,
        postal_code: input.postal_code,
        city: input.city,
        country: input.country,
        phone: input.phone,
        email: input.email,
        website: input.website,
        siret: input.siret,
        tva_number: input.tva_number,
        logo_url: input.logo_url,
        brand_color: input.brand_color ?? '#111111',
        accent_color: input.accent_color ?? '#f59e0b',
        font_family: input.font_family,
        validity_days: input.validity_days ?? 30,
        footer_text: input.footer_text,
      })
      .select()
      .single();
    if (error) {
      console.error('[quote_templates] create error:', error.message);
      return null;
    }
    await reload();
    return data as unknown as QuoteTemplate;
  };

  const updateTemplate = async (id: string, input: Partial<QuoteTemplate>) => {
    if (!user) return;
    // on n'update que les customs (les builtins sont statiques)
    if (id.startsWith('builtin-')) return;
    const { error } = await supabase
      .from('quote_templates')
      .update({
        name: input.name,
        style: input.style,
        company_name: input.company_name,
        address: input.address,
        postal_code: input.postal_code,
        city: input.city,
        country: input.country,
        phone: input.phone,
        email: input.email,
        website: input.website,
        siret: input.siret,
        tva_number: input.tva_number,
        logo_url: input.logo_url,
        brand_color: input.brand_color,
        accent_color: input.accent_color,
        font_family: input.font_family,
        validity_days: input.validity_days,
        footer_text: input.footer_text,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) console.error('[quote_templates] update error:', error.message);
    await reload();
  };

  const deleteTemplate = async (id: string) => {
    if (!user) return;
    if (id.startsWith('builtin-')) return;
    const { error } = await supabase
      .from('quote_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) console.error('[quote_templates] delete error:', error.message);
    if (defaultTemplateId === id) {
      await setDefault('');
    }
    await reload();
  };

  const setDefault = async (id: string) => {
    if (!user) return;
    const value = id || null;
    // user_preferences a une ligne par user (upsert sur user_id)
    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        { user_id: user.id, default_quote_template_id: value },
        { onConflict: 'user_id' }
      );
    if (error) console.error('[user_preferences] default template error:', error.message);
    setDefaultTemplateId(value);
  };

  const cloneBuiltin = async (
    builtinId: string,
    overrides: Partial<QuoteTemplate> = {}
  ): Promise<QuoteTemplate | null> => {
    const source = BUILTIN_QUOTE_TEMPLATES.find((t) => t.id === builtinId);
    if (!source) return null;
    return createTemplate({
      ...source,
      ...overrides,
      id: undefined,
      builtin: undefined,
      name: overrides.name ?? `${source.name} (copie)`,
    });
  };

  return (
    <QuoteTemplatesContext.Provider
      value={{
        templates,
        customTemplates,
        defaultTemplateId,
        loading,
        createTemplate,
        updateTemplate,
        deleteTemplate,
        setDefault,
        cloneBuiltin,
        reload,
      }}
    >
      {children}
    </QuoteTemplatesContext.Provider>
  );
}

export function useQuoteTemplates() {
  const ctx = useContext(QuoteTemplatesContext);
  if (!ctx) throw new Error('useQuoteTemplates must be used within a QuoteTemplatesProvider');
  return ctx;
}
