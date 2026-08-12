import type { UserId } from '../../../kernel/ids/index.ts';
import type { CreateQuoteDraft } from '../api/contracts.ts';
import type { QuotesRepository } from './quotes-repository.ts';

export class QuotesService {
  constructor(private readonly repository: QuotesRepository) {}
  createDraft(actor: UserId, tenantId: string, command: CreateQuoteDraft) {
    return this.repository.createDraft(actor, tenantId, command);
  }
}
