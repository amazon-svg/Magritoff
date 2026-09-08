/**
 * Service applicatif du module Etapes de production (story E10.13).
 *
 * Orchestration pure : aucune dependance a Supabase ni au HTTP. Les erreurs
 * metier sont des types dedies ; c est la route qui les traduit en Problem
 * RFC 7807, avec le request_id qu elle seule connait.
 */
import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import {
  PRODUCTION_STEP_COLORS,
  type ProductionStepColor,
  type ProductionStepDto,
  type ProductionStepStatusFilter,
} from '../api/contracts.ts';
import type { CreateProductionStepCommand, UpdateProductionStepCommand } from '../api/contracts.ts';
import {
  ProductionStepAccessDeniedError,
  ProductionStepNotFoundError,
  type ProductionStepsRepository,
} from './production-steps-repository.ts';

/** Droit metier exige par toute ecriture du referentiel (contrat, decision #9). */
const CAN_MANAGE_PRODUCTION_STEPS = 'can_manage_production_steps';

export type ListProductionStepsResult = Readonly<{
  /** Catalogue COMPLET, non filtre : fonde l `ETag` du catalogue (decision #7). */
  all: readonly ProductionStepDto[];
  /** Vue filtree par `status`, c est elle qui est rendue en `data`. */
  filtered: readonly ProductionStepDto[];
}>;

export type ProductionStepsServiceDependencies = Readonly<{
  repository: ProductionStepsRepository;
}>;

export class ProductionStepsService {
  private readonly repository: ProductionStepsRepository;

  constructor(dependencies: ProductionStepsServiceDependencies) {
    this.repository = dependencies.repository;
  }

  async list(tenantId: TenantId, status: ProductionStepStatusFilter | null): Promise<ListProductionStepsResult> {
    const { all } = await this.repository.list(tenantId);
    const filtered =
      status === null ? all : all.filter((step) => step.is_active === (status === 'active'));
    return { all, filtered };
  }

  async getById(tenantId: TenantId, stepId: string): Promise<ProductionStepDto> {
    const step = await this.repository.findById(tenantId, stepId);
    if (!step) throw new ProductionStepNotFoundError();
    return step;
  }

  /**
   * Une commande `current_production_step_id` filtre une liste de commandes
   * (`listCommercialOrders`, CA6) : l appelant doit savoir si l identifiant
   * fourni appartient reellement au tenant AVANT de filtrer, sous peine de
   * rendre une page silencieusement vide (contrat : 422
   * `production_step.not_found`, jamais une page vide).
   */
  async exists(tenantId: TenantId, stepId: string): Promise<boolean> {
    const step = await this.repository.findById(tenantId, stepId);
    return step !== null;
  }

  /**
   * Cree l etape (CA2). Couleur ABSENTE -> affectee ICI, deterministe pour un
   * meme libelle normalise (meme mecanique que `colorForLabel` de
   * project-tags, contrat de `CreateProductionStepCommand.color`). Le choix
   * reste offert a l appelant, contrairement aux tags : une etape se cree
   * dans un ecran de parametrage, pas a la volee.
   */
  async create(
    tenantId: TenantId,
    actor: UserId,
    command: CreateProductionStepCommand,
  ): Promise<ProductionStepDto> {
    await this.assertCanManageProductionSteps(tenantId, actor);
    const color = command.color ?? colorForLabel(command.label);
    return this.repository.create(tenantId, actor, { ...command, color });
  }

  async update(
    tenantId: TenantId,
    actor: UserId,
    stepId: string,
    command: UpdateProductionStepCommand,
  ): Promise<ProductionStepDto> {
    await this.assertCanManageProductionSteps(tenantId, actor);
    return this.repository.update(tenantId, stepId, command);
  }

  async remove(tenantId: TenantId, actor: UserId, stepId: string): Promise<void> {
    await this.assertCanManageProductionSteps(tenantId, actor);
    await this.repository.remove(tenantId, actor, stepId);
  }

  async reorder(
    tenantId: TenantId,
    actor: UserId,
    stepIds: readonly string[],
  ): Promise<readonly ProductionStepDto[]> {
    await this.assertCanManageProductionSteps(tenantId, actor);
    return this.repository.reorder(tenantId, actor, stepIds);
  }

  /**
   * Garde d ecriture (403 `identity.role_required` si refuse), verifiee
   * AVANT toute autre validation — PUBLIQUE (meme raison qu en E10.6,
   * `PriceRulesService.assertCanManagePricing`) : la route l appelle
   * EXPLICITEMENT avant de lire la ressource courante pour calculer l `ETag`
   * et verifier `If-Match`, pour qu un acteur sans le droit recoive 403 avant
   * un eventuel 404/409.
   */
  async assertCanManageProductionSteps(tenantId: TenantId, actor: UserId): Promise<void> {
    const authorized = await this.repository.actorHasCapability(tenantId, actor, CAN_MANAGE_PRODUCTION_STEPS);
    if (!authorized) throw new ProductionStepAccessDeniedError();
  }
}

/**
 * Assigne une couleur STABLE de la palette fermee a partir du libelle
 * normalise (trim, casse insensible). Fonction pure, meme algorithme que
 * `colorForLabel` de project-tags (E10.2) — DUPLIQUEE plutot que partagee :
 * deux catalogues sans rapport, un helper commun lierait leur evolution
 * (contrat `ProductionStepColor`, schema distinct de `ProjectTagColor`).
 */
export function colorForLabel(label: string): ProductionStepColor {
  const normalized = label.trim().toLowerCase();
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return PRODUCTION_STEP_COLORS[hash % PRODUCTION_STEP_COLORS.length]!;
}
