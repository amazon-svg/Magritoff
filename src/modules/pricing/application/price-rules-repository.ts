import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type {
  CreatePriceRuleCommand,
  PriceRuleDto,
  PriceRuleResolveResultDto,
  PriceRuleStatusFilter,
  ProductRangeDefaultMarginDto,
  UpdatePriceRuleCommand,
} from '../api/contracts.ts';

/** Colonne triable de `listPriceRules` (contrat `PriceRuleSort`, sans le prefixe `-`). */
export type PriceRuleSortField = 'created_at' | 'starts_on';
export type PriceRuleSortDirection = 'asc' | 'desc';

export type PriceRuleListSort = Readonly<{
  field: PriceRuleSortField;
  direction: PriceRuleSortDirection;
}>;

/**
 * Position de curseur. Porte le CHAMP de tri en plus de sa valeur : le
 * contrat impose qu un `sort` different de celui code dans un curseur en
 * cours soit refuse en 400 plutot que de rendre une page incoherente
 * (openapi/magrit-core.v1.yaml, `listPriceRules`).
 */
export type PriceRuleListCursor = Readonly<{
  field: PriceRuleSortField;
  value: string;
  id: string;
}>;

export type ListPriceRulesParams = Readonly<{
  q: string | null;
  status: PriceRuleStatusFilter | null;
  /**
   * Egalite stricte sur `customer_id` (CA5) : ne retient que les portees
   * `customer`/`customer_range` visant NOMMEMENT ce client. Ce n est jamais
   * une simulation de resolution (`resolvePriceRule`, E10.7) — voir la
   * description du parametre dans le contrat.
   */
  customerId: string | null;
  /** Symetrique de `customerId`, egalite stricte sur `product_range_id`. */
  productRangeId: string | null;
  sort: PriceRuleListSort;
  size: number;
  cursor: PriceRuleListCursor | null;
}>;

export type ListPriceRulesResult = Readonly<{
  /** `size + 1` lignes lues au plus, non tronquees ici (meme convention que les autres modules E10.x). */
  rows: readonly PriceRuleDto[];
}>;

/**
 * Contexte de resolution (E10.7, contrat `PriceRuleResolveQuery`). Une valeur
 * `null`/absente RESTREINT les portees candidates plutot que d elargir la
 * recherche (voir la description du parametre au contrat).
 */
export type ResolvePriceRuleParams = Readonly<{
  customerId: string | null;
  productRangeId: string | null;
  /** `YYYY-MM-DD`, jamais un instant (contrat `PriceRuleResolveQuery.at`). */
  at: string;
}>;

/** La regle n existe pas dans le tenant du jeton. */
export class PriceRuleNotFoundError extends Error {
  constructor(message = 'Regle de prix introuvable dans ce tenant.') {
    super(message);
    this.name = 'PriceRuleNotFoundError';
  }
}

/** Rejete quand une commande viole une regle metier non portee par le schema Zod. */
export class PriceRuleCommandRejectedError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly fieldErrors: readonly Readonly<{ field: string; message: string }>[] = [],
  ) {
    super(message);
    this.name = 'PriceRuleCommandRejectedError';
  }
}

/**
 * L acteur n a pas le droit metier `can_manage_pricing` (E10.11) requis pour
 * ecrire le referentiel de prix (`identity.role_required`, contrat
 * `createPriceRule`/`updatePriceRule`/`setProductRangeDefaultMargin`). Un
 * `admin` du tenant recoit ce droit par derivation
 * (`public.user_has_capability`, 20260814000200_admin_unique.sql:130-157 —
 * `owner` n existe plus comme valeur de `tenant_members.role` depuis cette
 * meme migration) : il ne perd donc jamais l acces qu il avait deja sous l
 * ancienne garde RLS `tm.role in ('admin', 'member')` (E10.6) — seul un
 * membre simple sans affectation dediee le perd, ce qu il n aurait jamais du
 * avoir (docs/api/CONVENTIONS.md §8.11).
 */
export class PriceRuleAccessDeniedError extends Error {
  constructor(message = 'Le droit can_manage_pricing est requis pour administrer le referentiel de prix.') {
    super(message);
    this.name = 'PriceRuleAccessDeniedError';
  }
}

/**
 * `product_range_id` inconnu du catalogue partage (`public.product_gammes`).
 * Distincte de `PriceRuleCommandRejectedError` : les endpoints
 * `default-margins` la traduisent en 404, quand `createPriceRule` /
 * `updatePriceRule` traduisent la meme situation en 422 — meme code metier
 * (`price_rule.product_range_unknown`), statut different selon l endpoint
 * (contrat, voir `openapi/magrit-core.v1.yaml`).
 */
export class ProductRangeNotFoundError extends Error {
  constructor(message = 'Gamme de produits introuvable.') {
    super(message);
    this.name = 'ProductRangeNotFoundError';
  }
}

/**
 * Port (interface) du referentiel des regles de prix (E10.6) et de la marge
 * publique standard par gamme. L implementation Supabase vit dans
 * src/adapters/supabase/price-rules-repository.ts ; ce module n en connait
 * que le contrat.
 */
export interface PriceRulesRepository {
  list(tenantId: TenantId, params: ListPriceRulesParams): Promise<ListPriceRulesResult>;

  /** `null` si absente ou hors du tenant (404 cote route, jamais 403). */
  findById(tenantId: TenantId, priceRuleId: string): Promise<PriceRuleDto | null>;

  create(
    tenantId: TenantId,
    actor: UserId,
    command: CreatePriceRuleCommand,
  ): Promise<PriceRuleDto>;

  update(
    tenantId: TenantId,
    priceRuleId: string,
    command: UpdatePriceRuleCommand,
  ): Promise<PriceRuleDto>;

  /**
   * Arbitrage des regles concurrentes (E10.7) : la regle la plus specifique
   * couvrant le contexte a `at`, departagee par `created_at` decroissant a
   * specificite egale. Operation de LECTURE PURE, deterministe a un contexte
   * et une date donnes — deux appels identiques rendent la meme regle.
   * `rule: null` (donc `reason: null`) est un resultat normal, pas une
   * erreur : aucune regle active du tenant ne couvre ce contexte a cette date.
   */
  resolve(tenantId: TenantId, params: ResolvePriceRuleParams): Promise<PriceRuleResolveResultDto>;

  /**
   * `public.product_gammes` est un catalogue PARTAGE, sans tenant (CA2) :
   * l existence d une gamme ne se verifie donc jamais par tenant.
   */
  productRangeExists(productRangeId: string): Promise<boolean>;

  /**
   * Marge publique standard du tenant sur une gamme (CA4). Rend toujours un
   * objet — `margin_rate`/`updated_at`/`updated_by` a `null` quand le tenant
   * n en a jamais defini, JAMAIS `null` en bloc : l appelant a deja verifie
   * `productRangeExists()` avant d appeler cette methode.
   */
  getDefaultMargin(tenantId: TenantId, productRangeId: string): Promise<ProductRangeDefaultMarginDto>;

  setDefaultMargin(
    tenantId: TenantId,
    productRangeId: string,
    actor: UserId,
    marginRate: string,
  ): Promise<ProductRangeDefaultMarginDto>;

  /**
   * Evalue le droit metier `can_manage_pricing` (E10.11) de l acteur dans le
   * tenant, via `public.user_has_capability` — meme mecanisme et meme
   * signature que `CommercialQuotesRepository.actorHasCapability()`
   * (`src/modules/commercial-quotes/application/commercial-quotes-repository.ts`),
   * appele depuis cet adaptateur pour eviter une dependance croisee entre
   * modules. Garde d ecriture de `createPriceRule`/`updatePriceRule`/
   * `setProductRangeDefaultMargin`. Un `admin` du tenant recoit `true`
   * par derivation (regle portee par `user_has_capability`, pas par ce port ;
   * `owner` n existe plus comme valeur de `tenant_members.role` depuis
   * 20260814000200_admin_unique.sql).
   */
  actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean>;
}
