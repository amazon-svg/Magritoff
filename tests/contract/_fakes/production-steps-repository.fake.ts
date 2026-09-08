/**
 * Faux repository Etapes de production (E10.13), utilise par
 * `production-steps.contract.test.ts` (et injecte, vide, dans
 * `commercial-orders.contract.test.ts` pour la validation
 * `current_production_step_id`).
 *
 * Reimplemente FIDELEMENT les regles tenues EN BASE par la migration
 * `20260908020000` : unicite du libelle NORMALISE (etapes desactivees
 * comprises), position affectee en fin de flux, plafond de 50, reindexation
 * a la suppression et au reordonnancement, exhaustivite du reordonnancement.
 */
import type { TenantId, UserId } from '@/kernel';
import {
  ProductionStepInUseError,
  ProductionStepLabelConflictError,
  ProductionStepLimitReachedError,
  ProductionStepNotFoundError,
  ProductionStepPositionsMismatchError,
  type ListProductionStepsResult,
  type ProductionStepsRepository,
} from '@/modules/production-steps/application/production-steps-repository';
import type {
  CreateProductionStepCommand,
  ProductionStepDto,
  UpdateProductionStepCommand,
} from '@/modules/production-steps/api/contracts';

let sequence = 0;
export function fakeStepUuid(): string {
  sequence += 1;
  return `00000000-0000-4000-9200-${String(sequence).padStart(12, '0')}`;
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

export class InMemoryProductionStepsRepository implements ProductionStepsRepository {
  private readonly steps = new Map<string, ProductionStepDto>();
  /** Etapes REFERENCEES par au moins une commande (TEST) — simule la FK `on delete restrict`. */
  private readonly inUse = new Set<string>();
  /**
   * Droit `can_manage_production_steps` par tenant+acteur (E10.13). `true`
   * par defaut (equivalent d un `admin`) — un test force `false`
   * explicitement pour exercer la garde 403 `identity.role_required`, meme
   * pattern que `InMemoryPriceRulesRepository`.
   */
  private readonly actorCapabilities = new Map<string, boolean>();

  /** TEST UNIQUEMENT. */
  setActorCapabilityForTest(tenantId: string, actorId: string, capability: string, granted: boolean | null): void {
    const key = `${tenantId}:${actorId}:${capability}`;
    if (granted === null) this.actorCapabilities.delete(key);
    else this.actorCapabilities.set(key, granted);
  }

  /** TEST UNIQUEMENT — simule qu au moins une commande porte cette etape (CA3). */
  setInUseForTest(stepId: string, inUse: boolean): void {
    if (inUse) this.inUse.add(stepId);
    else this.inUse.delete(stepId);
  }

  /** TEST UNIQUEMENT — seed direct, sans passer par `create()` (evite le plafond/l unicite pour construire un jeu de fixtures). */
  seedForTest(step: ProductionStepDto): void {
    this.steps.set(step.id, step);
  }

  async actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean> {
    return this.actorCapabilities.get(`${tenantId}:${actorId}:${capability}`) ?? true;
  }

  async list(tenantId: TenantId): Promise<ListProductionStepsResult> {
    const all = [...this.steps.values()]
      .filter((step) => step.tenant_id === tenantId)
      .sort((a, b) => a.position - b.position);
    return { all };
  }

  async findById(tenantId: TenantId, stepId: string): Promise<ProductionStepDto | null> {
    const found = this.steps.get(stepId);
    return found && found.tenant_id === tenantId ? found : null;
  }

  async create(
    tenantId: TenantId,
    actor: UserId,
    command: CreateProductionStepCommand,
  ): Promise<ProductionStepDto> {
    void actor;
    const tenantSteps = [...this.steps.values()].filter((step) => step.tenant_id === tenantId);
    if (tenantSteps.length >= 50) throw new ProductionStepLimitReachedError();

    const normalized = normalizeLabel(command.label);
    if (tenantSteps.some((step) => normalizeLabel(step.label) === normalized)) {
      throw new ProductionStepLabelConflictError();
    }

    const now = new Date().toISOString();
    const step: ProductionStepDto = {
      id: fakeStepUuid(),
      tenant_id: tenantId,
      label: command.label,
      position: tenantSteps.length,
      color: command.color ?? 'slate',
      is_terminal: command.is_terminal,
      is_active: true,
      created_at: now,
      updated_at: now,
    };
    this.steps.set(step.id, step);
    return step;
  }

  async update(
    tenantId: TenantId,
    stepId: string,
    command: UpdateProductionStepCommand,
  ): Promise<ProductionStepDto> {
    const current = await this.findById(tenantId, stepId);
    if (!current) throw new ProductionStepNotFoundError();

    if ('label' in command && command.label !== undefined) {
      const normalized = normalizeLabel(command.label);
      const conflict = [...this.steps.values()].some(
        (step) => step.tenant_id === tenantId && step.id !== stepId && normalizeLabel(step.label) === normalized,
      );
      if (conflict) throw new ProductionStepLabelConflictError();
    }

    const updated: ProductionStepDto = {
      ...current,
      ...('label' in command ? { label: command.label! } : {}),
      ...('color' in command ? { color: command.color! } : {}),
      ...('is_terminal' in command ? { is_terminal: command.is_terminal! } : {}),
      ...('is_active' in command ? { is_active: command.is_active! } : {}),
      updated_at: new Date().toISOString(),
    };
    this.steps.set(stepId, updated);
    return updated;
  }

  async remove(tenantId: TenantId, actor: UserId, stepId: string): Promise<void> {
    void actor;
    const current = await this.findById(tenantId, stepId);
    if (!current) throw new ProductionStepNotFoundError();
    if (this.inUse.has(stepId)) throw new ProductionStepInUseError();

    this.steps.delete(stepId);
    // Reindexation 0..n-1 des etapes restantes, meme discipline que la
    // fonction SQL `api_delete_production_step`.
    const remaining = [...this.steps.values()]
      .filter((step) => step.tenant_id === tenantId)
      .sort((a, b) => a.position - b.position);
    remaining.forEach((step, index) => {
      if (step.position !== index) this.steps.set(step.id, { ...step, position: index });
    });
  }

  async reorder(
    tenantId: TenantId,
    actor: UserId,
    stepIds: readonly string[],
  ): Promise<readonly ProductionStepDto[]> {
    void actor;
    const existing = [...this.steps.values()].filter((step) => step.tenant_id === tenantId);
    const existingIds = new Set(existing.map((step) => step.id));
    const requestedIds = new Set(stepIds);
    const exhaustive =
      stepIds.length === existing.length &&
      requestedIds.size === stepIds.length &&
      stepIds.every((id) => existingIds.has(id));
    if (!exhaustive) throw new ProductionStepPositionsMismatchError();

    stepIds.forEach((id, index) => {
      const step = this.steps.get(id)!;
      this.steps.set(id, { ...step, position: index });
    });

    const { all } = await this.list(tenantId);
    return all;
  }
}
