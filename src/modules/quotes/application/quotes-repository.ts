import type { UserId } from '../../../kernel/ids/index.ts';
import type { CreateQuoteDraft, QuoteDraftCreated } from '../api/contracts.ts';

export class QuoteRejectedError extends Error {
  constructor(public readonly code: 'permission_denied' | 'invalid_quote', message: string) {
    super(message); this.name = 'QuoteRejectedError';
  }
}
export interface QuotesRepository {
  createDraft(actor: UserId, tenantId: string, command: CreateQuoteDraft): Promise<QuoteDraftCreated>;
}
