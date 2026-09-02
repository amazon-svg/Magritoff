/**
 * Service applicatif du module Pricing — referentiel des regles de prix
 * (story E10.6).
 *
 * Orchestration pure : aucune dependance a Supabase ni au HTTP. Les erreurs
 * metier sont des types dedies (`PriceRuleNotFoundError`,
 * `PriceRuleCommandRejectedError`, `ProductRangeNotFoundError`) ; c est la
 * route qui les traduit en Problem RFC 7807, avec le request_id qu elle
 * seule connait.
 *
 * CA3 (rappel de perimetre) : le CRUD complet est livre par E10.6 ; E10.7
 * ajoute `resolve()`, l algorithme d arbitrage des regles concurrentes
 * (specificite puis recence), delegue a la fonction SQL `resolve_price_rule`
 * (voir `src/adapters/supabase/price-rules-repository.ts`) — ce service ne
 * fait que valider le contexte (client/gamme connus du tenant) avant de
 * deleguer, meme discipline que `create()`.
 */
import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type { OutboxPublisher } from '../../_shared/application/index.ts';
import type { CustomersRepository } from '../../customers/application/customers-repository.ts';
import type {
  CreatePriceRuleCommand,
  PriceRuleDto,
  PriceRuleResolveResultDto,
  ProductRangeDefaultMarginDto,
  UpdatePriceRuleCommand,
} from '../api/contracts.ts';
import {
  PriceRuleCommandRejectedError,
  PriceRuleNotFoundError,
  ProductRangeNotFoundError,
  type ListPriceRulesParams,
  type ListPriceRulesResult,
  type PriceRulesRepository,
  type ResolvePriceRuleParams,
} from './price-rules-repository.ts';

/** Codes metier stables (CA3, contrat `createPriceRule`/`updatePriceRule`). */
const INVALID_SCOPE_CODE = 'price_rule.invalid_scope';
const INVALID_PERIOD_CODE = 'price_rule.invalid_period';
const CUSTOMER_UNKNOWN_CODE = 'price_rule.customer_unknown';
const PRODUCT_RANGE_UNKNOWN_CODE = 'price_rule.product_range_unknown';

export type PriceRuleChangedAction = 'created' | 'updated' | 'activated' | 'deactivated';

export type PriceRulesServiceDependencies = Readonly<{
  repository: PriceRulesRepository;
  /**
   * Reutilise le referentiel Clients (E10.4) pour verifier qu un
   * `customer_id` existe reellement dans le tenant AVANT de creer une regle
   * portee client (CA1) — pas de duplication de cette logique d existence.
   */
  customers: CustomersRepository;
  outbox: OutboxPublisher;
}>;

export class PriceRulesService {
  private readonly repository: PriceRulesRepository;
  private readonly customers: CustomersRepository;
  private readonly outbox: OutboxPublisher;

  constructor(dependencies: PriceRulesServiceDependencies) {
    this.repository = dependencies.repository;
    this.customers = dependencies.customers;
    this.outbox = dependencies.outbox;
  }

  list(tenantId: TenantId, params: ListPriceRulesParams): Promise<ListPriceRulesResult> {
    return this.repository.list(tenantId, params);
  }

  async getById(tenantId: TenantId, priceRuleId: string): Promise<PriceRuleDto> {
    const rule = await this.repository.findById(tenantId, priceRuleId);
    if (!rule) throw new PriceRuleNotFoundError();
    return rule;
  }

  /**
   * Cree une regle de prix (CA1, CA2, CA10). Verifie DANS L ORDRE : la
   * coherence scope/cibles (forme), l existence du client et de la gamme
   * dans leur referentiel respectif, puis l ordre des dates — chacune avec
   * son propre code metier, comme l exige le contrat.
   */
  async create(
    tenantId: TenantId,
    actor: UserId,
    command: CreatePriceRuleCommand,
  ): Promise<PriceRuleDto> {
    await this.assertScopeTargets(tenantId, command.scope, command.customer_id ?? null, command.product_range_id ?? null);
    assertPeriodOrder(command.starts_on, command.ends_on ?? null);

    const created = await this.repository.create(tenantId, actor, command);
    await this.publishChanged(tenantId, created.id, 'created');
    return created;
  }

  /**
   * Modifie une regle existante (CA1). `scope`/`customer_id`/
   * `product_range_id`/`value_type` sont immuables : la commande ne les
   * porte pas (contrat `UpdatePriceRuleCommand`), aucune verification de
   * cible n est donc necessaire ici — seule la periode resultante doit
   * rester coherente.
   */
  async update(
    tenantId: TenantId,
    priceRuleId: string,
    command: UpdatePriceRuleCommand,
  ): Promise<PriceRuleDto> {
    const current = await this.repository.findById(tenantId, priceRuleId);
    if (!current) throw new PriceRuleNotFoundError();

    const nextStartsOn = command.starts_on ?? current.starts_on;
    const nextEndsOn = 'ends_on' in command ? (command.ends_on ?? null) : current.ends_on;
    assertPeriodOrder(nextStartsOn, nextEndsOn);

    const updated = await this.repository.update(tenantId, priceRuleId, command);
    await this.publishChanged(tenantId, updated.id, actionFor(command));
    return updated;
  }

  /**
   * Arbitrage des regles concurrentes (E10.7, CA2/CA3/CA4). Valide que
   * `customer_id`/`product_range_id`, s ils sont fournis, existent dans le
   * tenant AVANT de deleguer a `resolve_price_rule` — memes codes metier et
   * meme ordre que `assertScopeTargets` pour la creation (422
   * `price_rule.customer_unknown` / `price_rule.product_range_unknown`).
   * Aucune ecriture, aucun evenement : c est une LECTURE pure (contrat).
   */
  async resolve(
    tenantId: TenantId,
    params: ResolvePriceRuleParams,
  ): Promise<PriceRuleResolveResultDto> {
    if (params.customerId !== null) await this.assertKnownCustomer(tenantId, params.customerId);
    if (params.productRangeId !== null) await this.assertKnownProductRange(params.productRangeId);
    return this.repository.resolve(tenantId, params);
  }

  async getDefaultMargin(
    tenantId: TenantId,
    productRangeId: string,
  ): Promise<ProductRangeDefaultMarginDto> {
    await this.requireExistingProductRange(productRangeId);
    return this.repository.getDefaultMargin(tenantId, productRangeId);
  }

  /**
   * Definit la marge publique standard du tenant sur une gamme (CA4). Ce
   * n est PAS une regle de prix : aucun evenement `price_rule.changed` n est
   * publie ici (contrat, section marge publique standard).
   */
  async setDefaultMargin(
    tenantId: TenantId,
    productRangeId: string,
    actor: UserId,
    marginRate: string,
  ): Promise<ProductRangeDefaultMarginDto> {
    await this.requireExistingProductRange(productRangeId);
    return this.repository.setDefaultMargin(tenantId, productRangeId, actor, marginRate);
  }

  private async requireExistingProductRange(productRangeId: string): Promise<void> {
    const exists = await this.repository.productRangeExists(productRangeId);
    if (!exists) throw new ProductRangeNotFoundError();
  }

  /**
   * CA2 — coherence scope <-> cibles, dans LES DEUX SENS : une cible requise
   * par la portee mais absente, ou fournie hors de sa portee, sont TOUTES LES
   * DEUX un `price_rule.invalid_scope` (une cible ignoree en silence
   * donnerait une regle qui ne s applique pas la ou son auteur croit l avoir
   * posee). Verifie ensuite que chaque cible fournie existe reellement dans
   * son referentiel.
   */
  private async assertScopeTargets(
    tenantId: TenantId,
    scope: CreatePriceRuleCommand['scope'],
    customerId: string | null,
    productRangeId: string | null,
  ): Promise<void> {
    const customerAllowed = scope === 'customer' || scope === 'customer_range';
    const rangeAllowed = scope === 'range' || scope === 'customer_range';

    if (customerAllowed !== (customerId !== null)) {
      throw new PriceRuleCommandRejectedError(
        INVALID_SCOPE_CODE,
        customerAllowed
          ? 'Cette portee exige un client.'
          : 'Cette portee ne porte pas de client.',
        [{ field: 'customer_id', message: customerAllowed ? 'Client requis pour cette portee.' : 'Client non autorise pour cette portee.' }],
      );
    }
    if (rangeAllowed !== (productRangeId !== null)) {
      throw new PriceRuleCommandRejectedError(
        INVALID_SCOPE_CODE,
        rangeAllowed
          ? 'Cette portee exige une gamme de produits.'
          : 'Cette portee ne porte pas de gamme de produits.',
        [{ field: 'product_range_id', message: rangeAllowed ? 'Gamme requise pour cette portee.' : 'Gamme non autorisee pour cette portee.' }],
      );
    }

    if (customerId !== null) await this.assertKnownCustomer(tenantId, customerId);
    if (productRangeId !== null) await this.assertKnownProductRange(productRangeId);
  }

  /** Partage entre `create()`/`assertScopeTargets()` et `resolve()` (E10.7). */
  private async assertKnownCustomer(tenantId: TenantId, customerId: string): Promise<void> {
    const customer = await this.customers.findById(tenantId, customerId);
    if (!customer) {
      throw new PriceRuleCommandRejectedError(
        CUSTOMER_UNKNOWN_CODE,
        'Client inconnu de ce tenant.',
        [{ field: 'customer_id', message: 'Client inconnu de ce tenant.' }],
      );
    }
  }

  /** Partage entre `create()`/`assertScopeTargets()` et `resolve()` (E10.7). */
  private async assertKnownProductRange(productRangeId: string): Promise<void> {
    const exists = await this.repository.productRangeExists(productRangeId);
    if (!exists) {
      throw new PriceRuleCommandRejectedError(
        PRODUCT_RANGE_UNKNOWN_CODE,
        'Gamme de produits inconnue.',
        [{ field: 'product_range_id', message: 'Gamme de produits inconnue.' }],
      );
    }
  }

  private async publishChanged(
    tenantId: TenantId,
    ruleId: string,
    action: PriceRuleChangedAction,
  ): Promise<void> {
    // CA10 : meme flux applicatif que l ecriture, meme pattern outbox que les
    // autres modules E10.x (bestEffortOutbox cote adaptateur Supabase).
    await this.outbox.publish({
      name: 'price_rule.changed',
      tenantId,
      aggregateType: 'price_rule',
      aggregateId: ruleId,
      payload: { rule_id: ruleId, action },
    });
  }
}

/**
 * `ends_on` est INCLUSIVE (contrat, plusieurs occurrences) : une regle d un
 * seul jour ou `ends_on === starts_on` est valide. Seule une fin strictement
 * ANTERIEURE au debut est rejetee — comparaison lexicographique valide sur
 * des dates `YYYY-MM-DD` (`price_rule.invalid_period`, contrat).
 */
function assertPeriodOrder(startsOn: string, endsOn: string | null): void {
  if (endsOn !== null && endsOn < startsOn) {
    throw new PriceRuleCommandRejectedError(
      INVALID_PERIOD_CODE,
      'La date de fin ne peut pas etre anterieure a la date de debut.',
      [{ field: 'ends_on', message: 'Ne peut pas etre anterieure a la date de debut.' }],
    );
  }
}

/**
 * CA — un `PATCH` qui ne porte QUE `is_active` emet `activated`/`deactivated` ;
 * toute autre modification (seule ou combinee a `is_active`) emet `updated`.
 */
function actionFor(command: UpdatePriceRuleCommand): PriceRuleChangedAction {
  const keys = Object.keys(command);
  if (keys.length === 1 && keys[0] === 'is_active') {
    return command.is_active ? 'activated' : 'deactivated';
  }
  return 'updated';
}
