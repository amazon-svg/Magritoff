import { parseId, type UserId } from '../../kernel/ids/index.ts';
import {
  hopeStudioTenantSettingsSchema,
  hopeStudioTenantSettingsUpdatedSchema,
  updateHopeStudioTenantSettingsSchema,
} from '../../modules/hopstudio/api/tenant-settings.ts';
import {
  HopeStudioSettingsRejectedError,
  type HopeStudioTenantSettingsService,
} from '../../modules/hopstudio/application/hopstudio-tenant-settings-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

const PATH = `${API_V1_BASE_PATH}/tenants/{tenantId}/integrations/hopstudio`;

export function createHopeStudioSettingsRoutes(
  service: HopeStudioTenantSettingsService,
): readonly ApiRoute[] {
  return [
    defineJsonRoute({
      method: 'GET',
      path: PATH,
      authentication: 'required',
      inputSchema: null,
      outputSchema: hopeStudioTenantSettingsSchema,
      async handle(context) {
        return execute(async () => ({
          status: 200,
          body: await service.get(actor(context), tenantId(context)),
        }));
      },
    }),
    defineJsonRoute({
      method: 'PUT',
      path: PATH,
      authentication: 'required',
      inputSchema: updateHopeStudioTenantSettingsSchema,
      outputSchema: hopeStudioTenantSettingsUpdatedSchema,
      async handle(context, command) {
        return execute(async () => {
          await service.update(actor(context), tenantId(context), command);
          return { status: 200, body: { updated: true as const } };
        });
      },
    }),
  ];
}

async function execute<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof HopeStudioSettingsRejectedError) {
      const forbidden = error.code === 'permission_denied';
      throw new ApiHttpError({
        type: 'about:blank',
        title: forbidden ? 'Gestion Clariprint Studio interdite' : 'Configuration Clariprint Studio indisponible',
        status: forbidden ? 403 : 503,
        code: `hopstudio.${error.code}`,
        detail: error.message,
      });
    }
    throw error;
  }
}

function actor(context: ApiRequestContext): UserId {
  if (context.actor?.kind !== 'user') {
    throw new ApiHttpError({
      type: 'about:blank',
      title: 'Acteur utilisateur requis',
      status: 403,
      code: 'identity.user_actor_required',
    });
  }
  return context.actor.userId;
}

function tenantId(context: ApiRequestContext): string {
  const parsed = parseId(context.params.tenantId ?? '');
  if (!parsed.ok) {
    throw new ApiHttpError({
      type: 'about:blank',
      title: 'Identifiant de tenant invalide',
      status: 422,
      code: 'api.validation_failed',
    });
  }
  return parsed.value;
}
