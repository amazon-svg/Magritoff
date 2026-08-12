import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import { createEditableQuoteSchema, createQuoteDraftSchema, duplicateQuoteSchema, quoteDraftCreatedSchema, quoteRemovedSchema, quotesListSchema, quoteUpdatedSchema, quoteWithLinesSchema, saveQuoteSchema, setQuoteStatusSchema, type CreateEditableQuote, type CreateQuoteDraft, type QuoteDraftCreated, type QuoteRecord, type QuoteScope, type QuoteWithLines, type SaveQuote } from './contracts.ts';

export class QuotesApiClient {
  constructor(private readonly client: FetchApiClient) {}

  createDraft(tenantId: string, command: CreateQuoteDraft): Promise<QuoteDraftCreated> {
    return this.client.request({
      method: 'POST', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/quotes/drafts`,
      body: createQuoteDraftSchema.parse(command), responseSchema: quoteDraftCreatedSchema,
    });
  }
  list(tenantId: string, scope: QuoteScope): Promise<QuoteRecord[]> { return this.client.request({ path: `${API_V1_BASE_PATH}/tenants/${tenantId}/quotes?scope=${scope}`, responseSchema: quotesListSchema }); }
  get(tenantId: string, quoteId: string): Promise<QuoteWithLines> { return this.client.request({ path: `${API_V1_BASE_PATH}/tenants/${tenantId}/quotes/${quoteId}`, responseSchema: quoteWithLinesSchema }); }
  create(tenantId: string, command: CreateEditableQuote): Promise<QuoteDraftCreated> { return this.client.request({ method: 'POST', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/quotes`, body: createEditableQuoteSchema.parse(command), responseSchema: quoteDraftCreatedSchema }); }
  save(tenantId: string, quoteId: string, command: SaveQuote): Promise<void> { return this.client.request({ method: 'PUT', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/quotes/${quoteId}`, body: saveQuoteSchema.parse(command), responseSchema: quoteUpdatedSchema }).then(() => undefined); }
  setStatus(tenantId: string, quoteId: string, status: string): Promise<void> { return this.client.request({ method: 'PATCH', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/quotes/${quoteId}`, body: setQuoteStatusSchema.parse({ status }), responseSchema: quoteUpdatedSchema }).then(() => undefined); }
  remove(tenantId: string, quoteId: string): Promise<void> { return this.client.request({ method: 'DELETE', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/quotes/${quoteId}`, responseSchema: quoteRemovedSchema }).then(() => undefined); }
  duplicate(tenantId: string, quoteId: string, reference: string): Promise<QuoteDraftCreated> { return this.client.request({ method: 'POST', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/quotes/${quoteId}/duplicate`, body: duplicateQuoteSchema.parse({ reference }), responseSchema: quoteDraftCreatedSchema }); }
}
