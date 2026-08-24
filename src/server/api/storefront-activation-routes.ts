import { parseId, type UserId } from '../../kernel/ids/index.ts';
import {
  activateStorefrontCredentialCommandSchema,
  activateStorefrontCredentialResultSchema,
  issueStorefrontActivationCommandSchema,
  issueStorefrontActivationResultSchema,
} from '../../modules/shop-customers/api/contracts.ts';
import {
  StorefrontActivationRejectedError,
  type StorefrontActivationService,
} from '../../modules/shop-customers/application/storefront-activation-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { serializeStorefrontSessionCookie, type StorefrontSessionCookiePolicy } from '../storefront/session-cookie.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

export function createStorefrontActivationRoutes(
  service: StorefrontActivationService,
  cookiePolicy: StorefrontSessionCookiePolicy,
): readonly ApiRoute[] {
  return [
    defineJsonRoute({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/tenants/{tenantId}/shops/{shopId}/customers/{customerId}/activation`,
      authentication: 'required',
      inputSchema: issueStorefrontActivationCommandSchema,
      outputSchema: issueStorefrontActivationResultSchema,
      async handle(context, command) {
        return execute(async () => ({
          status: 201,
          headers: { 'Cache-Control': 'no-store' },
          body: await service.issue(
            actor(context),
            param(context, 'tenantId'),
            param(context, 'shopId'),
            param(context, 'customerId'),
            command,
            publicAppBaseUrl(context.request),
          ),
        }));
      },
    }),
    defineJsonRoute({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/storefront/activation`,
      authentication: 'public',
      inputSchema: activateStorefrontCredentialCommandSchema,
      outputSchema: activateStorefrontCredentialResultSchema,
      async handle(_context, command) {
        return execute(async () => {
          const issued = await service.activate(command);
          return {
            status: 200,
            headers: {
              'Set-Cookie': serializeStorefrontSessionCookie(issued.opaqueToken, issued.maxAgeSeconds, cookiePolicy),
              'Cache-Control': 'no-store',
            },
            body: { activated: true as const, session: issued.session },
          };
        });
      },
    }),
  ];
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

async function execute<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof StorefrontActivationRejectedError) {
      const publicActivation = error.code === 'activation_failed';
      throw new ApiHttpError({
        type: 'about:blank',
        title: publicActivation ? 'Activation impossible' : 'Émission du lien interdite',
        status: publicActivation ? 400 : 403,
        code: `storefront.${error.code}`,
        detail: error.message,
      });
    }
    throw error;
  }
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
