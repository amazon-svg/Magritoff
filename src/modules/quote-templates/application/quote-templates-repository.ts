import type { UserId } from '../../../kernel/ids/index.ts';
import type { CreateQuoteTemplate, QuoteTemplateDto, QuoteTemplatesOverview, UpdateQuoteTemplate } from '../api/contracts.ts';
export class QuoteTemplateRejectedError extends Error { constructor(public readonly code: 'permission_denied' | 'not_found' | 'invalid_template', message: string) { super(message); this.name = 'QuoteTemplateRejectedError'; } }
export interface QuoteTemplatesRepository {
  overview(actor: UserId, tenantId: string): Promise<QuoteTemplatesOverview>;
  create(actor: UserId, tenantId: string, input: CreateQuoteTemplate): Promise<QuoteTemplateDto>;
  update(actor: UserId, tenantId: string, id: string, input: UpdateQuoteTemplate): Promise<void>;
  remove(actor: UserId, tenantId: string, id: string): Promise<void>;
  setDefault(actor: UserId, tenantId: string, id: string | null): Promise<void>;
}
