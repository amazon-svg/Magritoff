import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type {
  CreateProjectCommand,
  CreateProjectItemCommand,
  ProjectDetailDto,
  ProjectDto,
  ProjectItemDto,
  ProjectStatus,
  UpdateProjectCommand,
} from '../api/contracts.ts';

export type ListProjectsParams = Readonly<{
  q: string | null;
  customerId: string | null;
  status: ProjectStatus | null;
  /**
   * Filtre multi-tags en ET LOGIQUE (CA4, E10.2) : seuls les projets portant
   * TOUS les tags de la liste sont rendus. Vide -> aucun filtre.
   */
  tagIds: readonly string[];
  size: number;
  cursor: Readonly<{ sort: string; id: string }> | null;
}>;

export type ListProjectsResult = Readonly<{
  /**
   * `size + 1` lignes lues au plus (non tronquees ici) : la ligne
   * excedentaire, si presente, prouve l existence d une page suivante.
   * `buildPage()` fait le decoupage et encode le curseur suivant.
   */
  rows: readonly ProjectDto[];
}>;

/** Rejete quand une commande viole une regle metier non portee par le schema Zod. */
export class ProjectCommandRejectedError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly fieldErrors: readonly Readonly<{ field: string; message: string }>[] = [],
  ) {
    super(message);
    this.name = 'ProjectCommandRejectedError';
  }
}

/** Le projet (ou l element) n existe pas dans le tenant du jeton. */
export class ProjectNotFoundError extends Error {
  constructor(message = 'Projet introuvable dans ce tenant.') {
    super(message);
    this.name = 'ProjectNotFoundError';
  }
}

/**
 * Port (interface) du referentiel Projets. L implementation Supabase vit dans
 * src/adapters/supabase/projects-repository.ts ; ce module n en connait que
 * le contrat.
 */
export interface ProjectsRepository {
  list(tenantId: TenantId, params: ListProjectsParams): Promise<ListProjectsResult>;

  /** `null` si absent ou hors du tenant (404 cote route, jamais 403). */
  findById(tenantId: TenantId, projectId: string): Promise<ProjectDto | null>;

  findDetailById(tenantId: TenantId, projectId: string): Promise<ProjectDetailDto | null>;

  /**
   * `command.customer_id` est ici GARANTI par le service comme etant un
   * UUID d un client existant du tenant : la verification metier (CA3) est
   * faite en amont, ce port ne fait que persister.
   */
  create(
    tenantId: TenantId,
    actor: UserId,
    command: CreateProjectCommand & Readonly<{ customer_id: string }>,
  ): Promise<ProjectDto>;

  update(tenantId: TenantId, projectId: string, command: UpdateProjectCommand): Promise<ProjectDto>;

  addItem(
    tenantId: TenantId,
    projectId: string,
    command: CreateProjectItemCommand,
  ): Promise<ProjectItemDto>;

  /** Retrait du LIEN uniquement ; ne supprime jamais un historique de chiffrage ailleurs. */
  removeItem(tenantId: TenantId, projectId: string, itemId: string): Promise<void>;

  /**
   * Remplace la liste COMPLETE des tags d un projet (CA6, E10.2). `tagIds`
   * est GARANTI par le service comme un ensemble de tags EXISTANTS dans le
   * tenant : la verification metier est faite en amont, ce port ne fait que
   * persister le lien. Ne supprime jamais les tags eux-memes du tenant
   * (CA5) — seuls les LIENS au projet changent.
   */
  replaceTags(tenantId: TenantId, projectId: string, tagIds: readonly string[]): Promise<ProjectDto>;
}
