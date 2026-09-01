/**
 * Service applicatif du module Devis commerciaux (story E10.3).
 *
 * Orchestration pure : aucune dependance a Supabase ni au HTTP. Les erreurs
 * metier sont des types dedies ; c est la route qui les traduit en Problem
 * RFC 7807, avec le request_id qu elle seule connait.
 */
import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type { OutboxPublisher } from '../../_shared/application/index.ts';
import type {
  CreateQuoteFromProjectCommand,
  QuoteDetailDto,
  QuoteDto,
  UpdateQuoteCommand,
} from '../api/contracts.ts';
import {
  QuoteNotFoundError,
  type CommercialQuotesRepository,
  type ListQuotesParams,
  type ListQuotesResult,
} from './commercial-quotes-repository.ts';

export type CommercialQuotesServiceDependencies = Readonly<{
  repository: CommercialQuotesRepository;
  outbox: OutboxPublisher;
}>;

export class CommercialQuotesService {
  private readonly repository: CommercialQuotesRepository;
  private readonly outbox: OutboxPublisher;

  constructor(dependencies: CommercialQuotesServiceDependencies) {
    this.repository = dependencies.repository;
    this.outbox = dependencies.outbox;
  }

  list(tenantId: TenantId, params: ListQuotesParams): Promise<ListQuotesResult> {
    return this.repository.list(tenantId, params);
  }

  async getDetail(tenantId: TenantId, quoteId: string): Promise<QuoteDetailDto> {
    const detail = await this.repository.findDetailById(tenantId, quoteId);
    if (!detail) throw new QuoteNotFoundError();
    return detail;
  }

  async getSummary(tenantId: TenantId, quoteId: string): Promise<QuoteDto> {
    const quote = await this.repository.findById(tenantId, quoteId);
    if (!quote) throw new QuoteNotFoundError();
    return quote;
  }

  /**
   * CA2-CA5 — cree un devis depuis des elements coches d un projet et publie
   * `quote.created`. Le repository porte l atomicite reelle (numerotation +
   * insertion du devis et de ses lignes dans une seule transaction, CA5) ;
   * ce service n ajoute que l evenement de sortie, hors de cette transaction
   * (meme limite deja acceptee pour `project.created`, voir
   * docs/api/CONVENTIONS.md §8.2 M2).
   */
  async createFromProjectItems(
    tenantId: TenantId,
    actor: UserId,
    command: CreateQuoteFromProjectCommand,
  ): Promise<QuoteDetailDto> {
    const created = await this.repository.createFromProjectItems(tenantId, actor, command);
    await this.outbox.publish({
      name: 'quote.created',
      tenantId,
      aggregateType: 'quote',
      aggregateId: created.id,
      payload: {
        quote_id: created.id,
        project_id: created.project_id,
        customer_id: created.customer_id,
        number: created.number,
      },
    });
    return created;
  }

  async update(tenantId: TenantId, quoteId: string, command: UpdateQuoteCommand): Promise<QuoteDto> {
    const current = await this.repository.findById(tenantId, quoteId);
    if (!current) throw new QuoteNotFoundError();
    return this.repository.update(tenantId, quoteId, command);
  }

  async remove(tenantId: TenantId, quoteId: string): Promise<void> {
    const exists = await this.repository.findById(tenantId, quoteId);
    if (!exists) throw new QuoteNotFoundError();
    return this.repository.remove(tenantId, quoteId);
  }
}
