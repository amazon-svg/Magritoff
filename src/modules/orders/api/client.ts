import { successEnvelopeSchema } from '../../_shared/api/index.ts';
import { orderListEntriesSchema, unifiedOrderDetailSchema, type UnifiedOrderDetail, type OrderListFilters } from './contracts.ts';
import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  orderAuditTrailSchema,
  ordersListSchema,
  portalOrdersResponseSchema,
  transitionOrderCommandSchema,
  transitionOrderResultSchema,
  createOrderCommandSchema,
  createOrderResultSchema,
  draftOrderSchema,
  orderDetailSchema,
  updateDraftOrderCommandSchema,
  updateDraftOrderResultSchema,
  orderRolesResponseSchema,
  type OrderAuditTrail,
  type OrdersList,
  type PortalOrdersResponse,
  type TransitionOrderCommand,
  type TransitionOrderResult,
  type CreateOrderCommand,
  type CreateOrderResult,
  type DraftOrder,
  type OrderDetail,
  type UpdateDraftOrderCommand,
  type UpdateDraftOrderResult,
  type OrderRolesResponse,
} from './contracts.ts';

export class OrdersApiClient {
  async list(query: OrderListFilters & { pageSize?: number; pageCursor?: string } = {}) {
    const params = new URLSearchParams();
    const { pageSize, pageCursor, ...filters } = query;
    if (pageSize !== undefined) params.set('page[size]', String(pageSize));
    if (pageCursor) params.set('page[cursor]', pageCursor);
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '') params.set(key, value);
    }
    const response = await this.client.request({
      path: `${API_V1_BASE_PATH}/order-summaries?${params}`,
      responseSchema: successEnvelopeSchema(orderListEntriesSchema),
    });
    return { items: response.data, nextCursor: response.meta.next_cursor ?? null };
  }

  constructor(private readonly client: FetchApiClient) {}

  async getUnifiedDetail(orderId: string, signal?: AbortSignal): Promise<UnifiedOrderDetail> {
    const response = await this.client.request({
      path: `${API_V1_BASE_PATH}/order-summaries/${encodeURIComponent(orderId)}`,
      responseSchema: successEnvelopeSchema(unifiedOrderDetailSchema),
      ...(signal === undefined ? {} : { signal }),
    });
    return response.data;
  }

  listTenantOrders(tenantId: string, shopIds: readonly string[], signal?: AbortSignal): Promise<OrdersList> {
    const query = new URLSearchParams();
    for (const shopId of shopIds) query.append('shopId', shopId);
    return this.client.request({
      path: `${API_V1_BASE_PATH}/tenants/${encodeURIComponent(tenantId)}/orders?${query.toString()}`,
      responseSchema: ordersListSchema,
      ...(signal === undefined ? {} : { signal }),
    });
  }

  listPortalOrders(shopId: string, signal?: AbortSignal): Promise<PortalOrdersResponse> {
    return this.client.request({
      path: `${API_V1_BASE_PATH}/shops/${encodeURIComponent(shopId)}/orders`,
      responseSchema: portalOrdersResponseSchema,
      ...(signal === undefined ? {} : { signal }),
    });
  }

  getAuditTrail(orderId: string, signal?: AbortSignal): Promise<OrderAuditTrail> {
    return this.client.request({
      path: `${API_V1_BASE_PATH}/orders/${encodeURIComponent(orderId)}/audit`,
      responseSchema: orderAuditTrailSchema,
      ...(signal === undefined ? {} : { signal }),
    });
  }

  transition(orderId: string, command: TransitionOrderCommand): Promise<TransitionOrderResult> {
    return this.client.request({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/orders/${encodeURIComponent(orderId)}/transitions`,
      body: transitionOrderCommandSchema.parse(command),
      responseSchema: transitionOrderResultSchema,
    });
  }

  create(command: CreateOrderCommand): Promise<CreateOrderResult> {
    return this.client.request({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/orders`,
      body: createOrderCommandSchema.parse(command),
      responseSchema: createOrderResultSchema,
    });
  }

  getDraft(orderId: string, signal?: AbortSignal): Promise<DraftOrder> {
    return this.client.request({
      path: `${API_V1_BASE_PATH}/orders/${encodeURIComponent(orderId)}/draft`,
      responseSchema: draftOrderSchema,
      ...(signal === undefined ? {} : { signal }),
    });
  }

  getDetail(orderId: string, signal?: AbortSignal): Promise<OrderDetail> {
    return this.client.request({
      path: `${API_V1_BASE_PATH}/orders/${encodeURIComponent(orderId)}`,
      responseSchema: orderDetailSchema,
      ...(signal === undefined ? {} : { signal }),
    });
  }

  updateDraft(orderId: string, command: UpdateDraftOrderCommand): Promise<UpdateDraftOrderResult> {
    return this.client.request({
      method: 'PUT',
      path: `${API_V1_BASE_PATH}/orders/${encodeURIComponent(orderId)}/draft`,
      body: updateDraftOrderCommandSchema.parse(command),
      responseSchema: updateDraftOrderResultSchema,
    });
  }

  getRoles(orderId: string, signal?: AbortSignal): Promise<OrderRolesResponse> {
    return this.client.request({
      path: `${API_V1_BASE_PATH}/orders/${encodeURIComponent(orderId)}/roles`,
      responseSchema: orderRolesResponseSchema,
      ...(signal === undefined ? {} : { signal }),
    });
  }
}
