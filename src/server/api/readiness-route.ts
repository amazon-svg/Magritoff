import { z } from 'zod';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { defineJsonRoute, type ApiRoute } from './routes.ts';

export interface ReadinessProbe {
  check(): Promise<void>;
}

export const readinessResponseSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  checks: z.object({ postgres: z.enum(['ready', 'unavailable']) }),
});

export function createReadinessRoute(postgres: ReadinessProbe): ApiRoute {
  return defineJsonRoute({
    method: 'GET',
    path: `${API_V1_BASE_PATH}/readiness`,
    authentication: 'public',
    inputSchema: null,
    outputSchema: readinessResponseSchema,
    async handle() {
      try {
        await postgres.check();
        return { status: 200, body: { status: 'ready' as const, checks: { postgres: 'ready' as const } } };
      } catch {
        return {
          status: 503,
          body: { status: 'not_ready' as const, checks: { postgres: 'unavailable' as const } },
          headers: { 'Retry-After': '5' },
        };
      }
    },
  });
}
