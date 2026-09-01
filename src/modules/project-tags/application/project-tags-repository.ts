import type { TenantId } from '../../../kernel/ids/index.ts';
import type { CreateProjectTagCommand, ProjectTagColor, ProjectTagDto } from '../api/contracts.ts';

export type ListProjectTagsParams = Readonly<{ q: string | null }>;

/** Le tag n existe pas dans le tenant du jeton. */
export class ProjectTagNotFoundError extends Error {
  constructor(message = 'Tag introuvable dans ce tenant.') {
    super(message);
    this.name = 'ProjectTagNotFoundError';
  }
}

/** Rejete quand une commande viole une regle metier non portee par le schema Zod. */
export class ProjectTagCommandRejectedError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly fieldErrors: readonly Readonly<{ field: string; message: string }>[] = [],
  ) {
    super(message);
    this.name = 'ProjectTagCommandRejectedError';
  }
}

export type CreateProjectTagResult = Readonly<{
  tag: ProjectTagDto;
  /**
   * `false` quand le libelle normalise existait deja (CA2) : la route rend
   * alors 200 avec le tag EXISTANT plutot que 201. Deux commerciaux qui
   * saisissent le meme libelle en meme temps doivent obtenir le meme
   * identifiant, jamais deux tags jumeaux.
   */
  created: boolean;
}>;

/**
 * Port (interface) du referentiel Tags de projet. L implementation Supabase
 * vit dans src/adapters/supabase/project-tags-repository.ts ; ce module n en
 * connait que le contrat.
 */
export interface ProjectTagsRepository {
  /** Tries par libelle. `q` filtre pour l autocompletion (CA2). */
  list(tenantId: TenantId, params: ListProjectTagsParams): Promise<readonly ProjectTagDto[]>;

  /** `null` si absent ou hors du tenant (404 cote route, jamais 403). */
  findById(tenantId: TenantId, tagId: string): Promise<ProjectTagDto | null>;

  /** Sous-ensemble REELLEMENT trouve dans le tenant ; l appelant compare la taille pour detecter les manquants. */
  findManyByIds(tenantId: TenantId, tagIds: readonly string[]): Promise<readonly ProjectTagDto[]>;

  /**
   * Cree le tag, ou rend l EXISTANT si le libelle normalise (trim, casse
   * insensible) existe deja dans le tenant (CA2 — creation idempotente sur
   * le libelle, pas un conflit).
   *
   * La concurrence est geree COTE BASE : la contrainte unique
   * `project_tags_tenant_label_uidx` (tenant_id, btrim(lower(label))) est la
   * seule autorite, et l implementation retente une lecture sur le conflit
   * d insertion (23505) plutot que de se fier a un verifie-puis-ecris cote
   * application, qui laisserait une fenetre de course entre deux
   * commerciaux tapant le meme libelle au meme instant.
   */
  createOrGet(
    tenantId: TenantId,
    command: CreateProjectTagCommand & Readonly<{ color: ProjectTagColor }>,
  ): Promise<CreateProjectTagResult>;

  /**
   * Retire le tag du tenant. `ProjectTagCommandRejectedError` de code
   * `project_tag.in_use` (409) s il est encore lie a au moins un projet
   * (CA5) — porte par la contrainte de cle etrangere en base, pas seulement
   * par une verification applicative.
   */
  delete(tenantId: TenantId, tagId: string): Promise<void>;
}
