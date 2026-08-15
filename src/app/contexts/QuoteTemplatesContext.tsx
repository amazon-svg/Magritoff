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
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';
import { BUILTIN_QUOTE_TEMPLATES, QuoteTemplate } from '../utils/quote';
import { type CreateQuoteTemplate, type UpdateQuoteTemplate } from '../../modules/quote-templates';
import { useQuoteTemplatesApi } from './ModuleClientsContext';

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
  const templatesApi = useQuoteTemplatesApi();
  const { currentTenant } = useTenant();
  const [customTemplates, setCustomTemplates] = useState<QuoteTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user || !currentTenant) {
      setCustomTemplates([]);
      return;
    }
    setLoading(true);
    try {
      const overview = await templatesApi.overview(currentTenant.id);
      setCustomTemplates(overview.templates);
      setDefaultTemplateId(overview.defaultTemplateId);
    } catch (error) {
      console.error('[quote_templates] load error:', error instanceof Error ? error.message : String(error));
      setCustomTemplates([]);
      setDefaultTemplateId(null);
    }
    setLoading(false);
  }, [user, currentTenant?.id, templatesApi]);

  useEffect(() => {
    reload();
  }, [reload]);

  const templates: QuoteTemplate[] = useMemo(
    () => [...BUILTIN_QUOTE_TEMPLATES, ...customTemplates],
    [customTemplates]
  );

  // ─── Actions ────────────────────────────────────────────────────────────

  const createTemplate = async (
    input: Partial<QuoteTemplate>
  ): Promise<QuoteTemplate | null> => {
    if (!user || !currentTenant) return null;
    try {
      const data = await templatesApi.create(currentTenant.id, templateInput(input, true) as CreateQuoteTemplate);
      await reload();
      return data;
    } catch (error) {
      console.error('[quote_templates] create error:', error instanceof Error ? error.message : String(error));
      return null;
    }
  };

  const updateTemplate = async (id: string, input: Partial<QuoteTemplate>) => {
    if (!user || !currentTenant) return;
    // on n'update que les customs (les builtins sont statiques)
    if (id.startsWith('builtin-')) return;
    try { await templatesApi.update(currentTenant.id, id, templateInput(input, false)); }
    catch (error) { console.error('[quote_templates] update error:', error instanceof Error ? error.message : String(error)); }
    await reload();
  };

  const deleteTemplate = async (id: string) => {
    if (!user || !currentTenant) return;
    if (id.startsWith('builtin-')) return;
    try { await templatesApi.remove(currentTenant.id, id); }
    catch (error) { console.error('[quote_templates] delete error:', error instanceof Error ? error.message : String(error)); }
    if (defaultTemplateId === id) setDefaultTemplateId(null);
    await reload();
  };

  const setDefault = async (id: string) => {
    if (!user || !currentTenant) return;
    const value = id || null;
    try { await templatesApi.setDefault(currentTenant.id, value); }
    catch (error) { console.error('[user_preferences] default template error:', error instanceof Error ? error.message : String(error)); return; }
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

function templateInput(input: Partial<QuoteTemplate>, create: boolean): UpdateQuoteTemplate | CreateQuoteTemplate {
  const picked = { name: input.name, style: input.style, company_name: input.company_name, address: input.address, postal_code: input.postal_code, city: input.city, country: input.country, phone: input.phone, email: input.email, website: input.website, siret: input.siret, tva_number: input.tva_number, logo_url: input.logo_url, brand_color: input.brand_color, accent_color: input.accent_color, font_family: input.font_family, validity_days: input.validity_days, footer_text: input.footer_text };
  const clean = Object.fromEntries(Object.entries(picked).filter(([, value]) => value !== undefined));
  return create ? { ...clean, name: input.name || 'Nouveau gabarit', style: input.style || 'custom', brand_color: input.brand_color ?? '#111111', accent_color: input.accent_color ?? '#f59e0b', validity_days: input.validity_days ?? 30 } as CreateQuoteTemplate : clean as UpdateQuoteTemplate;
}
