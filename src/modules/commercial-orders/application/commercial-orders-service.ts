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
import type { CommercialOrderDetailDto } from '../api/contracts.ts';
import {
  CommercialOrderNotFoundError,
  type CommercialOrdersRepository,
  type ListCommercialOrdersParams,
  type ListCommercialOrdersResult,
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
