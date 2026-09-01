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

let sequence = 0;
export function fakeUuid(): string {
  sequence += 1;
  return `00000000-0000-4000-a000-${String(sequence).padStart(12, '0')}`;
}

export class InMemoryProjectsRepository implements ProjectsRepository {
  private readonly projects = new Map<string, ProjectDto>();
  private readonly items = new Map<string, ProjectItemDto>();

  async list(tenantId: TenantId, params: ListProjectsParams): Promise<ListProjectsResult> {
    const rows = [...this.projects.values()]
      .filter((p) => p.tenant_id === tenantId)
      .filter((p) => !params.customerId || p.customer_id === params.customerId)
      .filter((p) => !params.status || p.status === params.status)
      .filter((p) => {
        if (!params.q) return true;
        return p.name.toLowerCase().includes(params.q.toLowerCase());
      })
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0));
    return { rows };
  }

  async findById(tenantId: TenantId, projectId: string): Promise<ProjectDto | null> {
    const found = this.projects.get(projectId);
    return found && found.tenant_id === tenantId ? found : null;
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
    const current = await this.findById(tenantId, projectId);
    if (!current) throw new ProjectNotFoundError();
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
    return updated;
  }

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
