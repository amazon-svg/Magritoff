import { parseId, type UserId } from '../../kernel/ids/index.ts';
import {
  createLibrarySchema,
  librariesSchema,
  libraryRemovedSchema,
  librarySchema,
  updateLibrarySchema,
} from '../../modules/libraries/api/contracts.ts';
import { LibraryRejectedError } from '../../modules/libraries/application/libraries-repository.ts';
import type { LibrariesService } from '../../modules/libraries/application/libraries-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

export function createLibrariesRoutes(service: LibrariesService): readonly ApiRoute[] {
  const base = `${API_V1_BASE_PATH}/tenants/{tenantId}/libraries`;
  return [
    defineJsonRoute({
      method: 'GET',
      path: base,
      authentication: 'required',
      inputSchema: null,
      outputSchema: librariesSchema,
      async handle(context) {
        return execute(() => service.list(actor(context), param(context, 'tenantId')), 200);
      },
    }),
    defineJsonRoute({
      method: 'POST',
      path: base,
      authentication: 'required',
      inputSchema: createLibrarySchema,
      outputSchema: librarySchema,
      async handle(context, command) {
        return execute(() => service.create(actor(context), param(context, 'tenantId'), command), 201);
      },
    }),
    defineJsonRoute({
      method: 'PUT',
      path: `${base}/{libraryId}`,
      authentication: 'required',
      inputSchema: updateLibrarySchema,
      outputSchema: librarySchema,
      async handle(context, command) {
        return execute(() => service.update(actor(context), param(context, 'tenantId'), param(context, 'libraryId'), command), 200);
      },
    }),
    defineJsonRoute({
      method: 'DELETE',
      path: `${base}/{libraryId}`,
      authentication: 'required',
      inputSchema: null,
      outputSchema: libraryRemovedSchema,
      async handle(context) {
        return execute(() => service.remove(actor(context), param(context, 'tenantId'), param(context, 'libraryId')), 200);
      },
    }),
  ];
}

async function execute<T>(operation: () => Promise<T>, status: number): Promise<{ status: number; body: T }> {
  try {
    return { status, body: await operation() };
  } catch (error) {
    if (error instanceof LibraryRejectedError) {
      const responseStatus = error.code === 'not_found' ? 404 : error.code === 'invalid_library' ? 422 : 403;
      throw new ApiHttpError({
        type: 'about:blank',
        title: error.code === 'not_found' ? 'Bibliothèque introuvable' : error.code === 'invalid_library' ? 'Bibliothèque invalide' : 'Accès bibliothèque interdit',
        status: responseStatus,
        code: `libraries.${error.code}`,
        detail: error.message,
      });
    }
    throw error;
  }
}

function actor(context: ApiRequestContext): UserId {
  if (context.actor?.kind !== 'user') {
    throw new ApiHttpError({ type: 'about:blank', title: 'Acteur utilisateur requis', status: 403, code: 'identity.user_actor_required' });
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
