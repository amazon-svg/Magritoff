import type { UserId } from '../../../kernel/ids/index.ts';
import type { CreateQuoteTemplate, UpdateQuoteTemplate } from '../api/contracts.ts';
import type { QuoteTemplatesRepository } from './quote-templates-repository.ts';
export class QuoteTemplatesService {
  constructor(private readonly repository: QuoteTemplatesRepository) {}
  overview(actor: UserId, tenantId: string) { return this.repository.overview(actor, tenantId); }
  create(actor: UserId, tenantId: string, input: CreateQuoteTemplate) { return this.repository.create(actor, tenantId, input); }
  async update(actor: UserId, tenantId: string, id: string, input: UpdateQuoteTemplate) { await this.repository.update(actor, tenantId, id, input); return { updated: true as const }; }
  async remove(actor: UserId, tenantId: string, id: string) { await this.repository.remove(actor, tenantId, id); return { removed: true as const }; }
  async setDefault(actor: UserId, tenantId: string, id: string | null) { await this.repository.setDefault(actor, tenantId, id); return { updated: true as const }; }
}
