import { createStorefrontRegistrationCommandSchema, createStorefrontRegistrationResultSchema, createStorefrontSessionCommandSchema, createStorefrontSessionResultSchema, endStorefrontSessionResultSchema } from '../../modules/shop-customers/api/contracts.ts';
import { StorefrontAuthenticationRejectedError, type StorefrontAuthenticationService } from '../../modules/shop-customers/application/storefront-authentication-service.ts';
import { StorefrontRegistrationRejectedError, type StorefrontRegistrationService } from '../../modules/shop-customers/application/storefront-registration-service.ts';
import type { StorefrontSessionService } from '../../modules/shop-customers/application/storefront-session-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { clearStorefrontSessionCookie, readStorefrontSessionCookie, serializeStorefrontSessionCookie, type StorefrontSessionCookiePolicy } from '../storefront/session-cookie.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRoute } from './routes.ts';

export function createStorefrontSessionRoutes(
  service: StorefrontAuthenticationService,
  registrations: StorefrontRegistrationService,
  sessions: StorefrontSessionService,
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
  }), defineJsonRoute({
    method: 'POST', path: `${API_V1_BASE_PATH}/storefront/{shopSlug}/registration`,
    authentication: 'public', inputSchema: createStorefrontRegistrationCommandSchema,
    outputSchema: createStorefrontRegistrationResultSchema,
    async handle(context, command) {
      try {
        const issued = await registrations.register(context.params.shopSlug ?? '', command);
        return {
          status: 201,
          headers: {
            'Set-Cookie': serializeStorefrontSessionCookie(issued.opaqueToken, issued.maxAgeSeconds, cookiePolicy),
            'Cache-Control': 'no-store',
          },
          body: { session: issued.session },
        };
      } catch (error) {
        if (error instanceof StorefrontRegistrationRejectedError) {
          throw new ApiHttpError({
            type: 'about:blank', title: 'Inscription impossible', status: 409,
            code: 'storefront.registration_failed', detail: error.message,
          });
        }
        throw error;
      }
    },
  }), defineJsonRoute({
    method: 'GET', path: `${API_V1_BASE_PATH}/storefront/session/current`, authentication: 'public',
    inputSchema: null, outputSchema: createStorefrontSessionResultSchema,
    async handle(context) {
      const token = readStorefrontSessionCookie(context.request.headers.get('cookie'), cookiePolicy);
      const session = token ? await sessions.current(token) : null;
      if (!session) throw new ApiHttpError({ type: 'about:blank', title: 'Session storefront requise', status: 401, code: 'storefront.session_required' });
      return { status: 200, headers: { 'Cache-Control': 'no-store' }, body: { session } };
    },
  }), defineJsonRoute({
    method: 'DELETE', path: `${API_V1_BASE_PATH}/storefront/session/current`, authentication: 'public',
    inputSchema: null, outputSchema: endStorefrontSessionResultSchema,
    async handle(context) {
      const token = readStorefrontSessionCookie(context.request.headers.get('cookie'), cookiePolicy);
      if (token) await sessions.end(token);
      return { status: 200, headers: { 'Set-Cookie': clearStorefrontSessionCookie(cookiePolicy), 'Cache-Control': 'no-store' }, body: { ended: true as const } };
    },
  })];
}
