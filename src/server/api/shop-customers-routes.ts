import { parseId, type UserId } from '../../kernel/ids/index.ts';
import { createShopCustomerCommandSchema, shopCustomerAccountSchema, shopCustomerAccountsSchema } from '../../modules/shop-customers/api/contracts.ts';
import { ShopCustomerRejectedError } from '../../modules/shop-customers/application/shop-customers-repository.ts';
import type { ShopCustomersService } from '../../modules/shop-customers/application/shop-customers-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

export function createShopCustomersRoutes(service: ShopCustomersService): readonly ApiRoute[] {
  const base = `${API_V1_BASE_PATH}/tenants/{tenantId}/shops/{shopId}/customers`;
  return [
    defineJsonRoute({
      method: 'GET', path: base, authentication: 'required',
      inputSchema: null, outputSchema: shopCustomerAccountsSchema,
      async handle(context) {
        return execute(async () => ({
          status: 200,
          body: await service.list(
            actor(context),
            param(context, 'tenantId'),
            param(context, 'shopId'),
          ),
        }));
      },
    }),
    defineJsonRoute({
      method: 'POST', path: base, authentication: 'required',
      inputSchema: createShopCustomerCommandSchema, outputSchema: shopCustomerAccountSchema,
      async handle(context, command) {
        return execute(async () => ({
          status: 201,
          body: await service.create(
            actor(context),
            param(context, 'tenantId'),
            param(context, 'shopId'),
            command,
          ),
        }));
      },
    }),
  ];
}

async function execute<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ShopCustomerRejectedError) throw httpError(error);
    throw error;
  }
}

function httpError(error: ShopCustomerRejectedError): ApiHttpError {
  const status = error.code === 'duplicate_email'
    ? 409
    : error.code === 'shop_not_found' || error.code === 'account_not_found'
      ? 404
      : error.code === 'invalid_request'
        ? 422
        : 403;
  return new ApiHttpError({
    type: 'about:blank',
    title: status === 409 ? 'Compte boutique déjà existant'
      : status === 404 ? 'Compte ou boutique introuvable'
        : status === 422 ? 'Compte boutique invalide' : 'Gestion des comptes boutique interdite',
    status,
    code: `shop_customers.${error.code}`,
    detail: error.message,
  });
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
