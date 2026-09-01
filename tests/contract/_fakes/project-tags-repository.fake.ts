/**
 * Faux repository Tags de projet (E10.2), sur le meme principe que
 * `customers-repository.fake.ts` / `projects-repository.fake.ts` : partage
 * entre les tests de contrat, jamais reecrit a la main deux fois.
 *
 * `createOrGet` reproduit FIDELEMENT le comportement de concurrence de
 * l adaptateur Supabase reel (contrainte unique sur le libelle normalise,
 * conflit d insertion resolu par une relecture) : un test qui appellerait ce
 * faux deux fois avec le meme libelle DOIT obtenir le meme identifiant, pas
 * deux tags jumeaux (CA2) — sinon le faux divergerait silencieusement de
 * l adaptateur qu il represente (lecon E10.4/E10.1, docs/api/CONVENTIONS.md).
 */
import type { TenantId } from '@/kernel';
import {
  ProjectTagCommandRejectedError,
  ProjectTagNotFoundError,
  type CreateProjectTagResult,
  type ListProjectTagsParams,
  type ProjectTagsRepository,
} from '@/modules/project-tags/application/project-tags-repository';
import type { CreateProjectTagCommand, ProjectTagColor, ProjectTagDto } from '@/modules/project-tags/api/contracts';

let sequence = 0;
export function fakeTagUuid(): string {
  sequence += 1;
  return `00000000-0000-4000-b000-${String(sequence).padStart(12, '0')}`;
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

export class InMemoryProjectTagsRepository implements ProjectTagsRepository {
  private readonly tags = new Map<string, ProjectTagDto>();
  /** Simule la contrainte unique (tenant_id, btrim(lower(label))) en base. */
  private readonly byNormalizedLabel = new Map<string, string>();
  /** Simule la FK RESTRICT `project_tag_links.tag_id -> project_tags.id`. */
  readonly linkCountByTagId = new Map<string, number>();

  async list(tenantId: TenantId, params: ListProjectTagsParams): Promise<readonly ProjectTagDto[]> {
    let rows = [...this.tags.values()].filter((tag) => tag.tenant_id === tenantId);
    if (params.q) {
      const needle = params.q.toLowerCase();
      rows = rows.filter((tag) => tag.label.toLowerCase().includes(needle));
    }
    return rows.sort((a, b) => a.label.localeCompare(b.label));
  }

  async findById(tenantId: TenantId, tagId: string): Promise<ProjectTagDto | null> {
    const found = this.tags.get(tagId);
    return found && found.tenant_id === tenantId ? found : null;
  }

  /**
   * Lecture SANS controle de tenant, reservee a `InMemoryProjectsRepository`
   * pour resoudre l embed `tags` d un projet (meme role que la jointure
   * `project_tag_links(project_tags(...))` de l adaptateur Supabase reel).
   */
  peek(tagId: string): ProjectTagDto | undefined {
    return this.tags.get(tagId);
  }

  async findManyByIds(tenantId: TenantId, tagIds: readonly string[]): Promise<readonly ProjectTagDto[]> {
    return tagIds
      .map((id) => this.tags.get(id))
      .filter((tag): tag is ProjectTagDto => Boolean(tag) && tag!.tenant_id === tenantId);
  }

  async createOrGet(
    tenantId: TenantId,
    command: CreateProjectTagCommand & Readonly<{ color: ProjectTagColor }>,
  ): Promise<CreateProjectTagResult> {
    const key = `${tenantId}::${normalizeLabel(command.label)}`;
    const existingId = this.byNormalizedLabel.get(key);
    if (existingId) {
      const existing = this.tags.get(existingId);
      if (existing) return { tag: existing, created: false };
    }

    const tag: ProjectTagDto = {
      id: fakeTagUuid(),
      tenant_id: tenantId,
      label: command.label,
      color: command.color,
      created_at: new Date().toISOString(),
    };
    this.tags.set(tag.id, tag);
    this.byNormalizedLabel.set(key, tag.id);
    return { tag, created: true };
  }

  async delete(tenantId: TenantId, tagId: string): Promise<void> {
    const existing = await this.findById(tenantId, tagId);
    if (!existing) throw new ProjectTagNotFoundError();
    if ((this.linkCountByTagId.get(tagId) ?? 0) > 0) {
      // Meme code que la FK RESTRICT reelle (voir project-tags-repository.ts
      // adaptateur Supabase, `toDomainError` sur 23503).
      throw new ProjectTagCommandRejectedError(
        'project_tag.in_use',
        'Ce tag est encore utilisé par au moins un projet.',
        [{ field: 'id', message: 'Tag encore utilisé par au moins un projet.' }],
      );
    }
    this.tags.delete(tagId);
    const key = `${tenantId}::${normalizeLabel(existing.label)}`;
    this.byNormalizedLabel.delete(key);
  }
}
