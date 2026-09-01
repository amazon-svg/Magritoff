/**
 * Client HTTP type du module Devis commerciaux (story E10.3).
 *
 * Le tenant est resolu par la facade depuis le jeton (CA4 du socle E10.0) :
 * aucun chemin ici ne le porte. `Idempotency-Key` est genere localement pour
 * la creation ; `If-Match` doit reprendre l ETag lu sur la ressource.
 */
import { successEnvelopeSchema } from '../../_shared/api/index.ts';
import { API_V1_BASE_PATH, type ApiResponseWithEtag, FetchApiClient } from '../../../platform/api/index.ts';
import {
  createQuoteFromProjectCommandSchema,
  deleteQuoteResultSchema,
  quoteDetailSchema,
  quoteSchema,
  quotesListSchema,
  updateQuoteCommandSchema,
  type CreateQuoteFromProjectCommand,
  type DeleteQuoteResultDto,
  type QuoteDetailDto,
  type QuoteDto,
  type QuoteStatus,
  type UpdateQuoteCommand,
} from './contracts.ts';

const BASE_PATH = `${API_V1_BASE_PATH}/quotes`;

export type ListQuotesQuery = Readonly<{
  customerId?: string;
  projectId?: string;
  status?: QuoteStatus;
  pageSize?: number;
  pageCursor?: string;
}>;

export type ListQuotesResponse = Readonly<{
  items: readonly QuoteDto[];
  nextCursor: string | null;
}>;

export class CommercialQuotesApiClient {
  constructor(private readonly client: FetchApiClient) {}

  async list(query: ListQuotesQuery = {}): Promise<ListQuotesResponse> {
    const params = new URLSearchParams();
    if (query.customerId) params.set('customer_id', query.customerId);
    if (query.projectId) params.set('project_id', query.projectId);
    if (query.status) params.set('status', query.status);
    if (query.pageSize) params.set('page[size]', String(query.pageSize));
    if (query.pageCursor) params.set('page[cursor]', query.pageCursor);
    const suffix = params.toString();

    const envelope = await this.client.request({
      path: suffix ? `${BASE_PATH}?${suffix}` : BASE_PATH,
      responseSchema: successEnvelopeSchema(quotesListSchema),
    });
    return { items: envelope.data, nextCursor: envelope.meta.next_cursor ?? null };
  }

  /** Cree un devis depuis des elements coches d un projet (CA2-CA5). */
  async createFromProject(command: CreateQuoteFromProjectCommand): Promise<QuoteDetailDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: BASE_PATH,
      body: createQuoteFromProjectCommandSchema.parse(command),
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      responseSchema: successEnvelopeSchema(quoteDetailSchema),
    });
    return envelope.data;
  }

  async getDetail(quoteId: string): Promise<QuoteDetailDto> {
    const envelope = await this.client.request({
      path: `${BASE_PATH}/${quoteId}`,
      responseSchema: successEnvelopeSchema(quoteDetailSchema),
    });
    return envelope.data;
  }

  /** Rend aussi l ETag : necessaire pour enchainer `update()` (If-Match). */
  async getForEdit(quoteId: string): Promise<ApiResponseWithEtag<QuoteDetailDto>> {
    const result = await this.client.requestWithEtag({
      path: `${BASE_PATH}/${quoteId}`,
      responseSchema: successEnvelopeSchema(quoteDetailSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  async update(
    quoteId: string,
    command: UpdateQuoteCommand,
    ifMatch: string,
  ): Promise<ApiResponseWithEtag<QuoteDto>> {
    const result = await this.client.requestWithEtag({
      method: 'PATCH',
      path: `${BASE_PATH}/${quoteId}`,
      body: updateQuoteCommandSchema.parse(command),
      headers: { 'If-Match': ifMatch },
      responseSchema: successEnvelopeSchema(quoteSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  async remove(quoteId: string): Promise<DeleteQuoteResultDto> {
    const envelope = await this.client.request({
      method: 'DELETE',
      path: `${BASE_PATH}/${quoteId}`,
      responseSchema: successEnvelopeSchema(deleteQuoteResultSchema),
    });
    return envelope.data;
  }
}

function unwrapEnvelopeWithEtag<T>(
  result: ApiResponseWithEtag<{ data: T; meta: unknown }>,
): ApiResponseWithEtag<T> {
  return { data: result.data.data, etag: result.etag };
}

function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
