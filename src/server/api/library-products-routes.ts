import { parseId, type UserId } from '../../kernel/ids/index.ts';
import {
  clearPimGeneratedProductsResultSchema,
  createLibraryProductsSchema,
  libraryProductInputSchema,
  libraryProductRemovedSchema,
  libraryProductSchema,
  libraryProductsSchema,
  pimGeneratedProductsResultSchema,
  updateLibraryProductSchema,
} from '../../modules/libraries/api/product-contracts.ts';
import { LibraryProductRejectedError } from '../../modules/libraries/application/library-products-repository.ts';
import type { LibraryProductsService } from '../../modules/libraries/application/library-products-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

export function createLibraryProductsRoutes(service: LibraryProductsService): readonly ApiRoute[] {
  const base = `${API_V1_BASE_PATH}/tenants/{tenantId}/library-products`;
  return [
    defineJsonRoute({ method: 'GET', path: base, authentication: 'required', inputSchema: null, outputSchema: libraryProductsSchema, async handle(context) { return execute(() => service.list(actor(context), param(context, 'tenantId')), 200); } }),
    defineJsonRoute({ method: 'POST', path: base, authentication: 'required', inputSchema: libraryProductInputSchema, outputSchema: libraryProductSchema, async handle(context, command) { return execute(() => service.create(actor(context), param(context, 'tenantId'), command), 201); } }),
    defineJsonRoute({ method: 'POST', path: `${base}/bulk`, authentication: 'required', inputSchema: createLibraryProductsSchema, outputSchema: libraryProductsSchema, async handle(context, command) { return execute(() => service.createMany(actor(context), param(context, 'tenantId'), command.products), 201); } }),
    defineJsonRoute({ method: 'PUT', path: `${base}/pim-generated`, authentication: 'required', inputSchema: createLibraryProductsSchema, outputSchema: pimGeneratedProductsResultSchema, async handle(context, command) { return execute(() => service.replacePimGenerated(actor(context), param(context, 'tenantId'), command.products), 200); } }),
    defineJsonRoute({ method: 'DELETE', path: `${base}/pim-generated`, authentication: 'required', inputSchema: null, outputSchema: clearPimGeneratedProductsResultSchema, async handle(context) { return execute(() => service.clearPimGenerated(actor(context), param(context, 'tenantId')), 200); } }),
    defineJsonRoute({ method: 'PUT', path: `${base}/{productId}`, authentication: 'required', inputSchema: updateLibraryProductSchema, outputSchema: libraryProductSchema, async handle(context, command) { return execute(() => service.update(actor(context), param(context, 'tenantId'), param(context, 'productId'), command), 200); } }),
    defineJsonRoute({ method: 'DELETE', path: `${base}/{productId}`, authentication: 'required', inputSchema: null, outputSchema: libraryProductRemovedSchema, async handle(context) { return execute(() => service.remove(actor(context), param(context, 'tenantId'), param(context, 'productId')), 200); } }),
  ];
}

async function execute<T>(operation: () => Promise<T>, status: number): Promise<{ status: number; body: T }> {
  try { return { status, body: await operation() }; }
  catch (error) {
    if (error instanceof LibraryProductRejectedError) {
      const responseStatus = error.code === 'not_found' ? 404 : error.code === 'invalid_product' ? 422 : 403;
      throw new ApiHttpError({ type: 'about:blank', title: error.code === 'not_found' ? 'Produit introuvable' : error.code === 'invalid_product' ? 'Produit invalide' : 'Accès produit interdit', status: responseStatus, code: `library_products.${error.code}`, detail: error.message });
    }
    throw error;
  }
}
function actor(context: ApiRequestContext): UserId { if (context.actor?.kind !== 'user') throw new ApiHttpError({ type: 'about:blank', title: 'Acteur utilisateur requis', status: 403, code: 'identity.user_actor_required' }); return context.actor.userId as UserId; }
function param(context: ApiRequestContext, name: string): string { const parsed = parseId(context.params[name] ?? ''); if (!parsed.ok) throw new ApiHttpError({ type: 'about:blank', title: 'Identifiant invalide', status: 422, code: 'api.validation_failed' }); return parsed.value; }
