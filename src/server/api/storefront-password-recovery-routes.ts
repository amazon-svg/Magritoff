import { requestStorefrontPasswordRecoveryCommandSchema, requestStorefrontPasswordRecoveryResultSchema, resetStorefrontPasswordCommandSchema, resetStorefrontPasswordResultSchema } from '../../modules/shop-customers/api/contracts.ts';
import { StorefrontPasswordResetRejectedError, type StorefrontPasswordRecoveryService } from '../../modules/shop-customers/application/storefront-password-recovery-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRoute } from './routes.ts';

export function createStorefrontPasswordRecoveryRoutes(service: StorefrontPasswordRecoveryService): readonly ApiRoute[] {
  return [
    defineJsonRoute({
      method: 'POST', path: `${API_V1_BASE_PATH}/storefront/{shopSlug}/password-recovery`, authentication: 'public',
      inputSchema: requestStorefrontPasswordRecoveryCommandSchema, outputSchema: requestStorefrontPasswordRecoveryResultSchema,
      async handle(context, command) {
        await service.request(context.params.shopSlug ?? '', command, publicAppBaseUrl(context.request));
        return { status: 202, headers: { 'Cache-Control': 'no-store' }, body: { accepted: true as const } };
      },
    }),
    defineJsonRoute({
      method: 'POST', path: `${API_V1_BASE_PATH}/storefront/password-reset`, authentication: 'public',
      inputSchema: resetStorefrontPasswordCommandSchema, outputSchema: resetStorefrontPasswordResultSchema,
      async handle(_context, command) {
        try {
          await service.reset(command);
          return { status: 200, headers: { 'Cache-Control': 'no-store' }, body: { reset: true as const } };
        } catch (error) {
          if (error instanceof StorefrontPasswordResetRejectedError) throw new ApiHttpError({ type: 'about:blank', title: 'Réinitialisation impossible', status: 400, code: 'storefront.password_reset_failed', detail: error.message });
          throw error;
        }
      },
    }),
  ];
}

function publicAppBaseUrl(request: Request): string {
  const origin = request.headers.get('origin');
  if (origin) try { const parsed = new URL(origin); if (['http:', 'https:'].includes(parsed.protocol)) return parsed.origin; } catch { /* repli */ }
  return new URL(request.url).origin;
}
