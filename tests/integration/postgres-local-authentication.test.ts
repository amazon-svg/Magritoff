import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
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
import { SessionTenantMutationError } from '../../src/modules/session/application/session-repository.ts';
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
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVITATION_REQUIRED',
    });
  });

  it('provisionne un compte local uniquement depuis une invitation valide', async () => {
    const authentication = createLocalAuthentication(pool, configuration);
    const token = `${randomUUID()}${randomUUID()}`.replaceAll('-', '');
    const email = `invited-${randomUUID()}@example.invalid`;
    const invitationId = randomUUID();
    let userId: string | null = null;
    await pool.query(`
      insert into public.tenant_invitations (
        id,tenant_id,email,role,token_hash,expires_at,invited_by
      ) values ($1,$2,$3,'member',$4,clock_timestamp()+interval '1 day',$5)
    `, [
      invitationId, seed.tenantId, email,
      createHash('sha256').update(token, 'utf8').digest('hex'), seed.userId,
    ]);
    try {
      const wrongEmail = await authentication.handler(new Request(
        `${configuration.baseUrl}/api/v1/auth/sign-up/email`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: configuration.baseUrl,
            'x-forwarded-for': '127.0.0.1',
          },
          body: JSON.stringify({
            name: 'Mauvais compte', email: 'wrong@example.invalid',
            password: 'mot-de-passe-invite', invitationToken: token,
          }),
        },
      ));
      expect(wrongEmail.status).toBe(403);

      const signUp = await authentication.handler(new Request(
        `${configuration.baseUrl}/api/v1/auth/sign-up/email`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: configuration.baseUrl,
            'x-forwarded-for': '127.0.0.1',
          },
          body: JSON.stringify({
            name: 'Compte invité', email, password: 'mot-de-passe-invite', invitationToken: token,
          }),
        },
      ));
      expect(signUp.status).toBe(200);
      const provisioned = await pool.query<{
        user_id: string;
        email_verified: boolean;
        identity_count: string;
      }>(`
        select auth_user.id as user_id,auth_user."emailVerified" as email_verified,
               count(identity.id)::text as identity_count
          from authn."user" auth_user
          join public.app_users app_user on app_user.id::text=auth_user.id
          left join public.user_identities identity
            on identity.app_user_id=app_user.id
           and identity.issuer='urn:magrit:local'
           and identity.subject=auth_user.id
         where auth_user.email=$1
         group by auth_user.id,auth_user."emailVerified"
      `, [email]);
      userId = provisioned.rows[0]?.user_id ?? null;
      expect(provisioned.rows[0]).toMatchObject({ email_verified: true, identity_count: '1' });
      expect(userId).toMatch(/^[0-9a-f-]{36}$/);

      const signIn = await authentication.handler(new Request(
        `${configuration.baseUrl}/api/v1/auth/sign-in/email`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: configuration.baseUrl,
            'x-forwarded-for': '127.0.0.1',
          },
          body: JSON.stringify({ email, password: 'mot-de-passe-invite' }),
        },
      ));
      expect(signIn.status).toBe(200);
      expect(signIn.headers.get('set-cookie')).toContain('magrit.session_token=');

      const sessions = new PostgresSessionBootstrapRepository(
        new PostgresTransactionRunner(pool, 'magrit_api'),
      );
      await expect(sessions.acceptInvitation(userId as never, token)).resolves.toBe(seed.tenantId);
      const directory = new PostgresOidcIdentityDirectory(pool);
      await expect(directory.resolve({ issuer: 'urn:magrit:local', subject: userId! }, seed.tenantId))
        .resolves.toEqual({ userId, tenantId: seed.tenantId });
    } finally {
      if (userId !== null) {
        await pool.query('delete from authn."user" where id=$1', [userId]);
        await pool.query('delete from public.app_users where id=$1', [userId]);
      }
      await pool.query('delete from public.tenant_invitations where id=$1', [invitationId]);
    }
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

  it('protege le slug et conserve son historique pendant les mutations tenant', async () => {
    const repository = new PostgresSessionBootstrapRepository(
      new PostgresTransactionRunner(pool, 'magrit_api'),
    );
    const original = await pool.query<{ name: string; slug: string }>(
      'select name, slug from public.tenants where id = $1',
      [seed.tenantId],
    );
    const originalTenant = original.rows[0];
    expect(originalTenant).toBeDefined();
    const nextSlug = `migration-${randomUUID().slice(0, 8)}`;

    await pool.query(`
      insert into public.user_preferences (user_id, is_admin)
      values ($1, false)
      on conflict (user_id) do update set is_admin = false
    `, [seed.userId]);

    try {
      await repository.updateTenantSettings(seed.userId as never, seed.tenantId, {
        name: 'Atelier PostgreSQL',
      });
      await expect(pool.query(
        'select name from public.tenants where id = $1',
        [seed.tenantId],
      )).resolves.toMatchObject({ rows: [{ name: 'Atelier PostgreSQL' }] });

      await expect(repository.updateTenantSettings(seed.userId as never, seed.tenantId, {
        slug: nextSlug,
      })).rejects.toMatchObject<Partial<SessionTenantMutationError>>({ code: 'permission_denied' });

      await pool.query(
        'update public.user_preferences set is_admin = true where user_id = $1',
        [seed.userId],
      );
      await repository.updateTenantSettings(seed.userId as never, seed.tenantId, {
        slug: nextSlug,
      });
      await expect(repository.resolveTenantSlug(seed.userId as never, originalTenant!.slug))
        .resolves.toBe(nextSlug);
    } finally {
      await pool.query(
        'update public.tenants set name = $2, slug = $3 where id = $1',
        [seed.tenantId, originalTenant!.name, originalTenant!.slug],
      );
      await pool.query(
        'update public.user_preferences set is_admin = false where user_id = $1',
        [seed.userId],
      );
    }
  });

  it('borne les privileges SQL de mutation et d historique', async () => {
    const privileges = await pool.query<{
      api_can_update_tenants: boolean;
      api_can_call_mutation: boolean;
      readonly_can_read_history: boolean;
      api_can_insert_tenants: boolean;
      api_can_call_creation: boolean;
      api_can_read_gammes: boolean;
    }>(`
      select
        has_table_privilege('magrit_api', 'public.tenants', 'UPDATE')
          as api_can_update_tenants,
        has_function_privilege(
          'magrit_api',
          'magrit.update_tenant_settings(uuid,text,text,text)',
          'EXECUTE'
        ) as api_can_call_mutation,
        has_table_privilege('magrit_readonly', 'public.tenant_slug_history', 'SELECT')
          as readonly_can_read_history,
        has_table_privilege('magrit_api', 'public.tenants', 'INSERT')
          as api_can_insert_tenants,
        has_function_privilege(
          'magrit_api',
          'magrit.create_root_tenant(text,text,text,jsonb,text[])',
          'EXECUTE'
        ) as api_can_call_creation,
        has_table_privilege('magrit_api', 'public.tenant_gamme_subscriptions', 'SELECT')
          as api_can_read_gammes
    `);

    expect(privileges.rows[0]).toEqual({
      api_can_update_tenants: false,
      api_can_call_mutation: true,
      readonly_can_read_history: false,
      api_can_insert_tenants: false,
      api_can_call_creation: true,
      api_can_read_gammes: true,
    });
  });

  it('cree atomiquement un tenant racine avec son onboarding', async () => {
    const repository = new PostgresSessionBootstrapRepository(
      new PostgresTransactionRunner(pool, 'magrit_api'),
    );
    const suffix = randomUUID().slice(0, 8);
    const slug = `onboarding-${suffix}`;
    const siren = `test-${suffix}`;
    let tenantId: string | null = null;

    try {
      tenantId = await repository.createRootTenant(seed.userId as never, {
        slug,
        name: 'Tenant onboarding PostgreSQL',
        siren,
        sirenData: { denomination: 'Tenant onboarding PostgreSQL SAS' },
        gammeSlugs: ['flyers', 'brochures', 'flyers'],
      });

      const tenant = await pool.query(`
        select t.slug, t.name, t.plan, t.siren, t.siren_data, t.verified,
               t.verified_at is not null as has_verified_at,
               m.role,
               p.last_tenant_id::text
          from public.tenants t
          join public.tenant_members m
            on m.tenant_id = t.id and m.user_id = $2
          join public.user_preferences p on p.user_id = $2
         where t.id = $1
      `, [tenantId, seed.userId]);
      expect(tenant.rows[0]).toMatchObject({
        slug,
        name: 'Tenant onboarding PostgreSQL',
        plan: 'freemium',
        siren,
        siren_data: { denomination: 'Tenant onboarding PostgreSQL SAS' },
        verified: true,
        has_verified_at: true,
        role: 'admin',
        last_tenant_id: tenantId,
      });

      const gammes = await pool.query<{ gamme_slug: string }>(`
        select gamme_slug
          from public.tenant_gamme_subscriptions
         where tenant_id = $1
         order by gamme_slug
      `, [tenantId]);
      expect(gammes.rows.map(({ gamme_slug }) => gamme_slug))
        .toEqual(['brochures', 'flyers']);
    } finally {
      if (tenantId !== null) {
        await pool.query('delete from public.tenants where id = $1', [tenantId]);
      }
      await pool.query(`
        update public.user_preferences
           set last_tenant_id = $2
         where user_id = $1
      `, [seed.userId, seed.tenantId]);
    }
  });

  it('refuse les tenants dont les invariants metier sont incomplets', async () => {
    const suffix = randomUUID().slice(0, 8);
    await expect(pool.query(`
      insert into public.tenants (slug, name, siren)
      values ($1, 'Tenant SIREN incomplet', $2)
    `, [`invalid-siren-${suffix}`, `test-${suffix}`]))
      .rejects.toMatchObject({ code: '23514' });

    await expect(pool.query(`
      insert into public.tenants (slug, name, plan)
      values ($1, 'Tenant plan invalide', 'illimite')
    `, [`invalid-plan-${suffix}`]))
      .rejects.toMatchObject({ code: '23514' });
  });

  it('cree et supprime un sous-espace sans autoriser un troisieme niveau', async () => {
    const repository = new PostgresSessionBootstrapRepository(
      new PostgresTransactionRunner(pool, 'magrit_api'),
    );
    const suffix = randomUUID().slice(0, 8);
    let subTenantId: string | null = null;

    try {
      subTenantId = await repository.createSubTenant(
        seed.userId as never,
        seed.tenantId,
        { slug: `filiale-${suffix}`, name: 'Filiale PostgreSQL' },
      );
      const membership = await pool.query(`
        select t.parent_tenant_id::text, t.plan, m.role
          from public.tenants t
          join public.tenant_members m
            on m.tenant_id = t.id and m.user_id = $2
         where t.id = $1
      `, [subTenantId, seed.userId]);
      expect(membership.rows[0]).toEqual({
        parent_tenant_id: seed.tenantId,
        plan: 'freemium',
        role: 'admin',
      });

      await expect(repository.createSubTenant(
        seed.userId as never,
        subTenantId,
        { slug: `niveau-trois-${suffix}`, name: 'Niveau trois interdit' },
      )).rejects.toMatchObject<Partial<SessionTenantMutationError>>({
        code: 'permission_denied',
      });

      await repository.removeSubTenant(seed.userId as never, seed.tenantId, subTenantId);
      await expect(repository.removeSubTenant(seed.userId as never, seed.tenantId, subTenantId))
        .rejects.toMatchObject<Partial<SessionTenantMutationError>>({ code: 'not_found' });
      subTenantId = null;
    } finally {
      if (subTenantId !== null) {
        await pool.query('delete from public.tenants where id = $1', [subTenantId]);
      }
    }
  });
});
