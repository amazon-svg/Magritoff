/**
 * Client HTTP type du module Devis du portail client (stories E10.10b-1,
 * E10.10b-2).
 *
 * Le compte client boutique est porte par le cookie de session
 * (`storefrontSession`) : aucun jeton ni en-tete de tenant a fournir ici, le
 * navigateur transmet le cookie seul (memes conditions que les autres appels
 * du portail, `OrdersApiClient.listPortalOrders`).
 */
import { successEnvelopeSchema } from '../../_shared/api/index.ts';
import { API_V1_BASE_PATH, type ApiResponseWithEtag, FetchApiClient } from '../../../platform/api/index.ts';
import {
  storefrontQuoteDecisionCommandSchema,
  storefrontQuoteDetailSchema,
  storefrontQuotesListSchema,
  type StorefrontQuoteDecision,
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

  /**
   * Rend aussi l `ETag` (E10.10b-1, publie « en prevision du If-Match de
   * b-2 ») : necessaire pour enchainer `decide()` sans une seconde lecture.
   */
  async get(quoteId: string, signal?: AbortSignal): Promise<ApiResponseWithEtag<StorefrontQuoteDetailDto>> {
    const result = await this.client.requestWithEtag({
      path: `${BASE_PATH}/${quoteId}`,
      responseSchema: successEnvelopeSchema(storefrontQuoteDetailSchema),
      ...(signal === undefined ? {} : { signal }),
    });
    return { data: result.data.data, etag: result.etag };
  }

  /**
   * E10.10b-2 — ACCEPTE ou REFUSE un devis (`POST .../decisions`). `If-Match`
   * EXIGE, reprend l `ETag` deja lu sur `get()` : accepter un devis engage une
   * commande, la precondition garantit que le client engage EXACTEMENT le
   * document qu il vient de lire. `Idempotency-Key` est generee ICI, jamais
   * laissee a l appelant — un rejeu apres coupure reseau doit rendre la
   * reponse memorisee, jamais une seconde decision.
   */
  async decide(
    quoteId: string,
    decision: StorefrontQuoteDecision,
    ifMatch: string,
  ): Promise<ApiResponseWithEtag<StorefrontQuoteDetailDto>> {
    const result = await this.client.requestWithEtag({
      method: 'POST',
      path: `${BASE_PATH}/${quoteId}/decisions`,
      body: storefrontQuoteDecisionCommandSchema.parse({ decision }),
      headers: { 'Idempotency-Key': newIdempotencyKey(), 'If-Match': ifMatch },
      responseSchema: successEnvelopeSchema(storefrontQuoteDetailSchema),
    });
    return { data: result.data.data, etag: result.etag };
  }
}

function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
