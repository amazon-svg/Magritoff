import { createStorefrontSessionCommandSchema, createStorefrontSessionResultSchema } from '../../modules/shop-customers/api/contracts.ts';
import { StorefrontAuthenticationRejectedError, type StorefrontAuthenticationService } from '../../modules/shop-customers/application/storefront-authentication-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { serializeStorefrontSessionCookie, type StorefrontSessionCookiePolicy } from '../storefront/session-cookie.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRoute } from './routes.ts';

export function createStorefrontSessionRoutes(
  service: StorefrontAuthenticationService,
  cookiePolicy: StorefrontSessionCookiePolicy,
): readonly ApiRoute[] {
  return [defineJsonRoute({
    method: 'POST', path: `${API_V1_BASE_PATH}/storefront/{shopSlug}/session`,
    authentication: 'public', inputSchema: createStorefrontSessionCommandSchema,
    outputSchema: createStorefrontSessionResultSchema,
    async handle(context, command) {
      try {
        const issued = await service.authenticate(context.params.shopSlug ?? '', command);
        return {
          status: 200,
          headers: {
            'Set-Cookie': serializeStorefrontSessionCookie(issued.opaqueToken, issued.maxAgeSeconds, cookiePolicy),
            'Cache-Control': 'no-store',
          },
          body: { session: issued.session },
        };
      } catch (error) {
        if (error instanceof StorefrontAuthenticationRejectedError) {
          throw new ApiHttpError({
            type: 'about:blank', title: 'Connexion impossible', status: 401,
            code: 'storefront.authentication_failed', detail: error.message,
          });
        }
        throw error;
      }
    },
  })];
}
