import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type {
  CreateProductionStepCommand,
  ProductionStepDto,
  ProductionStepStatusFilter,
  UpdateProductionStepCommand,
} from '../api/contracts.ts';

/** L etape n existe pas dans le tenant du jeton (404 `production_step.not_found`). */
export class ProductionStepNotFoundError extends Error {
  constructor(message = 'Etape de production introuvable dans ce tenant.') {
    super(message);
    this.name = 'ProductionStepNotFoundError';
  }
}

/**
 * Libelle deja porte (forme normalisee) par une autre etape du tenant, ETAPE
 * DESACTIVEE COMPRISE (409 `production_step.label_conflict`, decision #11 du
 * contrat).
 */
export class ProductionStepLabelConflictError extends Error {
  constructor(message = 'Une etape porte deja ce libelle dans ce tenant.') {
    super(message);
    this.name = 'ProductionStepLabelConflictError';
  }
}

/**
 * L etape est portee par au moins une commande comme etape courante (409
 * `production_step.in_use`), tenu EN BASE par la cle etrangere
 * `commercial_orders.current_production_step_id ... on delete restrict`.
 * L issue est la desactivation (CA3).
 */
export class ProductionStepInUseError extends Error {
  constructor(message = 'Etape encore portee par au moins une commande.') {
    super(message);
    this.name = 'ProductionStepInUseError';
  }
}

/** Le tenant porte deja 50 etapes (422 `production_step.limit_reached`). */
export class ProductionStepLimitReachedError extends Error {
  constructor(message = 'Ce tenant a deja atteint le plafond de 50 etapes de production.') {
    super(message);
    this.name = 'ProductionStepLimitReachedError';
  }
}

/**
 * `step_ids` ne recouvre pas EXACTEMENT les etapes du tenant (422
 * `production_step.positions_mismatch`).
 */
export class ProductionStepPositionsMismatchError extends Error {
  constructor(message = 'step_ids ne recouvre pas exactement les etapes du tenant.') {
    super(message);
    this.name = 'ProductionStepPositionsMismatchError';
  }
}

/**
 * L acteur n a pas le droit metier `can_manage_production_steps` requis pour
 * ecrire le referentiel (403 `identity.role_required`). Un `admin` du tenant
 * le recoit par derivation (`public.user_has_capability`).
 */
export class ProductionStepAccessDeniedError extends Error {
  constructor(
    message = 'Le droit can_manage_production_steps est requis pour administrer les etapes de production.',
  ) {
    super(message);
    this.name = 'ProductionStepAccessDeniedError';
  }
}

/**
 * Catalogue COMPLET du tenant (jamais filtre par `status` a la source :
 * l `ETag` porte sur cet ensemble entier, decision #7 du contrat). Le filtre
 * `status` est applique par le SERVICE sur `all`, pas par le repository — la
 * meme lecture sert donc a la fois l `ETag` du catalogue et la reponse
 * eventuellement filtree.
 */
export type ListProductionStepsResult = Readonly<{
  all: readonly ProductionStepDto[];
}>;

/**
 * Port (interface) du referentiel des etapes de production (E10.13).
 * L implementation Supabase vit dans
 * src/adapters/supabase/production-steps-repository.ts ; ce module n en
 * connait que le contrat.
 */
export interface ProductionStepsRepository {
  list(tenantId: TenantId): Promise<ListProductionStepsResult>;

  /** `null` si absente ou hors du tenant (404 cote route, jamais 403). */
  findById(tenantId: TenantId, stepId: string): Promise<ProductionStepDto | null>;

  /**
   * `security definer` (`api_create_production_step`) : plafond de 50 verifie
   * SOUS VERROU, position affectee par le serveur (fin de flux). Leve
   * `ProductionStepLimitReachedError`/`ProductionStepLabelConflictError`/
   * `ProductionStepAccessDeniedError` selon le motif de refus.
   */
  create(tenantId: TenantId, actor: UserId, command: CreateProductionStepCommand): Promise<ProductionStepDto>;

  /**
   * `UPDATE` direct, garde par la RLS (`production_steps_write`) : AUCUNE
   * fonction dediee (contrat, §3). Leve `ProductionStepNotFoundError`/
   * `ProductionStepLabelConflictError`/`ProductionStepAccessDeniedError`.
   */
  update(tenantId: TenantId, stepId: string, command: UpdateProductionStepCommand): Promise<ProductionStepDto>;

  /**
   * `security definer` (`api_delete_production_step`) : reindexation des
   * positions restantes dans la MEME transaction. Leve
   * `ProductionStepNotFoundError`/`ProductionStepInUseError`/
   * `ProductionStepAccessDeniedError`.
   */
  remove(tenantId: TenantId, actor: UserId, stepId: string): Promise<void>;

  /**
   * `security definer` (`api_reorder_production_steps`) : reaffecte
   * `position` 0..n-1 dans l ordre de `stepIds`, EN UNE TRANSACTION. Rend le
   * catalogue complet dans le nouvel ordre. Leve
   * `ProductionStepPositionsMismatchError`/`ProductionStepAccessDeniedError`.
   */
  reorder(tenantId: TenantId, actor: UserId, stepIds: readonly string[]): Promise<readonly ProductionStepDto[]>;

  /**
   * Evalue le droit metier `can_manage_production_steps` de l acteur dans le
   * tenant, via `public.user_has_capability` — meme mecanisme que
   * `PriceRulesRepository.actorHasCapability()`, appele depuis cet adaptateur
   * pour eviter une dependance croisee entre modules.
   */
  actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean>;
}
