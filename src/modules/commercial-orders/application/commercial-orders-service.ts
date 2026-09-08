/**
 * Service applicatif du module Commandes de gestion commerciale (E10.12).
 *
 * Orchestration pure : aucune dependance a Supabase ni au HTTP. Depend du
 * SERVICE `CommercialQuotesService` (pas de son repository directement) pour
 * lire le devis a convertir — meme pattern de composition inter-modules que
 * `CommercialQuotesService` deja construit sur `ProjectsRepository`/
 * `PriceRulesService`.
 */
import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type { OutboxPublisher } from '../../_shared/application/index.ts';
import type { CommercialQuotesService } from '../../commercial-quotes/application/commercial-quotes-service.ts';
import type {
  ChangeOrderProductionStepCommand,
  CommercialOrderDetailDto,
  CommercialOrderDto,
  OrderStepChangeDto,
} from '../api/contracts.ts';
import {
  CommercialOrderNotFoundError,
  type CommercialOrdersRepository,
  type ListCommercialOrdersParams,
  type ListCommercialOrdersResult,
  type ListOrderStepChangesParams,
  type ListOrderStepChangesResult,
} from './commercial-orders-repository.ts';

export type CommercialOrdersServiceDependencies = Readonly<{
  repository: CommercialOrdersRepository;
  outbox: OutboxPublisher;
  /** E10.3/E10.9/E10.10a — lecture du devis a convertir (existence, numero). */
  quotes: CommercialQuotesService;
}>;

export class CommercialOrdersService {
  private readonly repository: CommercialOrdersRepository;
  private readonly outbox: OutboxPublisher;
  private readonly quotes: CommercialQuotesService;

  constructor(dependencies: CommercialOrdersServiceDependencies) {
    this.repository = dependencies.repository;
    this.outbox = dependencies.outbox;
    this.quotes = dependencies.quotes;
  }

  list(tenantId: TenantId, params: ListCommercialOrdersParams): Promise<ListCommercialOrdersResult> {
    return this.repository.list(tenantId, params);
  }

  async getDetail(tenantId: TenantId, orderId: string): Promise<CommercialOrderDetailDto> {
    const detail = await this.repository.findDetailById(tenantId, orderId);
    if (!detail) throw new CommercialOrderNotFoundError();
    return detail;
  }

  /**
   * Lit le RESUME (sans lignes) d une commande — utilise par les operations
   * qui n ont besoin que de verifier son existence/etat courant (E10.14,
   * journal des changements d etape), sans payer le cout de charger les
   * lignes (contrairement a `getDetail`).
   */
  async getSummary(tenantId: TenantId, orderId: string): Promise<CommercialOrderDto> {
    const order = await this.repository.findById(tenantId, orderId);
    if (!order) throw new CommercialOrderNotFoundError();
    return order;
  }

  /** E10.14 — journal antichronologique. 404 `CommercialOrderNotFoundError` si la commande est absente/hors tenant, verifie AVANT la lecture du journal. */
  async listStepChanges(
    tenantId: TenantId,
    orderId: string,
    params: ListOrderStepChangesParams,
  ): Promise<ListOrderStepChangesResult> {
    await this.getSummary(tenantId, orderId);
    return this.repository.listStepChanges(tenantId, orderId, params);
  }

  /**
   * Deplace une commande sur une etape de production et JOURNALISE le
   * passage dans le meme geste (contrat, decision #4 : une seule transaction
   * cote base, deux ecritures indissociables). Publie `order.step_changed`
   * APRES le commit SQL, meme limite deja acceptee pour les evenements de
   * devis/conversion (dette M2, docs/api/CONVENTIONS.md §8.2 — pas traitee
   * par ce lot, decision explicite du cadrage E10.14 §5 reserve (c)).
   *
   * Relit la commande APRES la transition (jamais avant, meme discipline B2
   * qu E10.12) pour composer `OrderStepChangedPayload` (`order_number`,
   * `customer_id`) : le seul champ que la fonction SQL rend est l entree de
   * journal elle-meme (decision #5 du contrat, la ressource creee est
   * l entree, pas la commande).
   */
  async changeProductionStep(
    tenantId: TenantId,
    orderId: string,
    actor: UserId | null,
    command: ChangeOrderProductionStepCommand,
    serviceActorLabel: string | null,
  ): Promise<OrderStepChangeDto> {
    const entry = await this.repository.changeProductionStep(tenantId, orderId, actor, command, serviceActorLabel);

    const order = await this.repository.findById(tenantId, orderId);
    if (!order) {
      // Ne devrait jamais arriver : la transition vient de committer sur
      // cette meme commande (meme discipline defensive que `convertQuote`).
      throw new CommercialOrderNotFoundError();
    }

    await this.outbox.publish({
      name: 'order.step_changed',
      tenantId,
      aggregateType: 'order',
      aggregateId: orderId,
      payload: {
        step_change_id: entry.id,
        order_id: orderId,
        order_number: order.number,
        customer_id: order.customer_id,
        from_step_id: entry.from_step_id,
        to_step_id: entry.to_step_id,
      },
    });

    return entry;
  }

  /**
   * VALIDE un devis et le transforme en commande (« bouton Valider »).
   * L existence du devis est verifiee ICI (`QuoteNotFoundError`, 404) avant
   * de deleguer la transition au repository — meme discipline que `send()`/
   * `duplicate()` de `CommercialQuotesService`, qui verifient deja le devis
   * avant d appeler leur propre repository. Publie `quote.converted` APRES
   * la conversion, hors de la transaction SQL (meme limite deja acceptee
   * pour `quote.created`/`quote.sent`/`quote.accepted` — dette M2,
   * docs/api/CONVENTIONS.md §8.2).
   */
  async convert(tenantId: TenantId, actor: UserId, quoteId: string): Promise<CommercialOrderDetailDto> {
    const quote = await this.quotes.getSummary(tenantId, quoteId);
    const order = await this.repository.convertQuote(tenantId, actor, quoteId);

    await this.outbox.publish({
      name: 'quote.converted',
      tenantId,
      aggregateType: 'quote',
      aggregateId: quoteId,
      payload: {
        quote_id: quoteId,
        customer_id: order.customer_id,
        number: quote.number,
        order_id: order.id,
        order_number: order.number,
        source_quote_status: order.source_quote_status,
      },
    });

    return order;
  }
}
