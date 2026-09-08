/**
 * Client HTTP type du module Commandes de gestion commerciale (story E10.12).
 *
 * `convertQuote` vit ici (chemin `/quotes/{quoteId}/conversions`) meme si son
 * URL porte le segment `quotes` : l operation rend et cree une ressource
 * `CommercialOrder`, pas un `Quote` (voir en-tete de `../api/contracts.ts`).
 */
import { successEnvelopeSchema } from '../../_shared/api/index.ts';
import { API_V1_BASE_PATH, type ApiResponseWithEtag, FetchApiClient } from '../../../platform/api/index.ts';
import {
  commercialOrderDetailSchema,
  commercialOrdersListSchema,
  convertQuoteCommandSchema,
  type CommercialOrderDetailDto,
  type CommercialOrderDto,
  type CommercialOrderStatus,
} from './contracts.ts';

const ORDERS_BASE_PATH = `${API_V1_BASE_PATH}/commercial-orders`;
const QUOTES_BASE_PATH = `${API_V1_BASE_PATH}/quotes`;

export type ListCommercialOrdersQuery = Readonly<{
  customerId?: string;
  quoteId?: string;
  status?: CommercialOrderStatus;
  pageSize?: number;
  pageCursor?: string;
}>;

export type ListCommercialOrdersResponse = Readonly<{
  items: readonly CommercialOrderDto[];
  nextCursor: string | null;
}>;

export class CommercialOrdersApiClient {
  constructor(private readonly client: FetchApiClient) {}

  /**
   * VALIDE un devis (« bouton Valider »), contrat `convertQuote`. Aucun
   * `If-Match` (decision #6, docs/api/CONVENTIONS.md §8.14) : un devis
   * `sent`/`accepted` est deja immuable, la garde de statut suffit.
   * `Idempotency-Key` generee ici, jamais laissee a l appelant : un rejeu
   * apres coupure reseau doit rendre la commande deja creee, jamais une
   * seconde (CA8).
   */
  async convertQuote(quoteId: string): Promise<ApiResponseWithEtag<CommercialOrderDetailDto>> {
    const result = await this.client.requestWithEtag({
      method: 'POST',
      path: `${QUOTES_BASE_PATH}/${quoteId}/conversions`,
      body: convertQuoteCommandSchema.parse({}),
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      responseSchema: successEnvelopeSchema(commercialOrderDetailSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  async list(query: ListCommercialOrdersQuery = {}): Promise<ListCommercialOrdersResponse> {
    const params = new URLSearchParams();
    if (query.customerId) params.set('customer_id', query.customerId);
    if (query.quoteId) params.set('quote_id', query.quoteId);
    if (query.status) params.set('status', query.status);
    if (query.pageSize) params.set('page[size]', String(query.pageSize));
    if (query.pageCursor) params.set('page[cursor]', query.pageCursor);
    const suffix = params.toString();

    const envelope = await this.client.request({
      path: suffix ? `${ORDERS_BASE_PATH}?${suffix}` : ORDERS_BASE_PATH,
      responseSchema: successEnvelopeSchema(commercialOrdersListSchema),
    });
    return { items: envelope.data, nextCursor: envelope.meta.next_cursor ?? null };
  }

  async getDetail(orderId: string): Promise<CommercialOrderDetailDto> {
    const envelope = await this.client.request({
      path: `${ORDERS_BASE_PATH}/${orderId}`,
      responseSchema: successEnvelopeSchema(commercialOrderDetailSchema),
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
