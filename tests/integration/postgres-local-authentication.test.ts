import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import {
  developmentSeedConfiguration,
  seedDevelopmentIdentity,
} from '../../scripts/db/seed-development.mjs';
import { PostgresOidcIdentityDirectory } from '../../src/adapters/postgres/oidc-identity-directory.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
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
  });

  afterAll(async () => {
    if (!pool) return;
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
});
