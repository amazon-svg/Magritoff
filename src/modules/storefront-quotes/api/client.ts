/**
 * Client HTTP type du module Devis du portail client (story E10.10b-1).
 *
 * Le compte client boutique est porte par le cookie de session
 * (`storefrontSession`) : aucun jeton ni en-tete de tenant a fournir ici, le
 * navigateur transmet le cookie seul (memes conditions que les autres appels
 * du portail, `OrdersApiClient.listPortalOrders`).
 */
import { successEnvelopeSchema } from '../../_shared/api/index.ts';
import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  storefrontQuoteDetailSchema,
  storefrontQuotesListSchema,
  type StorefrontQuoteDetailDto,
  type StorefrontQuoteDto,
  type StorefrontQuoteStatus,
} from './contracts.ts';

const BASE_PATH = `${API_V1_BASE_PATH}/storefront-quotes`;

export type ListStorefrontQuotesQuery = Readonly<{
  status?: StorefrontQuoteStatus;
  pageSize?: number;
  pageCursor?: string;
}>;

export type ListStorefrontQuotesResponse = Readonly<{
  items: readonly StorefrontQuoteDto[];
  nextCursor: string | null;
}>;

export class StorefrontQuotesApiClient {
  constructor(private readonly client: FetchApiClient) {}

  async list(query: ListStorefrontQuotesQuery = {}): Promise<ListStorefrontQuotesResponse> {
    const params = new URLSearchParams();
    if (query.status) params.set('status', query.status);
    if (query.pageSize) params.set('page[size]', String(query.pageSize));
    if (query.pageCursor) params.set('page[cursor]', query.pageCursor);
    const suffix = params.toString();

    const envelope = await this.client.request({
      path: suffix ? `${BASE_PATH}?${suffix}` : BASE_PATH,
      responseSchema: successEnvelopeSchema(storefrontQuotesListSchema),
    });
    return { items: envelope.data, nextCursor: envelope.meta.next_cursor ?? null };
  }

  async get(quoteId: string, signal?: AbortSignal): Promise<StorefrontQuoteDetailDto> {
    const envelope = await this.client.request({
      path: `${BASE_PATH}/${quoteId}`,
      responseSchema: successEnvelopeSchema(storefrontQuoteDetailSchema),
      ...(signal === undefined ? {} : { signal }),
    });
    return envelope.data;
  }
}
