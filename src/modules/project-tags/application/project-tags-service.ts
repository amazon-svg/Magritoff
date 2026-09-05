/**
 * Service applicatif du module Tags de projet (story E10.2).
 *
 * Orchestration pure : aucune dependance a Supabase ni au HTTP. Les erreurs
 * metier sont des types dedies (`ProjectTagNotFoundError`,
 * `ProjectTagCommandRejectedError`) ; c est la route qui les traduit en
 * Problem RFC 7807, avec le request_id qu elle seule connait.
 */
import type { TenantId } from '../../../kernel/ids/index.ts';
import { PROJECT_TAG_COLORS, type CreateProjectTagCommand, type ProjectTagColor, type ProjectTagDto } from '../api/contracts.ts';
import {
  ProjectTagNotFoundError,
  type CreateProjectTagResult,
  type ListProjectTagsParams,
  type ProjectTagsRepository,
} from './project-tags-repository.ts';

export type ProjectTagsServiceDependencies = Readonly<{
  repository: ProjectTagsRepository;
}>;

export class ProjectTagsService {
  private readonly repository: ProjectTagsRepository;

  constructor(dependencies: ProjectTagsServiceDependencies) {
    this.repository = dependencies.repository;
  }

  list(tenantId: TenantId, params: ListProjectTagsParams): Promise<readonly ProjectTagDto[]> {
    return this.repository.list(tenantId, params);
  }

  findManyByIds(tenantId: TenantId, tagIds: readonly string[]): Promise<readonly ProjectTagDto[]> {
    return this.repository.findManyByIds(tenantId, tagIds);
  }

  /**
   * Cree le tag a la volee (CA2), ou rend l existant si le libelle normalise
   * existait deja. La couleur n est jamais fournie par l appelant : elle
   * vient de `colorForLabel`, deterministe pour un meme libelle normalise —
   * deux creations concurrentes du meme libelle calculent donc la MEME
   * couleur avant meme de savoir laquelle gagne la course d insertion cote
   * base, ce qui rend le rejeu (celui qui perd la course et relit le tag
   * existant) coherent quel que soit l ordre d arrivee.
   */
  create(tenantId: TenantId, command: CreateProjectTagCommand): Promise<CreateProjectTagResult> {
    const color = colorForLabel(command.label);
    return this.repository.createOrGet(tenantId, { ...command, color });
  }

  async delete(tenantId: TenantId, tagId: string): Promise<void> {
    const existing = await this.repository.findById(tenantId, tagId);
    if (!existing) throw new ProjectTagNotFoundError();
    await this.repository.delete(tenantId, tagId);
  }
}

/**
 * Assigne une couleur STABLE de la palette fermee a partir du libelle
 * normalise (trim, casse insensible — CA1). Fonction pure, testee
 * isolement (tests/modules/project-tags/color-for-label.test.ts) :
 * deterministe pour un meme libelle, repartie sur toute la palette pour ne
 * pas concentrer tous les tags sur une seule couleur.
 */
export function colorForLabel(label: string): ProjectTagColor {
  const normalized = label.trim().toLowerCase();
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return PROJECT_TAG_COLORS[hash % PROJECT_TAG_COLORS.length]!;
}
