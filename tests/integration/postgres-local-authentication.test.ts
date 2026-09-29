import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import {
  developmentSeedConfiguration,
  seedDevelopmentIdentity,
} from '../../scripts/db/seed-development.mjs';
import { PostgresOidcIdentityDirectory } from '../../src/adapters/postgres/oidc-identity-directory.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresSessionBootstrapRepository } from '../../src/adapters/postgres/session-bootstrap-repository.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import { SessionPreferencesService } from '../../src/modules/session/application/session-service.ts';
import { createApiV1Application } from '../../src/server/api/composition.ts';
import { createSessionBootstrapRoute, createSessionPreferencesRoutes } from '../../src/server/api/session-routes.ts';
import { createLocalAuthentication } from '../../src/server/auth/local-authentication.ts';
import { LocalSessionActorResolver } from '../../src/server/auth/local-session-actor-resolver.ts';

const integrationEnabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('Better Auth local — PostgreSQL reel', () => {
  let pool: Pool;
  const seed = developmentSeedConfiguration({});
  const configuration = {
    baseUrl: 'http://127.0.0.1:5176',
    secret: 'integration-secret-with-at-least-32-characters',
  };

  beforeAll(async () => {
    pool = createPostgresPool();
    await seedDevelopmentIdentity(pool, seed);
    await pool.query('delete from public.user_preferences where user_id = $1', [seed.userId]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('delete from public.user_preferences where user_id = $1', [seed.userId]);
    await pool.query('delete from authn.session where "userId" = $1', [seed.userId]);
    await pool.end();
  });

  it('connecte le compte seed et le traduit en acteur Magrit', async () => {
    const authentication = createLocalAuthentication(pool, configuration);
    const response = await authentication.handler(new Request(
      `${configuration.baseUrl}/api/v1/auth/sign-in/email`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: configuration.baseUrl,
          'x-forwarded-for': '127.0.0.1',
        },
        body: JSON.stringify({ email: seed.email, password: seed.password }),
      },
    ));
    expect(response.status).toBe(200);
    const cookie = response.headers.get('set-cookie')?.split(';')[0];
    expect(cookie).toBeTruthy();

    const resolver = new LocalSessionActorResolver(
      authentication.api,
      new PostgresOidcIdentityDirectory(pool),
    );
    await expect(resolver.resolve(new Request('http://api.local', {
      headers: { cookie: cookie! },
    }), {
      requestId: 'integration-request' as never,
      params: { tenantId: seed.tenantId },
    })).resolves.toEqual({
      kind: 'user',
      userId: seed.userId,
      tenantId: seed.tenantId,
    });

    const sessionService = new SessionPreferencesService(
      new PostgresSessionBootstrapRepository(new PostgresTransactionRunner(pool, 'magrit_api')),
    );
    const application = createApiV1Application({
      actorResolver: resolver,
      routes: [
        createSessionBootstrapRoute(sessionService),
        ...createSessionPreferencesRoutes(sessionService),
      ],
      requestIdFactory: () => 'integration-request',
    });
    const bootstrap = await application(new Request('http://api.local/api/v1/session', {
      headers: { cookie: cookie! },
    }));
    expect(bootstrap.status).toBe(200);
    await expect(bootstrap.json()).resolves.toMatchObject({
      user: { id: seed.userId },
      tenants: [{
        id: seed.tenantId,
        slug: seed.tenantSlug,
        myRole: 'admin',
        permissions: { can_invite: true },
      }],
      preferences: { theme: 'light', language: 'fr' },
    });

    const preferences = await application(new Request(
      'http://api.local/api/v1/session/preferences',
      {
        method: 'PATCH',
        headers: { cookie: cookie!, 'content-type': 'application/json' },
        body: JSON.stringify({ theme: 'dark', notifications_email: false }),
      },
    ));
    expect(preferences.status).toBe(200);
    await expect(preferences.json()).resolves.toMatchObject({
      theme: 'dark',
      notifications_email: false,
      language: 'fr',
    });

    const currentTenant = await application(new Request(
      'http://api.local/api/v1/session/current-tenant',
      {
        method: 'PUT',
        headers: { cookie: cookie!, 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId: seed.tenantId }),
      },
    ));
    expect(currentTenant.status).toBe(200);
    await expect(currentTenant.json()).resolves.toMatchObject({ last_tenant_id: seed.tenantId });
  });

  it('maintient l inscription publique fermee', async () => {
    const authentication = createLocalAuthentication(pool, configuration);
    const response = await authentication.handler(new Request(
      `${configuration.baseUrl}/api/v1/auth/sign-up/email`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: configuration.baseUrl,
          'x-forwarded-for': '127.0.0.1',
        },
        body: JSON.stringify({
          name: 'Inscription interdite',
          email: 'public-signup@example.invalid',
          password: 'mot-de-passe-interdit',
        }),
      },
    ));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'EMAIL_PASSWORD_SIGN_UP_DISABLED',
    });
  });

  it('ne choisit aucun tenant arbitraire pour un utilisateur multi-tenant', async () => {
    const secondTenantId = randomUUID();
    await pool.query(`
      insert into public.tenants (id, slug, name) values ($1, $2, 'Second tenant')
    `, [secondTenantId, `second-${secondTenantId}`]);
    await pool.query(`
      insert into public.tenant_members (tenant_id, user_id, role)
      values ($1, $2, 'member')
    `, [secondTenantId, seed.userId]);
    try {
      const directory = new PostgresOidcIdentityDirectory(pool);
      await expect(directory.resolve({
        issuer: 'urn:magrit:local',
        subject: seed.userId,
      })).resolves.toEqual({ userId: seed.userId });
      await expect(directory.resolve({
        issuer: 'urn:magrit:local',
        subject: seed.userId,
      }, secondTenantId)).resolves.toEqual({ userId: seed.userId, tenantId: secondTenantId });
    } finally {
      await pool.query('delete from public.tenants where id = $1', [secondTenantId]);
    }
  });
});
