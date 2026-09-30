import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';
import { PostgresCommercialSettingsRepository } from '../../src/adapters/postgres/commercial-settings-repository.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import { CommercialSettingsService } from '../../src/modules/commercial-settings/application/commercial-settings-service.ts';
import { InMemoryIdempotencyStore } from '../../src/modules/_shared/application/index.ts';
import { createCommercialSettingsRoutes } from '../../src/server/api/commercial-settings-routes.ts';
import { createGescomApiHandler } from '../../src/server/api/gescom-middleware.ts';
import { LocalApiPrincipalVerifier } from '../../src/server/auth/local-api-principal-verifier.ts';
import { PostgresOidcIdentityDirectory } from '../../src/adapters/postgres/oidc-identity-directory.ts';

const integrationEnabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('PostgresCommercialSettingsRepository — PostgreSQL reel', () => {
  let pool: Pool;
  let repository: PostgresCommercialSettingsRepository;
  const tenantId = randomUUID() as TenantId;
  const adminId = randomUUID() as UserId;
  const memberId = randomUUID() as UserId;
  const identityId = randomUUID();
  const localSubject = `settings-session-${randomUUID()}`;

  beforeAll(async () => {
    pool = createPostgresPool();
    repository = new PostgresCommercialSettingsRepository(
      new PostgresTransactionRunner(pool, 'magrit_api'),
    );
    await pool.query(`
      insert into public.app_users (id, email_normalized, display_name)
      values ($1, $2, 'Settings Admin'), ($3, $4, 'Settings Member')
    `, [
      adminId, `settings-admin-${adminId}@example.invalid`,
      memberId, `settings-member-${memberId}@example.invalid`,
    ]);
    await pool.query(`
      insert into public.tenants (id, slug, name)
      values ($1, $2, 'Settings Integration')
    `, [tenantId, `settings-${tenantId}`]);
    await pool.query(`
      insert into public.tenant_members (tenant_id, user_id, role)
      values ($1, $2, 'admin'), ($1, $3, 'member')
    `, [tenantId, adminId, memberId]);
    await pool.query(`
      insert into public.user_identities (
        id, app_user_id, provider_type, provider_id, issuer, subject
      ) values ($1, $2, 'local', 'better-auth', 'urn:magrit:local', $3)
    `, [identityId, adminId, localSubject]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('delete from public.tenants where id = $1', [tenantId]);
    await pool.query('delete from public.app_users where id = any($1::uuid[])', [[adminId, memberId]]);
    await pool.end();
  });

  it('cree le singleton avec les defauts pour tout membre', async () => {
    await expect(repository.get(tenantId, memberId)).resolves.toMatchObject({
      tenant_id: tenantId,
      default_validity_days: 30,
      order_file_purge_enabled: false,
      notification_retention_days: 90,
      notification_sms_enabled: false,
      notification_sms_daily_cap: 200,
      order_file_purge_effective_from: null,
    });
  });

  it('accorde les capacites a l administrateur mais pas au membre simple', async () => {
    await expect(repository.actorHasCapability(
      tenantId, adminId, 'can_manage_pricing',
    )).resolves.toBe(true);
    await expect(repository.actorHasCapability(
      tenantId, memberId, 'can_manage_pricing',
    )).resolves.toBe(false);
    await expect(repository.actorHasCapability(
      tenantId, adminId, 'capability_inconnue',
    )).resolves.toBe(false);
  });

  it('applique les modifications admin et conserve le plancher sur true vers true', async () => {
    const activated = await repository.update(tenantId, adminId, {
      default_validity_days: 45,
      order_file_purge_enabled: true,
      notification_retention_days: 120,
    });
    expect(activated).toMatchObject({
      default_validity_days: 45,
      order_file_purge_enabled: true,
      notification_retention_days: 120,
    });
    expect(activated.order_file_purge_effective_from).toBeTruthy();

    const clickedAgain = await repository.update(tenantId, adminId, {
      order_file_purge_enabled: true,
    });
    expect(clickedAgain.order_file_purge_effective_from).toBe(
      activated.order_file_purge_effective_from,
    );
  });

  it('refuse en RLS une ecriture directe par un membre simple', async () => {
    await expect(repository.update(tenantId, memberId, {
      default_validity_days: 10,
    })).rejects.toThrow(/inaccessibles|interdite/i);
  });

  it('sert GET et PATCH via la facade Gescom et une session locale', async () => {
    const principalVerifier = new LocalApiPrincipalVerifier({
      identities: new PostgresOidcIdentityDirectory(pool),
      sessions: {
        async getSession() {
          return { user: { id: localSubject } };
        },
      },
    });
    const handle = createGescomApiHandler({
      routes: createCommercialSettingsRoutes(new CommercialSettingsService({ repository })),
      principalVerifier,
      idempotencyStore: new InMemoryIdempotencyStore(),
      requestIdFactory: () => 'settings-integration',
    });
    const headers = { cookie: 'better-auth.session_token=opaque', 'x-magrit-tenant': tenantId };

    const get = await handle(new Request('http://api.local/api/v1/commercial-settings', { headers }));
    expect(get.status).toBe(200);
    const etag = get.headers.get('etag');
    expect(etag).toBeTruthy();

    const patch = await handle(new Request('http://api.local/api/v1/commercial-settings', {
      method: 'PATCH',
      headers: { ...headers, 'content-type': 'application/json', 'if-match': etag! },
      body: JSON.stringify({ default_validity_days: 75 }),
    }));
    expect(patch.status).toBe(200);
    await expect(patch.json()).resolves.toMatchObject({
      data: { tenant_id: tenantId, default_validity_days: 75 },
      meta: { request_id: 'settings-integration' },
    });
  });
});
