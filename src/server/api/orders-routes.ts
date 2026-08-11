import { parseId, type UserId } from '../../kernel/ids/index.ts';
import {
  orderAuditTrailSchema,
  ordersListSchema,
  portalOrdersResponseSchema,
} from '../../modules/orders/api/contracts.ts';
import type { OrdersService } from '../../modules/orders/application/orders-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

export function createOrdersRoutes(service: OrdersService): readonly ApiRoute[] {
  return [
    defineJsonRoute({
      method: 'GET',
      path: `${API_V1_BASE_PATH}/tenants/{tenantId}/orders`,
      authentication: 'required',
      inputSchema: null,
      outputSchema: ordersListSchema,
      async handle(context) {
        requireUserId(context);
        const shopIds = new URL(context.request.url).searchParams.getAll('shopId').filter(Boolean);
        return { status: 200, body: await service.listTenantOrders(requireParam(context, 'tenantId'), shopIds) };
      },
    }),
    defineJsonRoute({
      method: 'GET',
      path: `${API_V1_BASE_PATH}/shops/{shopId}/orders`,
      authentication: 'required',
      inputSchema: null,
      outputSchema: portalOrdersResponseSchema,
      async handle(context) {
        return {
          status: 200,
          body: await service.listPortalOrders(requireParam(context, 'shopId'), requireUserId(context)),
        };
      },
    }),
    defineJsonRoute({
      method: 'GET',
      path: `${API_V1_BASE_PATH}/orders/{orderId}/audit`,
      authentication: 'required',
      inputSchema: null,
      outputSchema: orderAuditTrailSchema,
      async handle(context) {
        requireUserId(context);
        return { status: 200, body: await service.getAuditTrail(requireParam(context, 'orderId')) };
      },
    }),
  ];
}

function requireUserId(context: ApiRequestContext): UserId {
  if (context.actor?.kind !== 'user') {
    throw new ApiHttpError({
      type: 'about:blank', title: 'Acteur utilisateur requis', status: 403,
      code: 'identity.user_actor_required',
    });
  }
  const parsed = parseId<'UserId'>(context.actor.userId);
  if (!parsed.ok) throw new Error('Identifiant utilisateur invalide.');
  return parsed.value;
}

function requireParam(context: ApiRequestContext, name: string): string {
  const value = context.params[name]?.trim();
  if (!value) throw new Error(`Paramètre ${name} absent.`);
  return value;
}
