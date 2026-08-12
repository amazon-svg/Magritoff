import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import { createQuoteTemplateSchema, quoteTemplateRemovedSchema, quoteTemplateSchema, quoteTemplatesOverviewSchema, quoteTemplateUpdatedSchema, setDefaultQuoteTemplateSchema, updateQuoteTemplateSchema, type CreateQuoteTemplate, type QuoteTemplateDto, type QuoteTemplatesOverview, type UpdateQuoteTemplate } from './contracts.ts';
export class QuoteTemplatesApiClient {
  constructor(private readonly client: FetchApiClient) {}
  overview(tenantId: string): Promise<QuoteTemplatesOverview> { return this.client.request({ path: `${API_V1_BASE_PATH}/tenants/${tenantId}/quote-templates`, responseSchema: quoteTemplatesOverviewSchema }); }
  create(tenantId: string, input: CreateQuoteTemplate): Promise<QuoteTemplateDto> { return this.client.request({ method: 'POST', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/quote-templates`, body: createQuoteTemplateSchema.parse(input), responseSchema: quoteTemplateSchema }); }
  update(tenantId: string, id: string, input: UpdateQuoteTemplate): Promise<void> { return this.client.request({ method: 'PUT', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/quote-templates/${id}`, body: updateQuoteTemplateSchema.parse(input), responseSchema: quoteTemplateUpdatedSchema }).then(() => undefined); }
  remove(tenantId: string, id: string): Promise<void> { return this.client.request({ method: 'DELETE', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/quote-templates/${id}`, responseSchema: quoteTemplateRemovedSchema }).then(() => undefined); }
  setDefault(tenantId: string, id: string | null): Promise<void> { return this.client.request({ method: 'PUT', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/quote-templates/default`, body: setDefaultQuoteTemplateSchema.parse({ id }), responseSchema: quoteTemplateUpdatedSchema }).then(() => undefined); }
}
