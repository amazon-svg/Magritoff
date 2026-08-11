import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  orderAuditTrailSchema,
  ordersListSchema,
  portalOrdersResponseSchema,
  type OrderAuditTrail,
  type OrdersList,
  type PortalOrdersResponse,
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
}
