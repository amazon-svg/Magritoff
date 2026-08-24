import { parseId, type UserId } from '../../kernel/ids/index.ts';
import {
  createShopCustomerDelegationCommandSchema,
  selfShopCustomerDelegationResultSchema,
} from '../../modules/shop-customers/api/contracts.ts';
import {
  ShopCustomerDelegationRejectedError,
  type ShopCustomerDelegationService,
} from '../../modules/shop-customers/application/shop-customer-delegation-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { serializeStorefrontSessionCookie, type StorefrontSessionCookiePolicy } from '../storefront/session-cookie.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

export function createShopCustomerDelegationRoutes(
  service: ShopCustomerDelegationService,
  cookiePolicy: StorefrontSessionCookiePolicy,
): readonly ApiRoute[] {
  return [defineJsonRoute({
    method: 'POST',
    path: `${API_V1_BASE_PATH}/tenants/{tenantId}/shops/{shopId}/customers/self-delegation`,
    authentication: 'required',
    inputSchema: createShopCustomerDelegationCommandSchema,
    outputSchema: selfShopCustomerDelegationResultSchema,
    async handle(context, command) {
      try {
        const issued = await service.startSelf(
          actor(context),
          param(context, 'tenantId'),
          param(context, 'shopId'),
          command,
        );
        return {
          status: 201,
          headers: {
            'Set-Cookie': serializeStorefrontSessionCookie(issued.opaqueToken, issued.maxAgeSeconds, cookiePolicy),
            'Cache-Control': 'no-store',
          },
          body: issued.result,
        };
      } catch (error) {
        if (error instanceof ShopCustomerDelegationRejectedError) {
          throw new ApiHttpError({
            type: 'about:blank', title: 'Délégation interdite', status: 403,
            code: 'shop_customers.delegation_denied', detail: error.message,
          });
        }
        throw error;
      }
    },
  })];
}

function actor(context: ApiRequestContext): UserId {
  if (context.actor?.kind !== 'user') {
    throw new ApiHttpError({
      type: 'about:blank', title: 'Acteur utilisateur requis', status: 403,
      code: 'identity.user_actor_required',
    });
  }
  return context.actor.userId as UserId;
}

function param(context: ApiRequestContext, name: string): string {
  const parsed = parseId(context.params[name] ?? '');
  if (!parsed.ok) {
    throw new ApiHttpError({ type: 'about:blank', title: 'Identifiant invalide', status: 422, code: 'api.validation_failed' });
  }
  return parsed.value;
}
