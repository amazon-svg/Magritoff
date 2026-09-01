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
import type { ProjectTagDto } from '../../modules/project-tags/api/contracts.ts';

const CHECK_VIOLATION = '23514';
const NOT_NULL_VIOLATION = '23502';

/**
 * Embed PostgREST des tags d un projet (E10.2, CA6) : un projet porte 0 a N
 * tags via `project_tag_links`, meme principe que `SHOP_ACCESS_EMBED` du
 * module Clients (src/adapters/supabase/customers-repository.ts) — un seul
 * aller-retour plutot qu une requete par projet.
 */
const TAGS_EMBED = 'project_tag_links(project_tags(id, tenant_id, label, color, created_at))' as const;

/**
 * Neutralise les caracteres reserves de la grammaire de filtre PostgREST,
 * meme raison et meme choix que `sanitizeSearchTerm` du module Clients
 * (src/adapters/supabase/customers-repository.ts, m2/m3 qa-review) : retirer
 * plutot que tenter d echapper.
 *
 * Compacte ENSUITE les suites d espaces (qa-review E10.2) : remplacer une
 * virgule par une espace sans fusionner les espaces resultants laissait
 * passer un terme du type "Dupont, Martin" -> "Dupont  Martin" (deux
 * espaces), qui ne matche plus JAMAIS "Dupont, Martin & Fils" en
 * `ILIKE '%Dupont  Martin%'` — pas un crash (500), un resultat VIDE
 * silencieux, plus insidieux que la virgule d E10.4 qu il reprend.
 */
export function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim();
}

export class SupabaseProjectsRepository implements ProjectsRepository {
  constructor(private readonly client: SupabaseClient<any>) {}

  async list(tenantId: TenantId, params: ListProjectsParams): Promise<ListProjectsResult> {
    let query = this.client
      .from('projects')
      .select(`*, ${TAGS_EMBED}`)
      // CA2 : tries par date de derniere modification decroissante.
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(params.size + 1);

    if (params.customerId) query = query.eq('customer_id', params.customerId);
    if (params.status) query = query.eq('status', params.status);
    if (params.q) {
      const sanitized = sanitizeSearchTerm(params.q);
      if (sanitized.length > 0) {
        const term = `%${sanitized}%`;
        // CA4 (E10.2) : recherche plein texte sur le nom du projet ET le nom
        // du client. Un aller-retour prealable resout les clients dont le
        // nom matche (le tenant est petit, jamais des milliers de clients),
        // puis combine les deux criteres en OU — un embed PostgREST ne peut
        // pas filtrer la ressource RACINE sur un champ d une table jointe
        // combine en OU avec un champ de la racine elle-meme.
        const matchingCustomerIds = await this.findCustomerIdsByName(tenantId, sanitized);
        query =
          matchingCustomerIds.length > 0
            ? query.or(`name.ilike.${term},customer_id.in.(${matchingCustomerIds.join(',')})`)
            : query.ilike('name', term);
      }
    }
    if (params.tagIds.length > 0) {
      // CA4 : filtre multi-tags en ET LOGIQUE. `project_tag_links` n a pas de
      // colonne `tenant_id` propre : croiser avec les projets deja filtres
      // par tenant plus haut suffit a ecarter tout lien hors tenant, sans
      // jointure supplementaire ici.
      const matchingProjectIds = await this.findProjectIdsHavingAllTags(params.tagIds);
      if (matchingProjectIds.length === 0) return { rows: [] };
      query = query.in('id', matchingProjectIds);
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
      .select(`*, ${TAGS_EMBED}`)
      .eq('tenant_id', tenantId)
      .eq('id', projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toProjectDto(data) : null;
  }

  /** CA4 (E10.2) : clients du tenant dont le nom matche le terme sanitize. */
  private async findCustomerIdsByName(tenantId: TenantId, sanitizedTerm: string): Promise<string[]> {
    const term = `%${sanitizedTerm}%`;
    const { data, error } = await this.client
      .from('customers')
      .select('id')
      .eq('tenant_id', tenantId)
      .or(`company_name.ilike.${term},first_name.ilike.${term},last_name.ilike.${term}`);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: Record<string, any>) => String(row.id));
  }

  /**
   * CA4 (E10.2) : identifiants de projet portant TOUS les `tagIds` donnes
   * (ET logique). Calcule en JS plutot qu en SQL agregatif : `postgrest-js`
   * n expose pas de `HAVING count(distinct tag_id) = N` sur une table liee,
   * et le nombre de liens par tenant reste petit.
   */
  private async findProjectIdsHavingAllTags(tagIds: readonly string[]): Promise<string[]> {
    const { data, error } = await this.client
      .from('project_tag_links')
      .select('project_id, tag_id')
      .in('tag_id', [...tagIds]);
    if (error) throw new Error(error.message);

    const tagsByProject = new Map<string, Set<string>>();
    for (const row of (data ?? []) as { project_id: string; tag_id: string }[]) {
      const set = tagsByProject.get(row.project_id) ?? new Set<string>();
      set.add(row.tag_id);
      tagsByProject.set(row.project_id, set);
    }
    const required = new Set(tagIds);
    return [...tagsByProject.entries()]
      .filter(([, tags]) => [...required].every((tagId) => tags.has(tagId)))
      .map(([projectId]) => projectId);
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
      // Embed des tags (E10.2) : sans lui, renommer ou archiver un projet
      // qui en porte deja renverrait `tags: []` dans la meme reponse — les
      // deux endpoints qui rendent un `Project` doivent rester coherents.
      .select(`*, ${TAGS_EMBED}`)
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

  /**
   * Remplace la liste COMPLETE des tags d un projet (CA6, E10.2). `tagIds`
   * est GARANTI par le service comme des tags existants du tenant : ce port
   * ne fait que persister le lien. Retrait des liens absents puis insertion
   * des nouveaux plutot qu une diff cible : le nombre de tags par projet
   * reste petit (quelques unites), la simplicite prime sur l economie d une
   * requete.
   */
  async replaceTags(tenantId: TenantId, projectId: string, tagIds: readonly string[]): Promise<ProjectDto> {
    await this.assertProjectInTenant(tenantId, projectId);

    const { error: deleteError } = await this.client
      .from('project_tag_links')
      .delete()
      .eq('project_id', projectId);
    if (deleteError) throw new Error(deleteError.message);

    if (tagIds.length > 0) {
      const { error: insertError } = await this.client
        .from('project_tag_links')
        .insert(tagIds.map((tagId) => ({ project_id: projectId, tag_id: tagId })));
      if (insertError) throw new Error(insertError.message);
    }

    const updated = await this.findById(tenantId, projectId);
    if (!updated) throw new ProjectNotFoundError();
    return updated;
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
    tags: toProjectTagDtos(row.project_tag_links),
    created_by: row.created_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Aplati l embed PostgREST `project_tag_links(project_tags(...))` (CA6,
 * E10.2) en liste de tags. Absent (requete qui n a pas demande l embed) ->
 * tableau vide, jamais une erreur.
 *
 * TRIE PAR `id` (qa-review) : Postgres NE GARANTIT PAS l ordre des lignes
 * d un embed agrege sans `ORDER BY` explicite — il peut changer entre deux
 * lectures du MEME projet (HOT update, plan different, ...). Or l ETag
 * (`computeEntityTag`, src/modules/_shared/application/concurrency.ts) hache
 * une serialisation qui trie les CLES d objet mais PAS les elements de
 * tableau : deux lectures avec les memes tags dans un ordre different
 * produisaient deux hachages differents, et un `If-Match` pourtant a jour
 * cote client se voyait refuse en 409 sans qu aucune ecriture concurrente
 * n ait eu lieu. Trier ici, une fois, canonicalise l ordre pour CE DTO ET
 * pour l ETag qui en depend.
 */
/** Exporte uniquement pour test unitaire (stabilite d ordre, qa-review). */
export function toProjectTagDtos(links: unknown): ProjectTagDto[] {
  if (!Array.isArray(links)) return [];
  return links
    .map((link) => (link && typeof link === 'object' ? (link as Record<string, any>)['project_tags'] : null))
    .filter((tag): tag is Record<string, any> => Boolean(tag))
    .map((tag) => ({
      id: tag.id,
      tenant_id: tag.tenant_id,
      label: tag.label,
      color: tag.color,
      created_at: tag.created_at,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
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
