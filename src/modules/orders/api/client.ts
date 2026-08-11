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
  updateDraftOrderCommandSchema,
  updateDraftOrderResultSchema,
  type OrderAuditTrail,
  type OrdersList,
  type PortalOrdersResponse,
  type TransitionOrderCommand,
  type TransitionOrderResult,
  type CreateOrderCommand,
  type CreateOrderResult,
  type DraftOrder,
  type UpdateDraftOrderCommand,
  type UpdateDraftOrderResult,
} from './contracts.ts';

export class OrdersApiClient {
  constructor(private readonly client: FetchApiClient) {}

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

  updateDraft(orderId: string, command: UpdateDraftOrderCommand): Promise<UpdateDraftOrderResult> {
    return this.client.request({
      method: 'PUT',
      path: `${API_V1_BASE_PATH}/orders/${encodeURIComponent(orderId)}/draft`,
      body: updateDraftOrderCommandSchema.parse(command),
      responseSchema: updateDraftOrderResultSchema,
    });
  }
}
