import { createApiV1Application } from '../api/composition.ts';
import { createReadinessRoute } from '../api/readiness-route.ts';
import { createPostgresPool } from '../../adapters/postgres/pool.ts';
import { PostgresReadinessProbe } from '../../adapters/postgres/readiness-probe.ts';
import { createNodeHttpServer } from './http-server.ts';
import { createTransitionalApiHandler } from './transitional-api-handler.ts';

const host = process.env['MAGRIT_API_HOST'] ?? '127.0.0.1';
const port = parsePort(process.env['MAGRIT_API_PORT'] ?? '8787');
const postgresPool = createPostgresPool();
postgresPool.on('error', (error) => {
  console.error(JSON.stringify({ level: 'error', event: 'postgres.pool_error', error: error.message }));
});
const localHandler = createApiV1Application({
  routes: [createReadinessRoute(new PostgresReadinessProbe(postgresPool))],
  onUnexpectedError(error, requestId) {
    console.error(JSON.stringify({ level: 'error', event: 'api.unexpected_error', requestId, error: errorMessage(error) }));
  },
});
const legacyApiUrl = process.env['MAGRIT_LEGACY_API_URL'];
const handler = createTransitionalApiHandler({
  localHandler,
  localPaths: new Set(['/api/v1/health', '/api/v1/readiness']),
  ...(legacyApiUrl === undefined ? {} : { legacyApiUrl }),
});
const server = createNodeHttpServer(handler, {
  onUnhandledError(error) {
    console.error(JSON.stringify({ level: 'error', event: 'api.transport_error', error: errorMessage(error) }));
  },
});

server.listen(port, host, () => {
  console.info(JSON.stringify({
    level: 'info',
    event: 'api.started',
    address: `http://${host}:${port}`,
    mode: legacyApiUrl === undefined ? 'health-only' : 'transitional-proxy',
  }));
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(async (error) => {
      await postgresPool.end();
      if (error) {
        console.error(JSON.stringify({ level: 'error', event: 'api.shutdown_failed', error: error.message }));
        process.exitCode = 1;
      }
    });
  });
}

function parsePort(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error(`MAGRIT_API_PORT invalide : ${value}`);
  }
  return parsed;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
