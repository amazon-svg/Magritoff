/**
 * Client HTTP type du module Commandes de gestion commerciale (story E10.12).
 *
 * `convertQuote` vit ici (chemin `/quotes/{quoteId}/conversions`) meme si son
 * URL porte le segment `quotes` : l operation rend et cree une ressource
 * `CommercialOrder`, pas un `Quote` (voir en-tete de `../api/contracts.ts`).
 */
import { successEnvelopeSchema } from '../../_shared/api/index.ts';
import { API_V1_BASE_PATH, ApiClientError, type ApiResponseWithEtag, FetchApiClient } from '../../../platform/api/index.ts';
import { orderDocumentSchema, type OrderDocumentDto } from '../../order-documents/api/contracts.ts';
import {
  changeOrderProductionStepCommandSchema,
  commercialOrderDetailSchema,
  commercialOrdersListSchema,
  convertQuoteCommandSchema,
  orderStepChangeSchema,
  orderStepChangesListSchema,
  type ChangeOrderProductionStepCommand,
  type CommercialOrderDetailDto,
  type CommercialOrderDto,
  type CommercialOrderStatus,
  type OrderStepChangeDto,
} from './contracts.ts';

const ORDERS_BASE_PATH = `${API_V1_BASE_PATH}/commercial-orders`;
const QUOTES_BASE_PATH = `${API_V1_BASE_PATH}/quotes`;

export type ListOrderStepChangesQuery = Readonly<{
  pageSize?: number;
  pageCursor?: string;
}>;

export type ListOrderStepChangesResponse = Readonly<{
  items: readonly OrderStepChangeDto[];
  nextCursor: string | null;
}>;

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

  /**
   * E10.14 — journal antichronologique, colonne gauche de la modale unique
   * (`OrderStatusDialog`). Lecture seule, aucun `Idempotency-Key`.
   */
  async listStepChanges(
    orderId: string,
    query: ListOrderStepChangesQuery = {},
  ): Promise<ListOrderStepChangesResponse> {
    const params = new URLSearchParams();
    if (query.pageSize) params.set('page[size]', String(query.pageSize));
    if (query.pageCursor) params.set('page[cursor]', query.pageCursor);
    const suffix = params.toString();
    const path = `${ORDERS_BASE_PATH}/${orderId}/step-changes`;

    const envelope = await this.client.request({
      path: suffix ? `${path}?${suffix}` : path,
      responseSchema: successEnvelopeSchema(orderStepChangesListSchema),
    });
    return { items: envelope.data, nextCursor: envelope.meta.next_cursor ?? null };
  }

  /**
   * E10.14 — deplace la commande sur une etape de production, colonne droite
   * de la modale unique. AUCUN `If-Match` (decision #6 du contrat) : jamais
   * de precondition de concurrence sur ce geste. `Idempotency-Key` generee
   * ici (double-clic depuis une grille dense).
   */
  async changeProductionStep(
    orderId: string,
    command: ChangeOrderProductionStepCommand,
  ): Promise<OrderStepChangeDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: `${ORDERS_BASE_PATH}/${orderId}/step-changes`,
      body: changeOrderProductionStepCommandSchema.parse(command),
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      responseSchema: successEnvelopeSchema(orderStepChangeSchema),
    });
    return envelope.data;
  }

  /**
   * E10.19b — lit le bon de commande PDF deja produit. Rend `null` sur le CAS
   * NOMINAL `order.document_not_generated` (contrat §8.20 §6 : "toute
   * commande dont personne n a clique « Produire le bon de commande » rend ce
   * code, indefiniment et sans anomalie") — jamais une exception a attraper
   * par l ecran appelant pour ce seul cas. Toute AUTRE erreur (404
   * `order.not_found`, 401, 403...) est propagee telle quelle.
   */
  async getDocument(orderId: string): Promise<OrderDocumentDto | null> {
    try {
      const envelope = await this.client.request({
        path: `${ORDERS_BASE_PATH}/${orderId}/documents`,
        responseSchema: successEnvelopeSchema(orderDocumentSchema),
      });
      return envelope.data;
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.problem.code === 'order.document_not_generated') return null;
      throw cause;
    }
  }

  /**
   * E10.19b — PRODUIT le bon de commande PDF (« Produire le bon de
   * commande »), ACTION EXPLICITE. `Idempotency-Key` generee ici (double-clic
   * depuis la fiche commande, geste rare mais possible).
   */
  async generateDocument(orderId: string): Promise<OrderDocumentDto> {
    const envelope = await this.client.request({
      method: 'POST',
      path: `${ORDERS_BASE_PATH}/${orderId}/documents`,
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      responseSchema: successEnvelopeSchema(orderDocumentSchema),
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
