import { parseId, type UserId } from '../../kernel/ids/index.ts';
import {
  inviteShopCustomerCommandSchema,
  inviteShopCustomerResultSchema,
} from '../../modules/shop-customers/api/contracts.ts';
import {
  ShopCustomerInvitationRejectedError,
  type ShopCustomerInvitationService,
} from '../../modules/shop-customers/application/shop-customer-invitation-service.ts';
import { ShopCustomerRejectedError } from '../../modules/shop-customers/application/shop-customers-repository.ts';
import { StorefrontActivationRejectedError } from '../../modules/shop-customers/application/storefront-activation-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

export function createShopCustomerInvitationRoutes(
  service: ShopCustomerInvitationService,
): readonly ApiRoute[] {
  return [defineJsonRoute({
    method: 'POST',
    path: `${API_V1_BASE_PATH}/tenants/{tenantId}/shops/{shopId}/customers/invitations`,
    authentication: 'required',
    inputSchema: inviteShopCustomerCommandSchema,
    outputSchema: inviteShopCustomerResultSchema,
    async handle(context, command) {
      return execute(async () => ({
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
        body: await service.invite(
          actor(context),
          param(context, 'tenantId'),
          param(context, 'shopId'),
          command,
          publicAppBaseUrl(context.request),
        ),
      }));
    },
  })];
}

async function execute<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ShopCustomerInvitationRejectedError) {
      throw new ApiHttpError({
        type: 'about:blank', title: 'Invitation boutique impossible', status: 409,
        code: `shop_customer_invitations.${error.code}`, detail: error.message,
      });
    }
    if (error instanceof ShopCustomerRejectedError) {
      throw new ApiHttpError({
        type: 'about:blank', title: 'Gestion du compte boutique impossible', status: 403,
        code: `shop_customers.${error.code}`, detail: error.message,
      });
    }
    if (error instanceof StorefrontActivationRejectedError) {
      throw new ApiHttpError({
        type: 'about:blank', title: 'Émission du lien interdite', status: 403,
        code: `storefront.${error.code}`, detail: error.message,
      });
    }
    throw error;
  }
}

function publicAppBaseUrl(request: Request): string {
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.origin;
    } catch { /* repli sur l’origine de la requête */ }
  }
  return new URL(request.url).origin;
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
    throw new ApiHttpError({
      type: 'about:blank', title: 'Identifiant invalide', status: 422,
      code: 'api.validation_failed',
    });
  }
  return parsed.value;
}
