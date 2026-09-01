/**
 * Faux repository Projets (E10.1), sur le meme principe que
 * `customers-repository.fake.ts` (E10.4) : partage entre les tests de
 * contrat, jamais reecrit a la main deux fois (leçon du sprint —
 * docs/api/CONVENTIONS.md, un faux non teste qui diverge de l adaptateur
 * reel passe le typecheck sans etre detecte).
 */
import type { TenantId, UserId } from '@/kernel';
import {
  ProjectCommandRejectedError,
  ProjectNotFoundError,
  type ListProjectsParams,
  type ListProjectsResult,
  type ProjectsRepository,
} from '@/modules/projects/application/projects-repository';
import type {
  CreateProjectCommand,
  CreateProjectItemCommand,
  ProjectDetailDto,
  ProjectDto,
  ProjectItemDto,
  UpdateProjectCommand,
} from '@/modules/projects/api/contracts';
import type { InMemoryProjectTagsRepository } from './project-tags-repository.fake';

let sequence = 0;
export function fakeUuid(): string {
  sequence += 1;
  return `00000000-0000-4000-a000-${String(sequence).padStart(12, '0')}`;
}

/** Meme ordre que `.order('updated_at', {ascending:false}).order('id', {ascending:false})`. */
function compareUpdatedAtThenIdDesc(a: ProjectDto, b: ProjectDto): number {
  if (a.updated_at !== b.updated_at) return a.updated_at < b.updated_at ? 1 : -1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

/**
 * Meme condition que le `.or(updated_at.lt.<cursor>,and(updated_at.eq.<cursor>,id.lt.<id>))`
 * de l adaptateur Supabase : la page suivante commence STRICTEMENT apres le
 * curseur, dans le meme ordre de tri (desc).
 */
function isStrictlyAfterCursor(
  row: ProjectDto,
  cursor: Readonly<{ sort: string; id: string }>,
): boolean {
  if (row.updated_at < cursor.sort) return true;
  if (row.updated_at > cursor.sort) return false;
  return row.id < cursor.id;
}

export class InMemoryProjectsRepository implements ProjectsRepository {
  private readonly projects = new Map<string, ProjectDto>();
  private readonly items = new Map<string, ProjectItemDto>();
  /** projectId -> Set<tagId>, meme role que `project_tag_links` (E10.2). */
  private readonly tagLinks = new Map<string, Set<string>>();

  /**
   * Reference OPTIONNELLE vers le faux repository Tags de projet (E10.2),
   * pour resoudre l embed `tags` d un `ProjectDto` — meme role que la
   * jointure `project_tag_links(project_tags(...))` de l adaptateur Supabase
   * reel. `undefined` pour les tests qui n exercent pas E10.2 : `tags` reste
   * alors toujours `[]`, jamais une erreur.
   */
  constructor(private readonly tags?: InMemoryProjectTagsRepository) {}

  private resolveTags(projectId: string): ProjectDto['tags'] {
    const linked = this.tagLinks.get(projectId);
    if (!linked || !this.tags) return [];
    return [...linked]
      .map((tagId) => this.tags!.peek(tagId))
      .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag));
  }

  /** Recalcule TOUJOURS `tags` depuis `tagLinks` avant de rendre un projet : le champ stocke n est jamais la source de verite. */
  private withTags(project: ProjectDto): ProjectDto {
    return { ...project, tags: this.resolveTags(project.id) };
  }

  /**
   * B2 (qa-review) : le faux DOIT appliquer le meme filtre keyset + la meme
   * limite `size + 1` que l adaptateur reel (`projects-repository.ts`,
   * `.order('updated_at', {ascending:false}).order('id', {ascending:false})
   * .limit(size+1)` + `.or(updated_at.lt.<cursor>,and(updated_at.eq.<cursor>,
   * id.lt.<id>))`). Avant ce correctif, le curseur et la taille de page
   * etaient ignores : `meta.next_cursor` suivi par un client (Studio en
   * premier) rendait la MEME page en boucle — piege identique a
   * `markSiretVerified` en E10.4 (docs/api/CONVENTIONS.md), un faux qui
   * diverge silencieusement de l adaptateur qu il est cense representer.
   */
  async list(tenantId: TenantId, params: ListProjectsParams): Promise<ListProjectsResult> {
    let rows = [...this.projects.values()]
      .filter((p) => p.tenant_id === tenantId)
      .filter((p) => !params.customerId || p.customer_id === params.customerId)
      .filter((p) => !params.status || p.status === params.status)
      .filter((p) => {
        if (!params.q) return true;
        const needle = params.q.toLowerCase();
        // CA4 (E10.2) : meme critere que l adaptateur reel — nom du projet
        // OU nom du client (resolu via le faux repository Clients quand la
        // suite de test en fournit un, sinon uniquement le nom du projet).
        if (p.name.toLowerCase().includes(needle)) return true;
        const customerName = this.customerNames?.get(p.customer_id);
        return Boolean(customerName && customerName.toLowerCase().includes(needle));
      })
      // CA4 (E10.2) : filtre multi-tags en ET LOGIQUE.
      .filter((p) => {
        if (params.tagIds.length === 0) return true;
        const linked = this.tagLinks.get(p.id) ?? new Set<string>();
        return params.tagIds.every((tagId) => linked.has(tagId));
      })
      .sort(compareUpdatedAtThenIdDesc);

    if (params.cursor) {
      const cursor = params.cursor;
      rows = rows.filter((p) => isStrictlyAfterCursor(p, cursor));
    }

    // `size + 1` lignes au plus, NON tronquees davantage ici : c est
    // `buildPage()` (cote route) qui decoupe et encode `meta.next_cursor` a
    // partir de la ligne excedentaire — meme contrat que l adaptateur reel.
    return { rows: rows.slice(0, params.size + 1).map((p) => this.withTags(p)) };
  }

  async findById(tenantId: TenantId, projectId: string): Promise<ProjectDto | null> {
    const found = this.projects.get(projectId);
    return found && found.tenant_id === tenantId ? this.withTags(found) : null;
  }

  async findDetailById(tenantId: TenantId, projectId: string): Promise<ProjectDetailDto | null> {
    const project = await this.findById(tenantId, projectId);
    if (!project) return null;
    const items = [...this.items.values()]
      .filter((item) => item.project_id === projectId)
      .sort((a, b) => a.position - b.position);
    return { ...project, items };
  }

  async create(
    tenantId: TenantId,
    actor: UserId,
    command: CreateProjectCommand & Readonly<{ customer_id: string }>,
  ): Promise<ProjectDto> {
    void actor;
    const now = new Date().toISOString();
    const project: ProjectDto = {
      id: fakeUuid(),
      tenant_id: tenantId,
      customer_id: command.customer_id,
      name: command.name,
      status: 'active',
      tags: [],
      created_by: actor,
      created_at: now,
      updated_at: now,
    };
    this.projects.set(project.id, project);
    return project;
  }

  async update(
    tenantId: TenantId,
    projectId: string,
    command: UpdateProjectCommand,
  ): Promise<ProjectDto> {
    const current = this.projects.get(projectId);
    if (!current || current.tenant_id !== tenantId) throw new ProjectNotFoundError();
    const updated: ProjectDto = {
      ...current,
      ...('name' in command && command.name !== undefined ? { name: command.name } : {}),
      ...('customer_id' in command && command.customer_id !== undefined
        ? { customer_id: command.customer_id }
        : {}),
      ...('status' in command && command.status !== undefined ? { status: command.status } : {}),
      updated_at: new Date().toISOString(),
    };
    this.projects.set(projectId, updated);
    return this.withTags(updated);
  }

  /**
   * Remplace la liste complete des tags du projet (CA6, E10.2), et tient a
   * jour `linkCountByTagId` du faux repository Tags de projet quand il est
   * fourni — meme role que la contrainte FK RESTRICT reelle, pour que le
   * scenario "suppression refusee tant qu un tag est utilise" (CA5) soit
   * exercable sur les deux fakes ensemble.
   */
  async replaceTags(tenantId: TenantId, projectId: string, tagIds: readonly string[]): Promise<ProjectDto> {
    const project = this.projects.get(projectId);
    if (!project || project.tenant_id !== tenantId) throw new ProjectNotFoundError();

    const previous = this.tagLinks.get(projectId) ?? new Set<string>();
    if (this.tags) {
      for (const tagId of previous) {
        const count = this.tags.linkCountByTagId.get(tagId) ?? 0;
        this.tags.linkCountByTagId.set(tagId, Math.max(0, count - 1));
      }
    }

    const next = new Set(tagIds);
    this.tagLinks.set(projectId, next);
    if (this.tags) {
      for (const tagId of next) {
        this.tags.linkCountByTagId.set(tagId, (this.tags.linkCountByTagId.get(tagId) ?? 0) + 1);
      }
    }

    return this.withTags(project);
  }

  /**
   * CA4 (E10.2) — permet aux tests de contrat de simuler la recherche sur le
   * nom du CLIENT sans dependre d une instance reelle de
   * `InMemoryCustomersRepository` (couplage evite entre deux fakes de
   * modules distincts). `undefined` par defaut : seul le nom du projet est
   * alors cherche, comme avant E10.2.
   */
  customerNames?: Map<string, string>;

  async addItem(
    tenantId: TenantId,
    projectId: string,
    command: CreateProjectItemCommand,
  ): Promise<ProjectItemDto> {
    const project = await this.findById(tenantId, projectId);
    if (!project) throw new ProjectNotFoundError();
    const siblings = [...this.items.values()].filter((item) => item.project_id === projectId);
    const item: ProjectItemDto = {
      id: fakeUuid(),
      project_id: projectId,
      label: command.label,
      quote_payload: command.quote_payload,
      clariprint_config: command.clariprint_config ?? null,
      position: siblings.length,
      created_at: new Date().toISOString(),
    };
    this.items.set(item.id, item);
    return item;
  }

  async removeItem(tenantId: TenantId, projectId: string, itemId: string): Promise<void> {
    const project = await this.findById(tenantId, projectId);
    if (!project) throw new ProjectNotFoundError();
    const item = this.items.get(itemId);
    if (item && item.project_id === projectId) this.items.delete(itemId);
  }
}

export { ProjectCommandRejectedError, ProjectNotFoundError };
