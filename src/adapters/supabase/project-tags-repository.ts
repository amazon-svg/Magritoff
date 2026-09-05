/**
 * Implementation Supabase du referentiel Tags de projet (story E10.2).
 *
 * Le tenant est toujours passe explicitement par l appelant (route), jamais
 * lu depuis la session Supabase : c est le principal deja resolu par la
 * facade (CA4) qui fait foi.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantId } from '../../kernel/ids/index.ts';
import type { CreateProjectTagCommand, ProjectTagColor, ProjectTagDto } from '../../modules/project-tags/api/contracts.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';
import {
  ProjectTagCommandRejectedError,
  ProjectTagNotFoundError,
  type CreateProjectTagResult,
  type ListProjectTagsParams,
  type ProjectTagsRepository,
} from '../../modules/project-tags/application/project-tags-repository.ts';

const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';
const FOREIGN_KEY_VIOLATION = '23503';

/**
 * Neutralise les caracteres reserves de la grammaire de filtre PostgREST,
 * meme raison que `sanitizeSearchTerm` des modules Clients et Projets
 * (docs/api/CONVENTIONS.md, lecon du sprint sur une virgule qui casse une
 * requete `.or()`/`.ilike()`). Compacte aussi les suites d espaces
 * resultantes (qa-review E10.2) : sans cela, un libelle contenant une
 * virgule cherche via `q` ne matcherait plus jamais son tag (resultat vide
 * silencieux, pas un crash).
 */
export function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Meme normalisation que la contrainte unique en base (`btrim(lower(label))`). */
export function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

export class SupabaseProjectTagsRepository implements ProjectTagsRepository {
  constructor(private readonly client: SupabaseClient<any>) {}

  async list(tenantId: TenantId, params: ListProjectTagsParams): Promise<readonly ProjectTagDto[]> {
    let query = this.client
      .from('project_tags')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('label', { ascending: true });

    if (params.q) {
      const sanitized = sanitizeSearchTerm(params.q);
      if (sanitized.length > 0) query = query.ilike('label', `%${sanitized}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map(toProjectTagDto);
  }

  async findById(tenantId: TenantId, tagId: string): Promise<ProjectTagDto | null> {
    const { data, error } = await this.client
      .from('project_tags')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', tagId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toProjectTagDto(data) : null;
  }

  async findManyByIds(tenantId: TenantId, tagIds: readonly string[]): Promise<readonly ProjectTagDto[]> {
    if (tagIds.length === 0) return [];
    const { data, error } = await this.client
      .from('project_tags')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('id', [...tagIds]);
    if (error) throw new Error(error.message);
    return (data ?? []).map(toProjectTagDto);
  }

  async createOrGet(
    tenantId: TenantId,
    command: CreateProjectTagCommand & Readonly<{ color: ProjectTagColor }>,
  ): Promise<CreateProjectTagResult> {
    const { data, error } = await this.client
      .from('project_tags')
      .insert({ tenant_id: tenantId, label: command.label, color: command.color })
      .select()
      .single();

    if (!error && data) return { tag: toProjectTagDto(data), created: true };

    // CA2 : la concurrence est geree ICI, cote base — deux commerciaux qui
    // creent le meme libelle en meme temps percutent tous deux la meme
    // contrainte unique (tenant_id, btrim(lower(label))) ; celui qui PERD la
    // course RELIT le tag existant au lieu d echouer. Aucun verifie-puis-ecris
    // cote application en amont : ce serait une fenetre de course (TOCTOU)
    // que la contrainte unique seule ferme.
    if (error?.code === UNIQUE_VIOLATION) {
      const existing = await this.findByNormalizedLabel(tenantId, command.label);
      if (existing) return { tag: existing, created: false };
    }
    throw toDomainError(error, 'Création du tag impossible.');
  }

  async delete(tenantId: TenantId, tagId: string): Promise<void> {
    const existing = await this.findById(tenantId, tagId);
    if (!existing) throw new ProjectTagNotFoundError();

    const { error } = await this.client
      .from('project_tags')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', tagId);
    if (error) throw toDomainError(error, 'Suppression du tag impossible.');
  }

  /**
   * Recherche par libelle NORMALISE (trim, casse insensible), en JS plutot
   * qu en `ilike` : le libelle est une chaine libre qui peut contenir `%`
   * ou `_`, des jokers ILIKE qui casseraient une comparaison d EGALITE
   * exacte. Le catalogue de tags d un tenant reste petit (dizaines, pas
   * milliers) : le cout d un aller-retour supplementaire est negligeable.
   */
  private async findByNormalizedLabel(tenantId: TenantId, label: string): Promise<ProjectTagDto | null> {
    const normalized = normalizeLabel(label);
    const { data, error } = await this.client
      .from('project_tags')
      .select('*')
      .eq('tenant_id', tenantId);
    if (error) throw new Error(error.message);
    const match = (data ?? []).find((row: Record<string, any>) => normalizeLabel(String(row.label)) === normalized);
    return match ? toProjectTagDto(match) : null;
  }
}

function toProjectTagDto(row: Record<string, any>): ProjectTagDto {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    label: row.label,
    color: row.color,
    created_at: toIsoTimestamp(row.created_at),
  };
}

/** Traduit les erreurs Postgres en erreurs de domaine du module Tags de projet. */
export function toDomainError(
  error: { code?: string; message: string; details?: string | null } | null,
  fallback: string,
): Error {
  if (error?.code === UNIQUE_VIOLATION) {
    return new ProjectTagCommandRejectedError(
      'project_tag.label_already_used',
      'Ce libelle est deja utilise dans ce tenant.',
      [{ field: 'label', message: 'Libelle deja utilise dans ce tenant.' }],
    );
  }
  if (error?.code === CHECK_VIOLATION) {
    return new ProjectTagCommandRejectedError('api.validation_failed', error.message ?? fallback);
  }
  if (error?.code === FOREIGN_KEY_VIOLATION) {
    // CA5 : porte par la FK `project_tag_links.tag_id -> project_tags.id`
    // SANS cascade (RESTRICT par defaut) — un tag encore lie a un projet ne
    // se supprime jamais silencieusement.
    return new ProjectTagCommandRejectedError(
      'project_tag.in_use',
      'Ce tag est encore utilisé par au moins un projet.',
      [{ field: 'id', message: 'Tag encore utilisé par au moins un projet.' }],
    );
  }
  return new Error(error?.message ?? fallback);
}
