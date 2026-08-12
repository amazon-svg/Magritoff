import type { UserId } from '../../../kernel/ids/index.ts';
import type { CreateEditableQuote, CreateQuoteDraft, QuoteDraftCreated, QuoteRecord, QuoteScope, QuoteWithLines, SaveQuote } from '../api/contracts.ts';

export class QuoteRejectedError extends Error {
  constructor(public readonly code: 'permission_denied' | 'invalid_quote' | 'not_found', message: string) {
    super(message); this.name = 'QuoteRejectedError';
  }
}
export interface QuotesRepository {
  createDraft(actor: UserId, tenantId: string, command: CreateQuoteDraft): Promise<QuoteDraftCreated>;
  list(actor: UserId, tenantId: string, scope: QuoteScope): Promise<QuoteRecord[]>;
  get(actor: UserId, tenantId: string, quoteId: string): Promise<QuoteWithLines>;
  create(actor: UserId, tenantId: string, command: CreateEditableQuote): Promise<QuoteDraftCreated>;
  save(actor: UserId, tenantId: string, quoteId: string, command: SaveQuote): Promise<void>;
  setStatus(actor: UserId, tenantId: string, quoteId: string, status: string): Promise<void>;
  remove(actor: UserId, tenantId: string, quoteId: string): Promise<void>;
  duplicate(actor: UserId, tenantId: string, quoteId: string, reference: string): Promise<QuoteDraftCreated>;
}
