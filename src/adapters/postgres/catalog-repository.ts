import type { PoolClient } from 'pg';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import type {
  GammeSubscription,
  PimCatalog,
  PimDefinition,
  PimGamme,
  SetGammeSubscriptionsCommand,
  UpsertPimDefinitionCommand,
  UpsertPimGammeCommand,
} from '../../modules/catalog/api/contracts.ts';
import {
  CatalogRejectedError,
  type CatalogRepository,
} from '../../modules/catalog/application/catalog-repository.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type SubscriptionRow = Readonly<{
  gamme_slug: string;
  active: boolean;
  display_order: number;
}>;

type GammeRow = Readonly<{
  id: string;
  slug: string;
  name: string;
  parent_slug: string | null;
  matching_rules: unknown;
  display_order: number;
  image_url: string | null;
}>;

type DefinitionRow = Readonly<{
  id: string;
  gamme_slug: string;
  variation_filter: unknown;
  locale: string;
  name: string | null;
  keywords: string[] | null;
  title_template: string | null;
  short_description_template: string | null;
  description_template: string | null;
  h1_template: string | null;
  seo_title: string | null;
  seo_description: string | null;
  schema_org_type: string | null;
  usage_examples: unknown;
  faq: unknown;
  quality_score: string | number | null;
  generated_by: string | null;
  validated_by: string | null;
  image_url: string | null;
  commercial_pitch: string | null;
  benefits: unknown;
  use_cases: unknown;
  technical_spec: unknown;
  last_reviewed_at: Date | null;
  version: number;
}>;

export class PostgresCatalogRepository implements CatalogRepository {
  constructor(private readonly transactions: PostgresTransactionRunner) {}

  gammeSubscriptions(actor: UserId, tenantId: string): Promise<GammeSubscription[]> {
    return this.transactions.run({ userId: actor, tenantId: tenantId as TenantId }, async (client) => {
      const result = await client.query<SubscriptionRow>(`
        select gamme_slug, active, display_order
          from public.tenant_gamme_subscriptions
         where tenant_id = $1
         order by display_order, gamme_slug
      `, [tenantId]);
      return result.rows.map(mapSubscription);
    });
  }

  setGammeSubscriptions(
    actor: UserId,
    tenantId: string,
    command: SetGammeSubscriptionsCommand,
  ): Promise<GammeSubscription[]> {
    return this.transactions.run({ userId: actor, tenantId: tenantId as TenantId }, async (client) => {
      try {
        for (const subscription of command.subscriptions) {
          await client.query(`
            insert into public.tenant_gamme_subscriptions (
              tenant_id, gamme_slug, active, added_by
            ) values ($1, $2, $3, $4)
            on conflict (tenant_id, gamme_slug) do update
              set active = excluded.active
          `, [tenantId, subscription.gammeSlug, subscription.active, actor]);
        }
        return await listSubscriptions(client, tenantId);
      } catch (error) {
        throw mapError(error, 'Modification des souscriptions de gammes impossible.');
      }
    });
  }

  pimCatalog(actor: UserId): Promise<PimCatalog> {
    return this.transactions.run({ userId: actor }, async (client) => {
      const [gammes, definitions] = await Promise.all([
        client.query<GammeRow>(`
          select id, slug, name, parent_slug, matching_rules, display_order, image_url
            from public.product_gammes
           order by display_order, slug
        `),
        client.query<DefinitionRow>(`
          select id, gamme_slug, variation_filter, locale, name, keywords,
                 title_template, short_description_template, description_template,
                 h1_template, seo_title, seo_description, schema_org_type,
                 usage_examples, faq, quality_score, generated_by, validated_by,
                 image_url, commercial_pitch, benefits, use_cases, technical_spec,
                 last_reviewed_at, version
            from public.product_definitions
           order by gamme_slug, locale, id
        `),
      ]);
      return {
        gammes: gammes.rows.map(mapGamme),
        definitions: definitions.rows.map(mapDefinition),
      };
    });
  }

  upsertPimGamme(actor: UserId, command: UpsertPimGammeCommand): Promise<PimGamme> {
    return this.transactions.run({ userId: actor }, async (client) => {
      try {
        await assertAdmin(client, actor);
        const fields: Array<[string, unknown]> = [
          ['slug', command.slug],
          ['name', command.name],
        ];
        addDefined(fields, 'parent_slug', command.parentSlug);
        addDefined(fields, 'matching_rules', command.matchingRules);
        addDefined(fields, 'display_order', command.displayOrder);
        addDefined(fields, 'image_url', command.imageUrl);
        const result = await client.query<GammeRow>(buildUpsert(
          'product_gammes',
          fields,
          ['slug'],
          fields.filter(([column]) => column !== 'slug').map(([column]) => column),
          'id, slug, name, parent_slug, matching_rules, display_order, image_url',
        ), fieldValues(fields));
        return mapGamme(requireRow(result.rows[0], 'Enregistrement de la gamme PIM impossible.'));
      } catch (error) {
        throw mapError(error, 'Enregistrement de la gamme PIM impossible.');
      }
    });
  }

  deletePimGamme(actor: UserId, slug: string): Promise<void> {
    return this.transactions.run({ userId: actor }, async (client) => {
      try {
        await assertAdmin(client, actor);
        await client.query(
          'delete from public.tenant_gamme_subscriptions where gamme_slug = $1',
          [slug],
        );
        const result = await client.query(
          'delete from public.product_gammes where slug = $1',
          [slug],
        );
        if (result.rowCount !== 1) {
          throw new CatalogRejectedError('not_found', 'Gamme PIM introuvable.');
        }
      } catch (error) {
        throw mapError(error, 'Suppression de la gamme PIM impossible.');
      }
    });
  }

  upsertPimDefinition(
    actor: UserId,
    command: UpsertPimDefinitionCommand,
  ): Promise<PimDefinition> {
    return this.transactions.run({ userId: actor }, async (client) => {
      try {
        await assertAdmin(client, actor);
        const fields: Array<[string, unknown]> = [
          ['gamme_slug', command.gammeSlug],
          ['variation_filter', command.variationFilter],
          ['locale', command.locale],
        ];
        const optionals: ReadonlyArray<[string, unknown]> = [
          ['name', command.name],
          ['keywords', command.keywords],
          ['title_template', command.titleTemplate],
          ['short_description_template', command.shortDescriptionTemplate],
          ['description_template', command.descriptionTemplate],
          ['h1_template', command.h1Template],
          ['seo_title', command.seoTitle],
          ['seo_description', command.seoDescription],
          ['schema_org_type', command.schemaOrgType],
          ['usage_examples', command.usageExamples],
          ['faq', command.faq],
          ['generated_by', command.generatedBy],
          ['validated_by', command.validatedBy],
          ['image_url', command.imageUrl],
          ['commercial_pitch', command.commercialPitch],
          ['benefits', command.benefits],
          ['use_cases', command.useCases],
          ['technical_spec', command.technicalSpec],
          ['last_reviewed_at', command.lastReviewedAt],
          ['version', command.version],
        ];
        for (const [column, value] of optionals) addDefined(fields, column, value);
        const mutable = fields
          .slice(3)
          .map(([column]) => column)
          .concat('updated_at');
        const result = await client.query<DefinitionRow>(buildUpsert(
          'product_definitions',
          fields,
          ['gamme_slug', 'variation_filter', 'locale'],
          mutable,
          `id, gamme_slug, variation_filter, locale, name, keywords,
           title_template, short_description_template, description_template,
           h1_template, seo_title, seo_description, schema_org_type,
           usage_examples, faq, quality_score, generated_by, validated_by,
           image_url, commercial_pitch, benefits, use_cases, technical_spec,
           last_reviewed_at, version`,
          new Set(['updated_at']),
        ), fieldValues(fields));
        return mapDefinition(requireRow(result.rows[0], 'Enregistrement de la définition PIM impossible.'));
      } catch (error) {
        throw mapError(error, 'Enregistrement de la définition PIM impossible.');
      }
    });
  }

  deletePimDefinition(actor: UserId, id: string): Promise<void> {
    return this.transactions.run({ userId: actor }, async (client) => {
      try {
        await assertAdmin(client, actor);
        const result = await client.query(
          'delete from public.product_definitions where id = $1',
          [id],
        );
        if (result.rowCount !== 1) {
          throw new CatalogRejectedError('not_found', 'Définition PIM introuvable.');
        }
      } catch (error) {
        throw mapError(error, 'Suppression de la définition PIM impossible.');
      }
    });
  }

  assertPimAdmin(actor: UserId): Promise<void> {
    return this.transactions.run({ userId: actor }, async (client) => {
      await assertAdmin(client, actor);
    });
  }
}

async function listSubscriptions(client: PoolClient, tenantId: string): Promise<GammeSubscription[]> {
  const result = await client.query<SubscriptionRow>(`
    select gamme_slug, active, display_order
      from public.tenant_gamme_subscriptions
     where tenant_id = $1
     order by display_order, gamme_slug
  `, [tenantId]);
  return result.rows.map(mapSubscription);
}

async function assertAdmin(client: PoolClient, actor: UserId): Promise<void> {
  const result = await client.query<{ allowed: boolean }>(`
    select exists (
      select 1 from public.user_preferences
       where user_id = $1 and is_admin
    ) as allowed
  `, [actor]);
  if (result.rows[0]?.allowed !== true) {
    throw new CatalogRejectedError('permission_denied', 'Administration du PIM interdite.');
  }
}

function buildUpsert(
  table: 'product_gammes' | 'product_definitions',
  fields: ReadonlyArray<readonly [string, unknown]>,
  conflict: readonly string[],
  mutable: readonly string[],
  returning: string,
  clockColumns: ReadonlySet<string> = new Set(),
): string {
  const columns = fields.map(([column]) => column);
  const values = fields.map((_, index) => `$${index + 1}`);
  const assignments = mutable.map((column) => (
    clockColumns.has(column)
      ? `${column} = clock_timestamp()`
      : `${column} = excluded.${column}`
  ));
  return `
    insert into public.${table} (${columns.join(', ')})
    values (${values.join(', ')})
    on conflict (${conflict.join(', ')}) do update set ${assignments.join(', ')}
    returning ${returning}
  `;
}

function addDefined(fields: Array<[string, unknown]>, column: string, value: unknown): void {
  if (value !== undefined) fields.push([column, value]);
}

const JSON_COLUMNS = new Set([
  'matching_rules',
  'variation_filter',
  'usage_examples',
  'faq',
  'benefits',
  'use_cases',
  'technical_spec',
]);

function fieldValues(fields: ReadonlyArray<readonly [string, unknown]>): unknown[] {
  return fields.map(([column, value]) => (
    JSON_COLUMNS.has(column) && value !== null ? JSON.stringify(value) : value
  ));
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (row === undefined) throw new Error(message);
  return row;
}

function mapSubscription(row: SubscriptionRow): GammeSubscription {
  return {
    gammeSlug: row.gamme_slug,
    active: row.active,
    displayOrder: row.display_order,
  };
}

function mapGamme(row: GammeRow): PimGamme {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    parentSlug: row.parent_slug,
    matchingRules: record(row.matching_rules),
    displayOrder: row.display_order,
    imageUrl: row.image_url,
  };
}

function mapDefinition(row: DefinitionRow): PimDefinition {
  return {
    id: row.id,
    gammeSlug: row.gamme_slug,
    variationFilter: record(row.variation_filter),
    locale: row.locale,
    name: row.name,
    keywords: row.keywords,
    titleTemplate: row.title_template,
    shortDescriptionTemplate: row.short_description_template,
    descriptionTemplate: row.description_template,
    h1Template: row.h1_template,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    schemaOrgType: row.schema_org_type,
    usageExamples: usageExamples(row.usage_examples),
    faq: faqEntries(row.faq),
    qualityScore: row.quality_score === null ? null : Number(row.quality_score),
    generatedBy: generatedBy(row.generated_by),
    validatedBy: validatedBy(row.validated_by),
    imageUrl: row.image_url,
    commercialPitch: row.commercial_pitch,
    benefits: stringArray(row.benefits),
    useCases: useCases(row.use_cases),
    technicalSpec: nullableRecord(row.technical_spec),
    lastReviewedAt: row.last_reviewed_at === null ? null : toIsoTimestamp(row.last_reviewed_at),
    version: row.version,
  };
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
function nullableRecord(value: unknown): Record<string, unknown> | null {
  return value === null ? null : record(value);
}
function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : null;
}
function usageExamples(value: unknown): Array<{ title: string; description: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const entry = record(item);
    return typeof entry.title === 'string' && typeof entry.description === 'string'
      ? [{ title: entry.title, description: entry.description }]
      : [];
  });
}
function faqEntries(value: unknown): Array<{ question: string; answer: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const entry = record(item);
    return typeof entry.question === 'string' && typeof entry.answer === 'string'
      ? [{ question: entry.question, answer: entry.answer }]
      : [];
  });
}
function useCases(value: unknown): Array<{ title: string; description: string }> | string[] | null {
  if (!Array.isArray(value)) return null;
  const strings = stringArray(value);
  return strings ?? usageExamples(value);
}
function generatedBy(value: string | null): PimDefinition['generatedBy'] {
  return value === 'llm' || value === 'human' || value === 'hybrid' ? value : null;
}
function validatedBy(value: string | null): PimDefinition['validatedBy'] {
  return value === 'llm' || value === 'human' || value === 'pending' ? value : null;
}

function mapError(error: unknown, fallback: string): Error {
  if (error instanceof CatalogRejectedError) return error;
  const value = error as { code?: string; message?: string };
  if (value.code === '23505') {
    return new CatalogRejectedError('conflict', value.message ?? fallback);
  }
  if (value.code === '23503' || value.code === '23514' || value.code === '22P02') {
    return new CatalogRejectedError('invalid_request', value.message ?? fallback);
  }
  if (value.code === '42501') {
    return new CatalogRejectedError('permission_denied', value.message ?? fallback);
  }
  return error instanceof Error ? error : new Error(fallback);
}
