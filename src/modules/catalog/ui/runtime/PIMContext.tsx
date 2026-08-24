import { useWorkspaceApi, useWorkspaceUiRuntime } from '@/platform/runtime/workspace-ui-runtime';
import { CatalogApiClient } from '@/modules/catalog';
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { Gamme, ProductDefinition } from '@/modules/catalog/ui/helpers/productEnrichment';
import { useAuth } from '@/modules/account/ui/runtime';
import { type PimDefinition, type PimGamme } from '@/modules/catalog';

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
  const { user } = useAuth();
  const catalogApi = useWorkspaceApi(CatalogApiClient);
  const [gammes, setGammes] = useState<Gamme[]>([]);
  const [definitions, setDefinitions] = useState<ProductDefinition[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) { setGammes([]); setDefinitions([]); setLoading(false); return; }
    setLoading(true);
    try {
      const catalog = await catalogApi.pimCatalog();
      setGammes(catalog.gammes.map(fromPimGamme));
      setDefinitions(catalog.definitions.map(fromPimDefinition));
    } catch (error) {
      console.error('[PIM] fetch failed', error instanceof Error ? error.message : error);
    } finally { setLoading(false); }
  }, [catalogApi, user?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const upsertGamme = async (input: Partial<Gamme> & { slug: string; name: string }) => {
    try {
      const data = fromPimGamme(await catalogApi.upsertPimGamme({ slug: input.slug, name: input.name, parentSlug: input.parent_slug, matchingRules: input.matching_rules as Record<string, unknown> | undefined, displayOrder: input.display_order, imageUrl: input.image_url }));
      setGammes((prev) => {
        const idx = prev.findIndex((g) => g.slug === data.slug);
        if (idx >= 0) return prev.map((g) => (g.slug === data.slug ? data : g));
        return [...prev, data].sort((a, b) => a.display_order - b.display_order);
      });
      return data;
    } catch (error) {
      console.error('[PIM] upsertGamme failed', error instanceof Error ? error.message : error);
      return null;
    }
  };

  const deleteGamme = async (slug: string) => {
    try {
      await catalogApi.deletePimGamme(slug);
      setGammes((prev) => prev.filter((g) => g.slug !== slug));
      return true;
    } catch (error) {
      console.error('[PIM] deleteGamme failed', error instanceof Error ? error.message : error);
      return false;
    }
  };

  const upsertDefinition = async (
    input: Partial<ProductDefinition> & { gamme_slug: string; locale: string }
  ) => {
    try {
      const data = fromPimDefinition(await catalogApi.upsertPimDefinition(toDefinitionCommand(input)));
      setDefinitions((prev) => {
        const idx = prev.findIndex((d) => d.id === data.id);
        if (idx >= 0) return prev.map((d) => (d.id === data.id ? data : d));
        return [...prev, data];
      });
      return data;
    } catch (error) {
      console.error('[PIM] upsertDefinition failed', error instanceof Error ? error.message : error);
      return null;
    }
  };

  const deleteDefinition = async (id: string) => {
    try {
      await catalogApi.deletePimDefinition(id);
      setDefinitions((prev) => prev.filter((d) => d.id !== id));
      return true;
    } catch (error) {
      console.error('[PIM] deleteDefinition failed', error instanceof Error ? error.message : error);
      return false;
    }
  };

  return (
    <PIMContext.Provider
      value={{ gammes, definitions, loading, refresh, upsertGamme, deleteGamme, upsertDefinition, deleteDefinition }}
    >
      {children}
    </PIMContext.Provider>
  );
}

function fromPimGamme(gamme: PimGamme): Gamme { return { id: gamme.id, slug: gamme.slug, name: gamme.name, parent_slug: gamme.parentSlug, matching_rules: gamme.matchingRules, display_order: gamme.displayOrder, image_url: gamme.imageUrl }; }
function fromPimDefinition(definition: PimDefinition): ProductDefinition { return { id: definition.id, gamme_slug: definition.gammeSlug, variation_filter: definition.variationFilter, locale: definition.locale, name: definition.name, keywords: definition.keywords, title_template: definition.titleTemplate, short_description_template: definition.shortDescriptionTemplate, description_template: definition.descriptionTemplate, h1_template: definition.h1Template, seo_title: definition.seoTitle, seo_description: definition.seoDescription, schema_org_type: definition.schemaOrgType, usage_examples: definition.usageExamples, faq: definition.faq, quality_score: definition.qualityScore, generated_by: definition.generatedBy, validated_by: definition.validatedBy, image_url: definition.imageUrl, commercial_pitch: definition.commercialPitch, benefits: definition.benefits, use_cases: definition.useCases, technical_spec: definition.technicalSpec, version: definition.version, last_reviewed_at: definition.lastReviewedAt }; }
function toDefinitionCommand(input: Partial<ProductDefinition> & { gamme_slug: string; locale: string }) {
  const extended = input as typeof input & { last_reviewed_at?: string | null; version?: number };
  return { gammeSlug: input.gamme_slug, variationFilter: input.variation_filter ?? {}, locale: input.locale, name: input.name, keywords: input.keywords, titleTemplate: input.title_template, shortDescriptionTemplate: input.short_description_template, descriptionTemplate: input.description_template, h1Template: input.h1_template, seoTitle: input.seo_title, seoDescription: input.seo_description, schemaOrgType: input.schema_org_type, usageExamples: input.usage_examples, faq: input.faq, generatedBy: input.generated_by, validatedBy: input.validated_by, imageUrl: input.image_url, commercialPitch: input.commercial_pitch, benefits: input.benefits, useCases: input.use_cases as Array<{ title: string; description: string }> | null | undefined, technicalSpec: input.technical_spec, lastReviewedAt: extended.last_reviewed_at, version: extended.version };
}

export function usePIM() {
  const ctx = useContext(PIMContext);
  if (!ctx) throw new Error('usePIM must be used within a PIMProvider');
  return ctx;
}
