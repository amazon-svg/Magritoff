/**
 * Implementation Supabase du referentiel Projets (story E10.1).
 *
 * Le tenant est toujours passe explicitement par l appelant (route), jamais
 * lu depuis la session Supabase : c est le principal deja resolu par la
 * facade (CA4) qui fait foi.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import type {
  CreateProjectCommand,
  CreateProjectItemCommand,
  ProjectDetailDto,
  ProjectDto,
  ProjectItemDto,
  UpdateProjectCommand,
} from '../../modules/projects/api/contracts.ts';
import {
  ProjectCommandRejectedError,
  ProjectNotFoundError,
  type ListProjectsParams,
  type ListProjectsResult,
  type ProjectsRepository,
} from '../../modules/projects/application/projects-repository.ts';

const CHECK_VIOLATION = '23514';
const NOT_NULL_VIOLATION = '23502';

/**
 * Neutralise les caracteres reserves de la grammaire de filtre PostgREST,
 * meme raison et meme choix que `sanitizeSearchTerm` du module Clients
 * (src/adapters/supabase/customers-repository.ts, m2/m3 qa-review) : retirer
 * plutot que tenter d echapper.
 */
export function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()]/g, ' ').trim();
}

export class SupabaseProjectsRepository implements ProjectsRepository {
  constructor(private readonly client: SupabaseClient<any>) {}

  async list(tenantId: TenantId, params: ListProjectsParams): Promise<ListProjectsResult> {
    let query = this.client
      .from('projects')
      .select('*')
      // CA2 : tries par date de derniere modification decroissante.
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(params.size + 1);

    if (params.customerId) query = query.eq('customer_id', params.customerId);
    if (params.status) query = query.eq('status', params.status);
    if (params.q) {
      const sanitized = sanitizeSearchTerm(params.q);
      if (sanitized.length > 0) query = query.ilike('name', `%${sanitized}%`);
    }
    if (params.cursor) {
      // Pagination par cle (updated_at, id) descendante : la page suivante
      // commence strictement apres le curseur, dans le meme ordre de tri.
      query = query.or(
        `updated_at.lt.${params.cursor.sort},and(updated_at.eq.${params.cursor.sort},id.lt.${params.cursor.id})`,
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { rows: (data ?? []).map(toProjectDto) };
  }

  async findById(tenantId: TenantId, projectId: string): Promise<ProjectDto | null> {
    const { data, error } = await this.client
      .from('projects')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toProjectDto(data) : null;
  }

  async findDetailById(tenantId: TenantId, projectId: string): Promise<ProjectDetailDto | null> {
    const project = await this.findById(tenantId, projectId);
    if (!project) return null;
    const { data, error } = await this.client
      .from('project_items')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true });
    if (error) throw new Error(error.message);
    return { ...project, items: (data ?? []).map(toProjectItemDto) };
  }

  async create(
    tenantId: TenantId,
    actor: UserId,
    command: CreateProjectCommand & Readonly<{ customer_id: string }>,
  ): Promise<ProjectDto> {
    const { data, error } = await this.client
      .from('projects')
      .insert({
        tenant_id: tenantId,
        customer_id: command.customer_id,
        name: command.name,
        created_by: actor,
      })
      .select()
      .single();
    if (error || !data) throw toDomainError(error, 'Création du projet impossible.');
    return toProjectDto(data);
  }

  async update(
    tenantId: TenantId,
    projectId: string,
    command: UpdateProjectCommand,
  ): Promise<ProjectDto> {
    const patch: Record<string, unknown> = {};
    if ('name' in command && command.name !== undefined) patch['name'] = command.name;
    if ('customer_id' in command && command.customer_id !== undefined) {
      patch['customer_id'] = command.customer_id;
    }
    if ('status' in command && command.status !== undefined) patch['status'] = command.status;

    const { data, error } = await this.client
      .from('projects')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', projectId)
      .select()
      .maybeSingle();
    if (error) throw toDomainError(error, 'Modification du projet impossible.');
    if (!data) throw new ProjectNotFoundError();
    return toProjectDto(data);
  }

  async addItem(
    tenantId: TenantId,
    projectId: string,
    command: CreateProjectItemCommand,
  ): Promise<ProjectItemDto> {
    await this.assertProjectInTenant(tenantId, projectId);

    const { data: last, error: lastError } = await this.client
      .from('project_items')
      .select('position')
      .eq('project_id', projectId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError) throw new Error(lastError.message);
    const nextPosition = last ? Number(last.position) + 1 : 0;

    const { data, error } = await this.client
      .from('project_items')
      .insert({
        project_id: projectId,
        label: command.label,
        quote_payload: command.quote_payload,
        clariprint_config: command.clariprint_config ?? null,
        position: nextPosition,
      })
      .select()
      .single();
    if (error || !data) throw toDomainError(error, 'Ajout de l élément au projet impossible.');
    return toProjectItemDto(data);
  }

  async removeItem(tenantId: TenantId, projectId: string, itemId: string): Promise<void> {
    await this.assertProjectInTenant(tenantId, projectId);
    // Retrait du LIEN uniquement (DELETE de la ligne project_items) : aucun
    // historique de chiffrage n est detenu par cette table.
    const { error } = await this.client
      .from('project_items')
      .delete()
      .eq('project_id', projectId)
      .eq('id', itemId);
    if (error) throw new Error(error.message);
  }

  private async assertProjectInTenant(tenantId: TenantId, projectId: string): Promise<void> {
    const { data, error } = await this.client
      .from('projects')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new ProjectNotFoundError();
  }
}

function toProjectDto(row: Record<string, any>): ProjectDto {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    customer_id: row.customer_id,
    name: row.name,
    status: row.status,
    // Point d extension E10.2 : toujours vide tant que les tags de projet ne
    // sont pas livres (pas de donnee inventee).
    tags: Array.isArray(row.tags) ? row.tags : [],
    created_by: row.created_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toProjectItemDto(row: Record<string, any>): ProjectItemDto {
  return {
    id: row.id,
    project_id: row.project_id,
    label: row.label,
    quote_payload: row.quote_payload ?? {},
    clariprint_config: row.clariprint_config ?? null,
    position: Number(row.position),
    created_at: row.created_at,
  };
}

/** Traduit les erreurs Postgres en erreurs de domaine du module Projets. */
export function toDomainError(
  error: { code?: string; message: string; details?: string | null } | null,
  fallback: string,
): Error {
  // Filet de securite : la NOT NULL de `customer_id` porte deja le CA3 en
  // base (voir 20260901000500_gescom_e10_1_projects.sql). Le service verifie
  // l existence du client AVANT d ecrire ; ce cas ne devrait donc survenir
  // que si une ecriture contourne un jour le service applicatif.
  if (error?.code === NOT_NULL_VIOLATION) {
    return new ProjectCommandRejectedError(
      'project.customer_required',
      'Un projet exige un client existant du tenant.',
      [{ field: 'customer_id', message: 'Client requis, absent ou inconnu de ce tenant.' }],
    );
  }
  if (error?.code === CHECK_VIOLATION) {
    return new ProjectCommandRejectedError('api.validation_failed', error.message ?? fallback);
  }
  return new Error(error?.message ?? fallback);
}
