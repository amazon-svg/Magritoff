import { randomUUID } from 'node:crypto';
import { generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { OidcJwtVerifier } from '../../src/adapters/oidc/jwt-verifier.ts';
import { PostgresConversationsRepository } from '../../src/adapters/postgres/conversations-repository.ts';
import { PostgresOidcIdentityDirectory } from '../../src/adapters/postgres/oidc-identity-directory.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import { ConversationsService } from '../../src/modules/conversations/application/conversations-service.ts';
import { createApiV1Application } from '../../src/server/api/composition.ts';
import { createConversationsRoutes } from '../../src/server/api/conversations-routes.ts';
import { OidcActorResolver } from '../../src/server/auth/oidc-actor-resolver.ts';

const integrationEnabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;
const issuer = 'https://identity.integration.example';
const audience = 'magrit-integration';

describeIntegration('API Conversations — OIDC et PostgreSQL reels', () => {
  let pool: Pool;
  let handle: ReturnType<typeof createApiV1Application>;
  let token: string;
  const userId = randomUUID();
  const tenantId = randomUUID();
  const foreignTenantId = randomUUID();
  const identityId = randomUUID();
  const subject = `subject-${randomUUID()}`;
  const conversationId = `api-integration-${randomUUID()}`;

  beforeAll(async () => {
    pool = createPostgresPool();
    const pair = await generateKeyPair('RS256');
    const keyResolver: JWTVerifyGetKey = async () => pair.publicKey;
    const verifier = new OidcJwtVerifier({
      issuer,
      audience,
      jwksUrl: `${issuer}/jwks`,
      algorithms: ['RS256'],
    }, keyResolver);
    token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(pair.privateKey);

    await pool.query(`
      insert into public.app_users (id, email_normalized, display_name)
      values ($1, $2, 'OIDC Integration')
    `, [userId, `oidc-${userId}@example.invalid`]);
    await pool.query(`
      insert into public.user_identities (id, app_user_id, provider_type, provider_id, issuer, subject)
      values ($1, $2, 'oidc', 'integration', $3, $4)
    `, [identityId, userId, issuer, subject]);
    await pool.query(`
      insert into public.tenants (id, slug, name)
      values ($1, $2, 'OIDC Integration'), ($3, $4, 'Sans appartenance')
    `, [tenantId, `oidc-${tenantId}`, foreignTenantId, `foreign-${foreignTenantId}`]);
    await pool.query(`
      insert into public.tenant_members (tenant_id, user_id, role)
      values ($1, $2, 'member')
    `, [tenantId, userId]);

    const service = new ConversationsService(new PostgresConversationsRepository(
      new PostgresTransactionRunner(pool, 'magrit_api'),
    ));
    handle = createApiV1Application({
      actorResolver: new OidcActorResolver(
        verifier,
        new PostgresOidcIdentityDirectory(pool),
      ),
      routes: createConversationsRoutes(service),
      requestIdFactory: () => 'integration-request',
    });
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('delete from public.tenants where id = any($1::uuid[])', [[tenantId, foreignTenantId]]);
    await pool.query('delete from public.app_users where id = $1', [userId]);
    await pool.end();
  });

  it('traduit le sujet OIDC en acteur interne puis applique la RLS', async () => {
    const base = `http://api.local/api/v1/tenants/${tenantId}/conversations`;
    const save = await handle(new Request(`${base}/${conversationId}`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'OIDC vers RLS',
        timestamp: Date.parse('2026-09-29T14:00:00.000Z'),
        messages: [{ role: 'user', content: 'Bonjour' }],
        products: [],
      }),
    }));
    expect(save.status).toBe(200);

    const list = await handle(new Request(base, {
      headers: { authorization: `Bearer ${token}` },
    }));
    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toContainEqual(expect.objectContaining({
      id: conversationId,
      title: 'OIDC vers RLS',
    }));

    const forbidden = await handle(new Request(
      `http://api.local/api/v1/tenants/${foreignTenantId}/conversations`,
      { headers: { authorization: `Bearer ${token}` } },
    ));
    expect(forbidden.status).toBe(401);
  });

  it('interdit au role HTTP de modifier l annuaire d identite', async () => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('set local role "magrit_api"');
      await expect(client.query(
        'update public.app_users set display_name = $1 where id = $2',
        ['Compromis', userId],
      )).rejects.toMatchObject({ code: '42501' });
    } finally {
      await client.query('rollback');
      client.release();
    }
  });
});
