import { createApiV1Application } from '../api/composition.ts';
import { createCommercialSettingsRoutes } from '../api/commercial-settings-routes.ts';
import { createGescomApiHandler } from '../api/gescom-middleware.ts';
import { createConversationsRoutes } from '../api/conversations-routes.ts';
import { createProductionStepsRoutes } from '../api/production-steps-routes.ts';
import { createReadinessRoute } from '../api/readiness-route.ts';
import {
  createSessionBootstrapRoute,
  createSessionPreferencesRoutes,
  createSessionSubTenantMutationRoutes,
  createSessionTenantCreationRoute,
  createSessionTenantSettingsRoutes,
} from '../api/session-routes.ts';
import { OidcJwtVerifier } from '../../adapters/oidc/jwt-verifier.ts';
import { PostgresCommercialSettingsRepository } from '../../adapters/postgres/commercial-settings-repository.ts';
import { PostgresConversationsRepository } from '../../adapters/postgres/conversations-repository.ts';
import { PostgresIdempotencyStore } from '../../adapters/postgres/idempotency-store.ts';
import { PostgresOidcIdentityDirectory } from '../../adapters/postgres/oidc-identity-directory.ts';
import { createPostgresPool } from '../../adapters/postgres/pool.ts';
import { PostgresProductionStepsRepository } from '../../adapters/postgres/production-steps-repository.ts';
import { PostgresReadinessProbe } from '../../adapters/postgres/readiness-probe.ts';
import { PostgresSessionBootstrapRepository } from '../../adapters/postgres/session-bootstrap-repository.ts';
import { PostgresTransactionRunner } from '../../adapters/postgres/transaction-runner.ts';
import { ConversationsService } from '../../modules/conversations/application/conversations-service.ts';
import { CommercialSettingsService } from '../../modules/commercial-settings/application/commercial-settings-service.ts';
import { ProductionStepsService } from '../../modules/production-steps/application/production-steps-service.ts';
import { SessionSubTenantMutationService } from '../../modules/session/application/session-service.ts';
import { createLocalAuthentication, readLocalAuthenticationConfiguration } from '../auth/local-authentication.ts';
import { CredentialActorResolver, LocalSessionActorResolver } from '../auth/local-session-actor-resolver.ts';
import { LocalApiPrincipalVerifier } from '../auth/local-api-principal-verifier.ts';
import { OidcActorResolver } from '../auth/oidc-actor-resolver.ts';
import { createNodeHttpServer } from './http-server.ts';
import { readOidcConfiguration } from './oidc-configuration.ts';
import { createTransitionalApiHandler } from './transitional-api-handler.ts';

const host = process.env['MAGRIT_API_HOST'] ?? '127.0.0.1';
const port = parsePort(process.env['MAGRIT_API_PORT'] ?? '8787');
const postgresPool = createPostgresPool();
postgresPool.on('error', (error) => {
  console.error(JSON.stringify({ level: 'error', event: 'postgres.pool_error', error: error.message }));
});
const oidcConfiguration = readOidcConfiguration();
const localAuthenticationConfiguration = readLocalAuthenticationConfiguration();
const localAuthentication = localAuthenticationConfiguration === null
  ? null
  : createLocalAuthentication(postgresPool, localAuthenticationConfiguration);
const identityDirectory = new PostgresOidcIdentityDirectory(postgresPool);
const oidcJwtVerifier = oidcConfiguration === null
  ? null
  : new OidcJwtVerifier(oidcConfiguration);
const oidcActorResolver = oidcConfiguration === null
  ? null
  : new OidcActorResolver(oidcJwtVerifier!, identityDirectory);
const localSessionActorResolver = localAuthentication === null
  ? null
  : new LocalSessionActorResolver(localAuthentication.api, identityDirectory);
const actorResolver = oidcActorResolver === null && localSessionActorResolver === null
  ? undefined
  : new CredentialActorResolver(oidcActorResolver, localSessionActorResolver);
const conversationsEnabled = actorResolver !== undefined;
const conversationsRoutes = conversationsEnabled
  ? createConversationsRoutes(new ConversationsService(new PostgresConversationsRepository(
      new PostgresTransactionRunner(postgresPool, 'magrit_api'),
    )))
  : [];
const sessionEnabled = actorResolver !== undefined;
const sessionRepository = new PostgresSessionBootstrapRepository(
  new PostgresTransactionRunner(postgresPool, 'magrit_api'),
);
const sessionService = new SessionSubTenantMutationService(sessionRepository);
const sessionRoutes = sessionEnabled
  ? [
      createSessionBootstrapRoute(sessionService),
      ...createSessionPreferencesRoutes(sessionService),
      ...createSessionTenantSettingsRoutes(sessionService),
      createSessionTenantCreationRoute(sessionService),
      ...createSessionSubTenantMutationRoutes(sessionService),
    ]
  : [];
const gescomPrincipalVerifier = oidcJwtVerifier === null && localAuthentication === null
  ? null
  : new LocalApiPrincipalVerifier({
      identities: identityDirectory,
      ...(oidcJwtVerifier === null ? {} : { oidc: oidcJwtVerifier }),
      ...(localAuthentication === null ? {} : { sessions: localAuthentication.api }),
    });
const commercialSettingsRoutes = gescomPrincipalVerifier === null
  ? []
  : createCommercialSettingsRoutes(new CommercialSettingsService({
      repository: new PostgresCommercialSettingsRepository(
        new PostgresTransactionRunner(postgresPool, 'magrit_api'),
      ),
    }));
const productionStepsRoutes = gescomPrincipalVerifier === null
  ? []
  : createProductionStepsRoutes(new ProductionStepsService({
      repository: new PostgresProductionStepsRepository(
        new PostgresTransactionRunner(postgresPool, 'magrit_api'),
      ),
    }));
const gescomHandler = gescomPrincipalVerifier === null
  ? null
  : createGescomApiHandler({
      routes: [...commercialSettingsRoutes, ...productionStepsRoutes],
      principalVerifier: gescomPrincipalVerifier,
      idempotencyStore: new PostgresIdempotencyStore(
        new PostgresTransactionRunner(postgresPool, 'magrit_api'),
      ),
      onUnexpectedError(error, requestId) {
        console.error(JSON.stringify({ level: 'error', event: 'gescom.unexpected_error', requestId, error: errorMessage(error) }));
      },
    });
const apiHandler = createApiV1Application({
  routes: [
    createReadinessRoute(new PostgresReadinessProbe(postgresPool)),
    ...conversationsRoutes,
    ...sessionRoutes,
  ],
  ...(actorResolver === undefined ? {} : { actorResolver }),
  onUnexpectedError(error, requestId) {
    console.error(JSON.stringify({ level: 'error', event: 'api.unexpected_error', requestId, error: errorMessage(error) }));
  },
});
const localHandler = localAuthentication === null
  ? (request: Request) => isLocalGescomPath(new URL(request.url).pathname) && gescomHandler !== null
      ? gescomHandler(request)
      : apiHandler(request)
  : (request: Request) => {
      const pathname = new URL(request.url).pathname;
      if (isLocalAuthenticationPath(pathname)) return localAuthentication.handler(request);
      if (isLocalGescomPath(pathname) && gescomHandler !== null) {
        return gescomHandler(request);
      }
      return apiHandler(request);
    };
const legacyApiUrl = process.env['MAGRIT_LEGACY_API_URL'];
const handler = createTransitionalApiHandler({
  localHandler,
  localPaths: new Set(['/api/v1/health', '/api/v1/readiness']),
  isLocalRequest: (request, url) => (
    (conversationsEnabled && isConversationsPath(url.pathname))
    || (localAuthentication !== null && isLocalAuthenticationPath(url.pathname))
    || (sessionEnabled && isSessionPreferencesRequest(request.method, url.pathname))
    || (sessionEnabled && isSessionTenantSettingsRequest(request.method, url.pathname))
    || (sessionEnabled && request.method === 'POST' && url.pathname === '/api/v1/tenants')
    || (sessionEnabled && isSubTenantMutationRequest(request.method, url.pathname))
    || (gescomHandler !== null && isLocalGescomPath(url.pathname))
  ),
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
    modules: [
      ...(conversationsEnabled ? ['conversations'] : []),
      ...(localAuthentication === null ? [] : ['local-authentication']),
      ...(sessionEnabled ? ['session-bootstrap'] : []),
      ...(gescomHandler === null ? [] : ['commercial-settings']),
      ...(gescomHandler === null ? [] : ['production-steps']),
    ],
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

function isConversationsPath(pathname: string): boolean {
  return /^\/api\/v1\/tenants\/[^/]+\/conversations(?:\/[^/]+)?\/?$/.test(pathname);
}

function isLocalAuthenticationPath(pathname: string): boolean {
  return pathname === '/api/v1/auth' || pathname.startsWith('/api/v1/auth/');
}

function isCommercialSettingsPath(pathname: string): boolean {
  return pathname === '/api/v1/commercial-settings';
}

function isLocalGescomPath(pathname: string): boolean {
  return isCommercialSettingsPath(pathname)
    || /^\/api\/v1\/production-steps(?:\/[^/]+)?\/?$/.test(pathname)
    || pathname === '/api/v1/production-step-positions';
}

function isSessionPreferencesRequest(method: string, pathname: string): boolean {
  return (method === 'GET' && pathname === '/api/v1/session')
    || (method === 'PATCH' && pathname === '/api/v1/session/preferences')
    || (method === 'PUT' && pathname === '/api/v1/session/current-tenant');
}

function isSessionTenantSettingsRequest(method: string, pathname: string): boolean {
  return (method === 'GET' && /^\/api\/v1\/tenant-slugs\/[^/]+\/?$/.test(pathname))
    || (method === 'PATCH' && /^\/api\/v1\/tenants\/[^/]+\/?$/.test(pathname));
}

function isSubTenantMutationRequest(method: string, pathname: string): boolean {
  return (method === 'POST' && /^\/api\/v1\/tenants\/[^/]+\/subtenants\/?$/.test(pathname))
    || (method === 'DELETE'
      && /^\/api\/v1\/tenants\/[^/]+\/subtenants\/[^/]+\/?$/.test(pathname));
}
