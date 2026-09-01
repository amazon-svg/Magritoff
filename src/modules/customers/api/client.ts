/**
 * Client HTTP typo du module Clients (story E10.4).
 *
 * Le tenant est resolu par la facade depuis le jeton (CA4 du socle E10.0) :
 * aucun chemin ici ne le porte. `Idempotency-Key` est genere localement pour
 * chaque tentative de creation ; `If-Match` doit reprendre l ETag lu sur la
 * ressource (voir `requestWithEtag`).
 */
import { successEnvelopeSchema } from '../../_shared/api/index.ts';
import { API_V1_BASE_PATH, type ApiResponseWithEtag, FetchApiClient } from '../../../platform/api/index.ts';
import {
  createCustomerCommandSchema,
  createCustomerContactCommandSchema,
  customerContactSchema,
  customerContactShopAccessSchema,
  customerDetailSchema,
  customerSchema,
  customersListSchema,
  openCustomerContactShopAccessCommandSchema,
  revokeCustomerContactShopAccessCommandSchema,
  revokeCustomerContactShopAccessResultSchema,
  siretVerificationResultSchema,
  updateCustomerCommandSchema,
  updateCustomerContactCommandSchema,
  type CreateCustomerCommand,
  type CreateCustomerContactCommand,
  type CustomerContactDto,
  type CustomerContactShopAccessDto,
  type CustomerDetailDto,
  type CustomerDto,
  type CustomerType,
  type SiretVerificationResultDto,
  type UpdateCustomerCommand,
  type UpdateCustomerContactCommand,
} from './contracts.ts';

const BASE_PATH = `${API_V1_BASE_PATH}/customers`;

export type ListCustomersQuery = Readonly<{
  q?: string;
  type?: CustomerType;
  pageSize?: number;
  pageCursor?: string;
}>;

export type ListCustomersResponse = Readonly<{
  items: readonly CustomerDto[];
  nextCursor: string | null;
}>;

export class CustomersApiClient {
  constructor(private readonly client: FetchApiClient) {}

  async list(query: ListCustomersQuery = {}): Promise<ListCustomersResponse> {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (query.type) params.set('type', query.type);
    if (query.pageSize) params.set('page[size]', String(query.pageSize));
    if (query.pageCursor) params.set('page[cursor]', query.pageCursor);
    const suffix = params.toString();

    const envelope = await this.client.request({
      path: suffix ? `${BASE_PATH}?${suffix}` : BASE_PATH,
      responseSchema: successEnvelopeSchema(customersListSchema),
    });
    return { items: envelope.data, nextCursor: envelope.meta.next_cursor ?? null };
  }

  async create(command: CreateCustomerCommand): Promise<CustomerDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: BASE_PATH,
      body: createCustomerCommandSchema.parse(command),
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      responseSchema: successEnvelopeSchema(customerSchema),
    });
    return envelope.data;
  }

  async getDetail(customerId: string): Promise<CustomerDetailDto> {
    const envelope = await this.client.request({
      path: `${BASE_PATH}/${customerId}`,
      responseSchema: successEnvelopeSchema(customerDetailSchema),
    });
    return envelope.data;
  }

  /** Rend aussi l ETag : necessaire pour enchainer `update()` (If-Match). */
  async getForEdit(customerId: string): Promise<ApiResponseWithEtag<CustomerDetailDto>> {
    const result = await this.client.requestWithEtag({
      path: `${BASE_PATH}/${customerId}`,
      responseSchema: successEnvelopeSchema(customerDetailSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  async update(
    customerId: string,
    command: UpdateCustomerCommand,
    ifMatch: string,
  ): Promise<ApiResponseWithEtag<CustomerDto>> {
    const result = await this.client.requestWithEtag({
      method: 'PATCH',
      path: `${BASE_PATH}/${customerId}`,
      body: updateCustomerCommandSchema.parse(command),
      headers: { 'If-Match': ifMatch },
      responseSchema: successEnvelopeSchema(customerSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  async listContacts(customerId: string): Promise<readonly CustomerContactDto[]> {
    const envelope = await this.client.request({
      path: `${BASE_PATH}/${customerId}/contacts`,
      responseSchema: successEnvelopeSchema(customerContactSchema.array()),
    });
    return envelope.data;
  }

  async createContact(
    customerId: string,
    command: CreateCustomerContactCommand,
  ): Promise<CustomerContactDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: `${BASE_PATH}/${customerId}/contacts`,
      body: createCustomerContactCommandSchema.parse(command),
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      responseSchema: successEnvelopeSchema(customerContactSchema),
    });
    return envelope.data;
  }

  /** Rend aussi l ETag : necessaire pour enchainer `updateContact()` (If-Match). */
  async getContactForEdit(
    customerId: string,
    contactId: string,
  ): Promise<ApiResponseWithEtag<CustomerContactDto>> {
    const result = await this.client.requestWithEtag({
      path: `${BASE_PATH}/${customerId}/contacts/${contactId}`,
      responseSchema: successEnvelopeSchema(customerContactSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  async updateContact(
    customerId: string,
    contactId: string,
    command: UpdateCustomerContactCommand,
    ifMatch: string,
  ): Promise<ApiResponseWithEtag<CustomerContactDto>> {
    const result = await this.client.requestWithEtag({
      method: 'PATCH',
      path: `${BASE_PATH}/${customerId}/contacts/${contactId}`,
      body: updateCustomerContactCommandSchema.parse(command),
      headers: { 'If-Match': ifMatch },
      responseSchema: successEnvelopeSchema(customerContactSchema),
    });
    return unwrapEnvelopeWithEtag(result);
  }

  /** E10.5 CA3 — action explicite, distincte de la creation de l interlocuteur. */
  async openContactShopAccess(
    customerId: string,
    contactId: string,
    shopId: string,
  ): Promise<CustomerContactShopAccessDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: `${BASE_PATH}/${customerId}/contacts/${contactId}/shop-access`,
      body: openCustomerContactShopAccessCommandSchema.parse({ shop_id: shopId }),
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      responseSchema: successEnvelopeSchema(customerContactShopAccessSchema),
    });
    return envelope.data;
  }

  /** E10.5 CA3 — revoque l acces boutique ouvert dans CETTE boutique. */
  async revokeContactShopAccess(customerId: string, contactId: string, shopId: string): Promise<void> {
    await this.client.request({
      method: 'DELETE',
      path: `${BASE_PATH}/${customerId}/contacts/${contactId}/shop-access`,
      body: revokeCustomerContactShopAccessCommandSchema.parse({ shop_id: shopId }),
      responseSchema: successEnvelopeSchema(revokeCustomerContactShopAccessResultSchema),
    });
  }

  async verifySiret(customerId: string): Promise<SiretVerificationResultDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: `${BASE_PATH}/${customerId}/siret-verifications`,
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      responseSchema: successEnvelopeSchema(siretVerificationResultSchema),
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
