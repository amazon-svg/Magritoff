import type { UserId } from '../../../kernel/ids/index.ts';
import type { CreateEditableQuote, CreateQuoteDraft, QuoteScope, SaveQuote } from '../api/contracts.ts';
import type { QuotesRepository } from './quotes-repository.ts';

export class QuotesService {
  constructor(private readonly repository: QuotesRepository) {}
  createDraft(actor: UserId, tenantId: string, command: CreateQuoteDraft) {
    return this.repository.createDraft(actor, tenantId, command);
  }
  list(actor: UserId, tenantId: string, scope: QuoteScope) { return this.repository.list(actor, tenantId, scope); }
  get(actor: UserId, tenantId: string, quoteId: string) { return this.repository.get(actor, tenantId, quoteId); }
  create(actor: UserId, tenantId: string, command: CreateEditableQuote) { return this.repository.create(actor, tenantId, command); }
  async save(actor: UserId, tenantId: string, quoteId: string, command: SaveQuote) { await this.repository.save(actor, tenantId, quoteId, command); return { updated: true as const }; }
  async setStatus(actor: UserId, tenantId: string, quoteId: string, status: string) { await this.repository.setStatus(actor, tenantId, quoteId, status); return { updated: true as const }; }
  async remove(actor: UserId, tenantId: string, quoteId: string) { await this.repository.remove(actor, tenantId, quoteId); return { removed: true as const }; }
  duplicate(actor: UserId, tenantId: string, quoteId: string, reference: string) { return this.repository.duplicate(actor, tenantId, quoteId, reference); }
}
