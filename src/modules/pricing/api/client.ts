/**
 * Client HTTP typo du module Pricing (story E10.6).
 *
 * Le tenant est resolu par la facade depuis le jeton (CA4 du socle E10.0) :
 * aucun chemin ici ne le porte. `Idempotency-Key` est genere localement pour
 * chaque tentative de creation ; `If-Match` doit reprendre l ETag lu sur la
 * ressource (voir `requestWithEtag`).
 */
import { successEnvelopeSchema } from '../../_shared/api/index.ts';
import { API_V1_BASE_PATH, type ApiResponseWithEtag, FetchApiClient } from '../../../platform/api/index.ts';
import {
  createPriceRuleCommandSchema,
  priceRuleSchema,
  priceRulesListSchema,
  productRangeDefaultMarginSchema,
  setProductRangeDefaultMarginCommandSchema,
  updatePriceRuleCommandSchema,
  type CreatePriceRuleCommand,
  type PriceRuleDto,
  type PriceRuleSort,
  type PriceRuleStatusFilter,
  type ProductRangeDefaultMarginDto,
  type SetProductRangeDefaultMarginCommand,
  type UpdatePriceRuleCommand,
} from './contracts.ts';

const BASE_PATH = `${API_V1_BASE_PATH}/price-rules`;

export type ListPriceRulesQuery = Readonly<{
  q?: string;
  status?: PriceRuleStatusFilter;
  sort?: PriceRuleSort;
  pageSize?: number;
  pageCursor?: string;
}>;

export type ListPriceRulesResponse = Readonly<{
  items: readonly PriceRuleDto[];
  nextCursor: string | null;
}>;

export class PriceRulesApiClient {
  constructor(private readonly client: FetchApiClient) {}

  async list(query: ListPriceRulesQuery = {}): Promise<ListPriceRulesResponse> {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (query.status) params.set('status', query.status);
    if (query.sort) params.set('sort', query.sort);
    if (query.pageSize) params.set('page[size]', String(query.pageSize));
    if (query.pageCursor) params.set('page[cursor]', query.pageCursor);
    const suffix = params.toString();

    const envelope = await this.client.request({
      path: suffix ? `${BASE_PATH}?${suffix}` : BASE_PATH,
      responseSchema: successEnvelopeSchema(priceRulesListSchema),
    });
    return { items: envelope.data, nextCursor: envelope.meta.next_cursor ?? null };
  }

  async create(command: CreatePriceRuleCommand): Promise<PriceRuleDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: BASE_PATH,
      body: createPriceRuleCommandSchema.parse(command),
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      responseSchema: successEnvelopeSchema(priceRuleSchema),
    });
    return envelope.data;
  }

  /** Rend aussi l ETag : necessaire pour enchainer `update()` (If-Match, CA9). */
  async getForEdit(priceRuleId: string): Promise<ApiResponseWithEtag<PriceRuleDto>> {
    const result = await this.client.requestWithEtag({
      path: `${BASE_PATH}/${priceRuleId}`,
      responseSchema: successEnvelopeSchema(priceRuleSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  async update(
    priceRuleId: string,
    command: UpdatePriceRuleCommand,
    ifMatch: string,
  ): Promise<ApiResponseWithEtag<PriceRuleDto>> {
    const result = await this.client.requestWithEtag({
      method: 'PATCH',
      path: `${BASE_PATH}/${priceRuleId}`,
      body: updatePriceRuleCommandSchema.parse(command),
      headers: { 'If-Match': ifMatch },
      responseSchema: successEnvelopeSchema(priceRuleSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  /** Bascule `is_active` seule (CA — emet `activated`/`deactivated`, pas `updated`). */
  async toggleActive(
    priceRuleId: string,
    isActive: boolean,
    ifMatch: string,
  ): Promise<ApiResponseWithEtag<PriceRuleDto>> {
    return this.update(priceRuleId, { is_active: isActive }, ifMatch);
  }

  async getDefaultMargin(productRangeId: string): Promise<ApiResponseWithEtag<ProductRangeDefaultMarginDto>> {
    const result = await this.client.requestWithEtag({
      path: `${API_V1_BASE_PATH}/product-ranges/${productRangeId}/default-margins`,
      responseSchema: successEnvelopeSchema(productRangeDefaultMarginSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  async setDefaultMargin(
    productRangeId: string,
    command: SetProductRangeDefaultMarginCommand,
    ifMatch: string,
  ): Promise<ApiResponseWithEtag<ProductRangeDefaultMarginDto>> {
    const result = await this.client.requestWithEtag({
      method: 'PUT',
      path: `${API_V1_BASE_PATH}/product-ranges/${productRangeId}/default-margins`,
      body: setProductRangeDefaultMarginCommandSchema.parse(command),
      headers: { 'If-Match': ifMatch },
      responseSchema: successEnvelopeSchema(productRangeDefaultMarginSchema),
    });
    return unwrapEnvelopeWithEtag(result);
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
