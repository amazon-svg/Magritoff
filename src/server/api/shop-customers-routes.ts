import { decodeCursor } from '../../modules/_shared/application/index.ts';
import { z } from 'zod';
import { parseId, type UserId } from '../../kernel/ids/index.ts';
import { shopCustomerPageQuerySchema, shopCustomerPageSchema, shopCustomerDetailSchema, shopCustomerOrdersPageSchema, updateShopCustomerCommandSchema, createShopCustomerCommandSchema, ensureSelfShopCustomerResultSchema, shopCustomerAccountSchema, shopCustomerAccountsSchema } from '../../modules/shop-customers/api/contracts.ts';
import { ShopCustomerRejectedError } from '../../modules/shop-customers/application/shop-customers-repository.ts';
import type { ShopCustomersService } from '../../modules/shop-customers/application/shop-customers-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

export function createShopCustomersRoutes(service: ShopCustomersService): readonly ApiRoute[] {
  return createShopCustomerAdministrationRoutes(service);
}

export function createShopCustomerAdministrationRoutes(service: ShopCustomersService): readonly ApiRoute[] {
  const base = `${API_V1_BASE_PATH}/tenants/{tenantId}/shops/{shopId}/customers`;
  return [
    defineJsonRoute({
      method: 'GET', path: `${base}/page`, authentication: 'required',
      inputSchema: null, outputSchema: shopCustomerPageSchema,
      async handle(context) { return execute(async () => ({ status: 200,
        body: await service.listPage(actor(context), param(context, 'tenantId'), param(context, 'shopId'), pageParams(context)) })); },
    }),
    defineJsonRoute({
      method: 'GET', path: `${base}/{customerId}`, authentication: 'required',
      inputSchema: null, outputSchema: shopCustomerDetailSchema,
      async handle(context) { return execute(async () => ({ status: 200,
        body: await service.detail(actor(context), param(context, 'tenantId'), param(context, 'shopId'), param(context, 'customerId')) })); },
    }),
    defineJsonRoute({
      method: 'GET', path: `${base}/{customerId}/orders`, authentication: 'required',
      inputSchema: null, outputSchema: shopCustomerOrdersPageSchema,
      async handle(context) { return execute(async () => ({ status: 200,
        body: await service.ordersPage(actor(context), param(context, 'tenantId'), param(context, 'shopId'), param(context, 'customerId'), pageParams(context)) })); },
    }),
    defineJsonRoute({
      method: 'PATCH', path: `${base}/{customerId}`, authentication: 'required',
      inputSchema: updateShopCustomerCommandSchema, outputSchema: shopCustomerAccountSchema,
      async handle(context, command) { return execute(async () => ({ status: 200,
        body: await service.update(actor(context), param(context, 'tenantId'), param(context, 'shopId'), param(context, 'customerId'), command) })); },
    }),
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
    defineJsonRoute({
      method: 'POST', path: `${base}/self`, authentication: 'required',
      inputSchema: null, outputSchema: ensureSelfShopCustomerResultSchema,
      async handle(context) {
        return execute(async () => ({
          status: 200,
          body: await service.ensureSelf(
            actor(context),
            param(context, 'tenantId'),
            param(context, 'shopId'),
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


function pageParams(context: ApiRequestContext) {
  const url = new URL(context.request.url);
  const result = shopCustomerPageQuerySchema.safeParse({
    size: url.searchParams.get('page[size]') ?? undefined,
    cursor: url.searchParams.get('page[cursor]'),
  });
  if (!result.success) throw new ApiHttpError({ type: 'about:blank', title: 'Pagination invalide', status: 422, code: 'api.invalid_page_params' });
  let cursor = null;
  try {
    cursor = result.data.cursor ? decodeCursor(result.data.cursor) : null;
    if (cursor && (!z.string().uuid().safeParse(cursor.id).success || !z.iso.datetime({ offset: true }).safeParse(cursor.sort).success)) {
      throw new Error('Position invalide');
    }
  } catch {
    throw new ApiHttpError({ type: 'about:blank', title: 'Curseur invalide', status: 422, code: 'api.invalid_cursor' });
  }
  return { size: result.data.size, cursor };
}
