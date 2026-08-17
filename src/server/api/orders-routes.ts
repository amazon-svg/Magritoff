import { parseId, type UserId } from '../../kernel/ids/index.ts';
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
  orderRolesResponseSchema,
} from '../../modules/orders/api/contracts.ts';
import type { OrdersService } from '../../modules/orders/application/orders-service.ts';
import { OrderCommandRejectedError } from '../../modules/orders/application/orders-repository.ts';
import type { StorefrontSessionService } from '../../modules/shop-customers/application/storefront-session-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';
import { readStorefrontSessionCookie, type StorefrontSessionCookiePolicy } from '../storefront/session-cookie.ts';

export function createOrdersRoutes(
  service: OrdersService,
  storefrontSessions?: StorefrontSessionService,
  storefrontCookiePolicy?: StorefrontSessionCookiePolicy,
): readonly ApiRoute[] {
  return [
    defineJsonRoute({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/orders`,
      authentication: 'public',
      inputSchema: createOrderCommandSchema,
      outputSchema: createOrderResultSchema,
      async handle(context, command) {
        try {
          const authorization = await orderCreationAuthorization(
            context, command.shopId, storefrontSessions, storefrontCookiePolicy,
          );
          return {
            status: 201,
            body: await service.create(command, new URL(context.request.url).origin, authorization),
          };
        } catch (error) {
          if (error instanceof OrderCommandRejectedError) throw toHttpError(error);
          throw error;
        }
      },
    }),
    defineJsonRoute({
      method: 'GET',
      path: `${API_V1_BASE_PATH}/orders/{orderId}/draft`,
      authentication: 'required',
      inputSchema: null,
      outputSchema: draftOrderSchema,
      async handle(context) {
        requireUserId(context);
        try {
          return { status: 200, body: await service.getDraft(context.params.orderId ?? '') };
        } catch (error) {
          if (error instanceof OrderCommandRejectedError) throw toHttpError(error);
          throw error;
        }
      },
    }),
    defineJsonRoute({
      method: 'PUT',
      path: `${API_V1_BASE_PATH}/orders/{orderId}/draft`,
      authentication: 'required',
      inputSchema: updateDraftOrderCommandSchema,
      outputSchema: updateDraftOrderResultSchema,
      async handle(context, command) {
        requireUserId(context);
        try {
          return {
            status: 200,
            body: await service.updateDraft(context.params.orderId ?? '', command),
          };
        } catch (error) {
          if (error instanceof OrderCommandRejectedError) throw toHttpError(error);
          throw error;
        }
      },
    }),
    defineJsonRoute({
      method: 'GET',
      path: `${API_V1_BASE_PATH}/orders/{orderId}/roles`,
      authentication: 'required',
      inputSchema: null,
      outputSchema: orderRolesResponseSchema,
      async handle(context) {
        requireUserId(context);
        try {
          return { status: 200, body: await service.getRoles(context.params.orderId ?? '') };
        } catch (error) {
          if (error instanceof OrderCommandRejectedError) throw toHttpError(error);
          throw error;
        }
      },
    }),
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
    defineJsonRoute({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/orders/{orderId}/transitions`,
      authentication: 'required',
      inputSchema: transitionOrderCommandSchema,
      outputSchema: transitionOrderResultSchema,
      async handle(context, command) {
        try {
          return {
            status: 200,
            body: await service.transition(
              requireParam(context, 'orderId'),
              command,
              requireUserId(context),
              new URL(context.request.url).origin,
            ),
          };
        } catch (error) {
          if (!(error instanceof OrderCommandRejectedError)) throw error;
          throw toHttpError(error);
        }
      },
    }),
  ];
}

async function orderCreationAuthorization(
  context: ApiRequestContext,
  shopId: string,
  sessions?: StorefrontSessionService,
  policy?: StorefrontSessionCookiePolicy,
) {
  if (sessions && policy) {
    const token = readStorefrontSessionCookie(context.request.headers.get('cookie'), policy);
    const session = token ? await sessions.current(token) : null;
    if (token && session?.identity.shopId === shopId) {
      return { kind: 'storefront_session' as const, opaqueToken: token };
    }
  }
  if (context.actor?.kind !== 'user') {
    throw new ApiHttpError({
      type: 'about:blank', title: 'Authentification requise', status: 401,
      code: 'identity.authentication_required',
    });
  }
  return { kind: 'magrit_user' as const };
}

function toHttpError(error: OrderCommandRejectedError): ApiHttpError {
  const status = error.code === 'order_not_found' || error.code === 'shop_not_found' ? 404
    : error.code === 'permission_denied' ? 403
      : error.code === 'invalid_order_items' ? 422 : 409;
  return new ApiHttpError({
    type: 'about:blank',
    title: status === 404 ? 'Ressource Orders introuvable'
      : status === 403 ? 'Commande interdite'
        : status === 422 ? 'Articles de commande invalides'
          : error.code === 'order_not_editable' ? 'Commande non modifiable' : 'Transition impossible',
    status,
    code: `orders.${error.code}`,
    detail: error.message,
  });
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
