/**
 * Service applicatif du module Projets (story E10.1).
 *
 * Orchestration pure : aucune dependance a Supabase ni au HTTP. Les erreurs
 * metier sont des types dedies (`ProjectNotFoundError`,
 * `ProjectCommandRejectedError`) ; c est la route qui les traduit en Problem
 * RFC 7807, avec le request_id qu elle seule connait.
 */
import { uuidSchema } from '../../_shared/api/index.ts';
import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type { OutboxPublisher } from '../../_shared/application/index.ts';
import type { CustomersRepository } from '../../customers/application/customers-repository.ts';
import type { ProjectTagsRepository } from '../../project-tags/application/project-tags-repository.ts';
import type {
  CreateProjectCommand,
  CreateProjectItemCommand,
  ProjectDetailDto,
  ProjectDto,
  ProjectItemDto,
  ReplaceProjectTagsCommand,
  UpdateProjectCommand,
} from '../api/contracts.ts';
import {
  ProjectCommandRejectedError,
  ProjectNotFoundError,
  type ListProjectsParams,
  type ListProjectsResult,
  type ProjectsRepository,
} from './projects-repository.ts';

/** Code metier stable (CA3) : partage entre `create()` et `update()`. */
const CUSTOMER_REQUIRED_CODE = 'project.customer_required';
/** Code metier stable (CA6, E10.2) : un `tag_ids` reference un tag inconnu ou hors du tenant. */
const TAG_UNKNOWN_CODE = 'project.tag_unknown';

export type ProjectsServiceDependencies = Readonly<{
  repository: ProjectsRepository;
  /**
   * Reutilise le referentiel Clients (E10.4) pour verifier qu un
   * `customer_id` existe reellement dans le tenant AVANT de creer ou
   * modifier un projet (CA3) — pas de duplication de la logique
   * d existence d un client.
   */
  customers: CustomersRepository;
  /**
   * Reutilise le referentiel Tags de projet (E10.2) pour verifier qu un
   * `tag_ids` fourni a `replaceTags()` ne reference que des tags existants
   * du tenant — pas de duplication de cette logique.
   */
  projectTags: ProjectTagsRepository;
  outbox: OutboxPublisher;
}>;

export class ProjectsService {
  private readonly repository: ProjectsRepository;
  private readonly customers: CustomersRepository;
  private readonly projectTags: ProjectTagsRepository;
  private readonly outbox: OutboxPublisher;

  constructor(dependencies: ProjectsServiceDependencies) {
    this.repository = dependencies.repository;
    this.customers = dependencies.customers;
    this.projectTags = dependencies.projectTags;
    this.outbox = dependencies.outbox;
  }

  list(tenantId: TenantId, params: ListProjectsParams): Promise<ListProjectsResult> {
    return this.repository.list(tenantId, params);
  }

  async getDetail(tenantId: TenantId, projectId: string): Promise<ProjectDetailDto> {
    const detail = await this.repository.findDetailById(tenantId, projectId);
    if (!detail) throw new ProjectNotFoundError();
    return detail;
  }

  async getSummary(tenantId: TenantId, projectId: string): Promise<ProjectDto> {
    const project = await this.repository.findById(tenantId, projectId);
    if (!project) throw new ProjectNotFoundError();
    return project;
  }

  /**
   * Cree un projet (CA3, événement `project.created`). `customer_id` absent
   * ou ne correspondant a aucun client du tenant est refuse avec LE MEME
   * code metier (`project.customer_required`) dans les deux cas — c est
   * exactement le CA3 : « un `customer_id` absent ou inconnu renvoie 422 ».
   */
  async create(
    tenantId: TenantId,
    actor: UserId,
    command: CreateProjectCommand,
  ): Promise<ProjectDto> {
    const customerId = await this.requireExistingCustomer(tenantId, command.customer_id);

    const created = await this.repository.create(tenantId, actor, {
      ...command,
      customer_id: customerId,
    });
    // L evenement est publie dans le meme flux applicatif que l ecriture ;
    // OutboxPublisher.append() ecrit en base, pas en HTTP direct (CA10).
    await this.outbox.publish({
      name: 'project.created',
      tenantId,
      aggregateType: 'project',
      aggregateId: created.id,
      payload: {
        project_id: created.id,
        customer_id: created.customer_id,
        name: created.name,
      },
    });
    return created;
  }

  async update(
    tenantId: TenantId,
    projectId: string,
    command: UpdateProjectCommand,
  ): Promise<ProjectDto> {
    const current = await this.repository.findById(tenantId, projectId);
    if (!current) throw new ProjectNotFoundError();

    let patch: UpdateProjectCommand = command;
    if (command.customer_id !== undefined) {
      const customerId = await this.requireExistingCustomer(tenantId, command.customer_id);
      patch = { ...command, customer_id: customerId };
    }

    return this.repository.update(tenantId, projectId, patch);
  }

  async addItem(
    tenantId: TenantId,
    projectId: string,
    command: CreateProjectItemCommand,
  ): Promise<ProjectItemDto> {
    const exists = await this.repository.findById(tenantId, projectId);
    if (!exists) throw new ProjectNotFoundError();
    return this.repository.addItem(tenantId, projectId, command);
  }

  async removeItem(tenantId: TenantId, projectId: string, itemId: string): Promise<void> {
    const exists = await this.repository.findById(tenantId, projectId);
    if (!exists) throw new ProjectNotFoundError();
    return this.repository.removeItem(tenantId, projectId, itemId);
  }

  /**
   * Remplace la liste complete des tags d un projet (CA6). Chaque
   * `tag_ids` DOIT exister dans le tenant AVANT l ecriture — sinon
   * `ProjectCommandRejectedError('project.tag_unknown')` (422), meme
   * discipline que `requireExistingCustomer` pour `customer_id` (CA3).
   */
  async replaceTags(
    tenantId: TenantId,
    projectId: string,
    command: ReplaceProjectTagsCommand,
  ): Promise<ProjectDto> {
    const exists = await this.repository.findById(tenantId, projectId);
    if (!exists) throw new ProjectNotFoundError();

    const uniqueTagIds = [...new Set(command.tag_ids)];
    if (uniqueTagIds.length > 0) {
      const found = await this.projectTags.findManyByIds(tenantId, uniqueTagIds);
      if (found.length !== uniqueTagIds.length) {
        const foundIds = new Set(found.map((tag) => tag.id));
        const missing = uniqueTagIds.filter((id) => !foundIds.has(id));
        throw new ProjectCommandRejectedError(
          TAG_UNKNOWN_CODE,
          'Un ou plusieurs tags sont introuvables dans ce tenant.',
          missing.map((id) => ({ field: 'tag_ids', message: `Tag inconnu de ce tenant : ${id}` })),
        );
      }
    }

    return this.repository.replaceTags(tenantId, projectId, uniqueTagIds);
  }

  /**
   * CA3 — un seul point de verification pour `create()` ET `update()` :
   * `customerId` absent, mal forme, ou introuvable dans le tenant produisent
   * TOUS le meme `ProjectCommandRejectedError('project.customer_required')`.
   */
  private async requireExistingCustomer(
    tenantId: TenantId,
    customerId: string | undefined,
  ): Promise<string> {
    const trimmed = customerId?.trim();
    if (!trimmed || !uuidSchema.safeParse(trimmed).success) {
      throw customerRequiredError();
    }
    const customer = await this.customers.findById(tenantId, trimmed);
    if (!customer) throw customerRequiredError();
    return trimmed;
  }
}

function customerRequiredError(): ProjectCommandRejectedError {
  return new ProjectCommandRejectedError(
    CUSTOMER_REQUIRED_CODE,
    'Un projet exige un client existant du tenant.',
    [{ field: 'customer_id', message: 'Client requis, absent ou inconnu de ce tenant.' }],
  );
}
