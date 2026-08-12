import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import type { GammeSubscription, PimCatalog, PimDefinition, PimGamme, SetGammeSubscriptionsCommand, UpsertPimDefinitionCommand, UpsertPimGammeCommand } from '../../modules/catalog/api/contracts.ts';
import { CatalogRejectedError, type CatalogRepository } from '../../modules/catalog/application/catalog-repository.ts';
import type { Database, Json } from '../../types/database.types.ts';

export class SupabaseCatalogRepository implements CatalogRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async gammeSubscriptions(_actor: UserId, tenantId: string): Promise<GammeSubscription[]> {
    const { data, error } = await this.client.from('tenant_gamme_subscriptions')
      .select('gamme_slug, active, display_order').eq('tenant_id', tenantId).order('display_order');
    if (error) throw classified(error, 'Lecture des souscriptions de gammes impossible.');
    return (data ?? []).map(mapSubscription);
  }

  async setGammeSubscriptions(actor: UserId, tenantId: string, command: SetGammeSubscriptionsCommand): Promise<GammeSubscription[]> {
    const { error } = await this.client.from('tenant_gamme_subscriptions').upsert(
      command.subscriptions.map((item) => ({ tenant_id: tenantId, gamme_slug: item.gammeSlug, active: item.active, added_by: actor })),
      { onConflict: 'tenant_id,gamme_slug' },
    );
    if (error) throw classified(error, 'Modification des souscriptions de gammes impossible.');
    return this.gammeSubscriptions(actor, tenantId);
  }

  async pimCatalog(_actor: UserId): Promise<PimCatalog> {
    const [gammes, definitions] = await Promise.all([
      this.client.from('product_gammes').select('*').order('display_order'),
      this.client.from('product_definitions').select('*'),
    ]);
    if (gammes.error) throw classified(gammes.error, 'Lecture des gammes PIM impossible.');
    if (definitions.error) throw classified(definitions.error, 'Lecture des définitions PIM impossible.');
    return { gammes: (gammes.data ?? []).map(mapGamme), definitions: (definitions.data ?? []).map(mapDefinition) };
  }

  async upsertPimGamme(actor: UserId, command: UpsertPimGammeCommand): Promise<PimGamme> {
    await this.requireAdmin(actor);
    const { data, error } = await this.client.from('product_gammes').upsert({
      slug: command.slug, name: command.name,
      ...(command.parentSlug === undefined ? {} : { parent_slug: command.parentSlug }),
      ...(command.matchingRules === undefined ? {} : { matching_rules: command.matchingRules as Json }),
      ...(command.displayOrder === undefined ? {} : { display_order: command.displayOrder }),
      ...(command.imageUrl === undefined ? {} : { image_url: command.imageUrl }),
    }, { onConflict: 'slug' }).select('*').single();
    if (error || !data) throw classified(error ?? {}, 'Enregistrement de la gamme PIM impossible.');
    return mapGamme(data);
  }

  async deletePimGamme(actor: UserId, slug: string): Promise<void> {
    await this.requireAdmin(actor);
    const { data, error } = await this.client.from('product_gammes').delete().eq('slug', slug).select('slug').maybeSingle();
    if (error) throw classified(error, 'Suppression de la gamme PIM impossible.');
    if (!data) throw new CatalogRejectedError('not_found', 'Gamme PIM introuvable.');
  }

  async upsertPimDefinition(actor: UserId, command: UpsertPimDefinitionCommand): Promise<PimDefinition> {
    await this.requireAdmin(actor);
    const { data, error } = await this.client.from('product_definitions').upsert(definitionRow(command), { onConflict: 'gamme_slug,variation_filter,locale' }).select('*').single();
    if (error || !data) throw classified(error ?? {}, 'Enregistrement de la définition PIM impossible.');
    return mapDefinition(data);
  }

  async deletePimDefinition(actor: UserId, id: string): Promise<void> {
    await this.requireAdmin(actor);
    const { data, error } = await this.client.from('product_definitions').delete().eq('id', id).select('id').maybeSingle();
    if (error) throw classified(error, 'Suppression de la définition PIM impossible.');
    if (!data) throw new CatalogRejectedError('not_found', 'Définition PIM introuvable.');
  }

  private async requireAdmin(actor: UserId): Promise<void> {
    const { data: superAdmin, error: superAdminError } = await this.client.rpc('is_super_admin');
    if (!superAdminError && superAdmin) return;
    const { data: preferences, error } = await this.client.from('user_preferences').select('is_admin').eq('user_id', actor).maybeSingle();
    if (error || preferences?.is_admin !== true) throw new CatalogRejectedError('permission_denied', 'Administration du PIM interdite.');
  }
}

type SubscriptionRow = Database['public']['Tables']['tenant_gamme_subscriptions']['Row'];
type GammeRow = Database['public']['Tables']['product_gammes']['Row'];
type DefinitionRow = Database['public']['Tables']['product_definitions']['Row'];
function mapSubscription(row: Pick<SubscriptionRow, 'gamme_slug' | 'active' | 'display_order'>): GammeSubscription {
  return { gammeSlug: row.gamme_slug, active: row.active, displayOrder: row.display_order };
}
function mapGamme(row: GammeRow): PimGamme { return { id: row.id, slug: row.slug, name: row.name, parentSlug: row.parent_slug, matchingRules: record(row.matching_rules), displayOrder: row.display_order, imageUrl: row.image_url }; }
function mapDefinition(row: DefinitionRow): PimDefinition { return {
  id: row.id, gammeSlug: row.gamme_slug, variationFilter: record(row.variation_filter), locale: row.locale,
  name: row.name, keywords: row.keywords, titleTemplate: row.title_template, shortDescriptionTemplate: row.short_description_template,
  descriptionTemplate: row.description_template, h1Template: row.h1_template, seoTitle: row.seo_title, seoDescription: row.seo_description,
  schemaOrgType: row.schema_org_type, usageExamples: usageExamples(row.usage_examples), faq: faqEntries(row.faq), qualityScore: row.quality_score,
  generatedBy: generatedBy(row.generated_by), validatedBy: validatedBy(row.validated_by), imageUrl: row.image_url,
  commercialPitch: row.commercial_pitch, benefits: stringArray(row.benefits), useCases: useCases(row.use_cases), technicalSpec: nullableRecord(row.technical_spec),
  lastReviewedAt: row.last_reviewed_at, version: row.version,
}; }
function definitionRow(command: UpsertPimDefinitionCommand): Database['public']['Tables']['product_definitions']['Insert'] {
  const row: Database['public']['Tables']['product_definitions']['Insert'] = { gamme_slug: command.gammeSlug, variation_filter: command.variationFilter as Json, locale: command.locale };
  const values: Array<[keyof UpsertPimDefinitionCommand, keyof DefinitionRow, (value: unknown) => unknown]> = [
    ['name', 'name', identity], ['keywords', 'keywords', identity], ['titleTemplate', 'title_template', identity], ['shortDescriptionTemplate', 'short_description_template', identity],
    ['descriptionTemplate', 'description_template', identity], ['h1Template', 'h1_template', identity], ['seoTitle', 'seo_title', identity], ['seoDescription', 'seo_description', identity],
    ['schemaOrgType', 'schema_org_type', identity], ['usageExamples', 'usage_examples', json], ['faq', 'faq', json], ['generatedBy', 'generated_by', identity],
    ['validatedBy', 'validated_by', identity], ['imageUrl', 'image_url', identity], ['commercialPitch', 'commercial_pitch', identity], ['benefits', 'benefits', json],
    ['useCases', 'use_cases', json], ['technicalSpec', 'technical_spec', json], ['lastReviewedAt', 'last_reviewed_at', identity], ['version', 'version', identity],
  ];
  for (const [source, target, convert] of values) if (command[source] !== undefined) (row as Record<string, unknown>)[target] = convert(command[source]);
  return row;
}
function identity(value: unknown) { return value; }
function json(value: unknown) { return value as Json; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function nullableRecord(value: unknown): Record<string, unknown> | null { return value === null ? null : record(value); }
function stringArray(value: unknown): string[] | null { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : null; }
function usageExamples(value: unknown): Array<{ title: string; description: string }> { return Array.isArray(value) ? value.flatMap((item) => { const entry = record(item); return typeof entry.title === 'string' && typeof entry.description === 'string' ? [{ title: entry.title, description: entry.description }] : []; }) : []; }
function faqEntries(value: unknown): Array<{ question: string; answer: string }> { return Array.isArray(value) ? value.flatMap((item) => { const entry = record(item); return typeof entry.question === 'string' && typeof entry.answer === 'string' ? [{ question: entry.question, answer: entry.answer }] : []; }) : []; }
function useCases(value: unknown): Array<{ title: string; description: string }> | string[] | null { if (!Array.isArray(value)) return null; const strings = value.filter((item): item is string => typeof item === 'string'); return strings.length === value.length ? strings : usageExamples(value); }
function generatedBy(value: string | null): PimDefinition['generatedBy'] { return value === 'llm' || value === 'human' || value === 'hybrid' ? value : null; }
function validatedBy(value: string | null): PimDefinition['validatedBy'] { return value === 'llm' || value === 'human' || value === 'pending' ? value : null; }
function classified(error: { code?: string; message?: string }, fallback: string) {
  if (error.code === '23505') return new CatalogRejectedError('conflict', error.message ?? fallback);
  if (error.code === '23503' || error.code === '23514') return new CatalogRejectedError('invalid_request', error.message ?? fallback);
  return new CatalogRejectedError('permission_denied', error.message ?? fallback);
}
