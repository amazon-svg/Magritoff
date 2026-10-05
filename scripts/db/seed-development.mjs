import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { hashPassword } from 'better-auth/crypto';
import { databaseConfiguration } from './migrate.mjs';
import { readPimReference, seedPimReference } from './seed-pim.mjs';

const { Client } = pg;

const DEFAULTS = Object.freeze({
  userId: '10000000-0000-4000-8000-000000000001',
  identityId: '10000000-0000-4000-8000-000000000002',
  localIdentityId: '10000000-0000-4000-8000-000000000003',
  authAccountId: '10000000-0000-4000-8000-000000000004',
  tenantId: '20000000-0000-4000-8000-000000000001',
  email: 'developer@magrit.local',
  displayName: 'Developpeur Magrit',
  issuer: 'http://127.0.0.1:5556/dex',
  subject: '10000000-0000-4000-8000-000000000001',
  providerId: 'development-oidc',
  tenantSlug: 'magrit-development',
  tenantName: 'Magrit Development',
  role: 'owner',
  password: 'magrit-development-only',
});

export function developmentSeedConfiguration(environment = process.env) {
  const configuration = {
    userId: value(environment, 'MAGRIT_DEV_USER_ID', DEFAULTS.userId),
    identityId: value(environment, 'MAGRIT_DEV_IDENTITY_ID', DEFAULTS.identityId),
    localIdentityId: value(environment, 'MAGRIT_DEV_LOCAL_IDENTITY_ID', DEFAULTS.localIdentityId),
    authAccountId: value(environment, 'MAGRIT_DEV_AUTH_ACCOUNT_ID', DEFAULTS.authAccountId),
    tenantId: value(environment, 'MAGRIT_DEV_TENANT_ID', DEFAULTS.tenantId),
    email: value(environment, 'MAGRIT_DEV_USER_EMAIL', DEFAULTS.email).toLowerCase(),
    displayName: value(environment, 'MAGRIT_DEV_USER_DISPLAY_NAME', DEFAULTS.displayName),
    issuer: normalizedIssuer(value(environment, 'MAGRIT_DEV_OIDC_ISSUER', DEFAULTS.issuer)),
    subject: value(environment, 'MAGRIT_DEV_OIDC_SUBJECT', DEFAULTS.subject),
    providerId: value(environment, 'MAGRIT_DEV_OIDC_PROVIDER_ID', DEFAULTS.providerId),
    tenantSlug: value(environment, 'MAGRIT_DEV_TENANT_SLUG', DEFAULTS.tenantSlug),
    tenantName: value(environment, 'MAGRIT_DEV_TENANT_NAME', DEFAULTS.tenantName),
    role: value(environment, 'MAGRIT_DEV_TENANT_ROLE', DEFAULTS.role),
    password: value(environment, 'MAGRIT_DEV_USER_PASSWORD', DEFAULTS.password),
  };
  for (const key of ['userId', 'identityId', 'localIdentityId', 'authAccountId', 'tenantId']) {
    assertUuid(configuration[key], key);
  }
  if (!/^[^\s@]+@[^\s@]+$/.test(configuration.email)) throw new Error('Email de seed invalide.');
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(configuration.tenantSlug)) {
    throw new Error('Slug de tenant de seed invalide.');
  }
  if (!['owner', 'admin', 'member', 'partner'].includes(configuration.role)) {
    throw new Error('Role de tenant de seed invalide.');
  }
  if (configuration.password.length < 12 || configuration.password.length > 128) {
    throw new Error('Mot de passe du seed doit contenir entre 12 et 128 caracteres.');
  }
  return Object.freeze(configuration);
}

export async function seedDevelopmentIdentity(client, configuration) {
  await client.query('begin');
  try {
    await client.query("select pg_advisory_xact_lock(hashtext('magrit:development-seed'))");
    await client.query(`
      insert into public.app_users (id, email_normalized, display_name, status)
      values ($1, $2, $3, 'active')
      on conflict (id) do update set
        email_normalized = excluded.email_normalized,
        display_name = excluded.display_name,
        status = 'active',
        updated_at = now()
    `, [configuration.userId, configuration.email, configuration.displayName]);
    await client.query(`
      insert into public.tenants (id, slug, name)
      values ($1, $2, $3)
      on conflict (id) do update set
        slug = excluded.slug,
        name = excluded.name,
        updated_at = now()
    `, [configuration.tenantId, configuration.tenantSlug, configuration.tenantName]);
    await client.query(`
      insert into public.user_identities (
        id, app_user_id, provider_type, provider_id, issuer, subject
      ) values ($1, $2, 'oidc', $3, $4, $5)
      on conflict (issuer, subject) do nothing
    `, [
      configuration.identityId,
      configuration.userId,
      configuration.providerId,
      configuration.issuer,
      configuration.subject,
    ]);
    const identity = await client.query(`
      select app_user_id::text as app_user_id
      from public.user_identities
      where issuer = $1 and subject = $2
    `, [configuration.issuer, configuration.subject]);
    if (identity.rows[0]?.app_user_id !== configuration.userId) {
      throw new Error('Le sujet OIDC de developpement appartient deja a un autre utilisateur.');
    }
    await client.query(`
      insert into authn."user" (id, name, email, "emailVerified")
      values ($1, $2, $3, true)
      on conflict (id) do update set
        name = excluded.name,
        email = excluded.email,
        "emailVerified" = true,
        "updatedAt" = now()
    `, [configuration.userId, configuration.displayName, configuration.email]);
    const credential = await client.query(`
      select id from authn.account
      where "providerId" = 'credential' and "accountId" = $1 and "userId" = $1
    `, [configuration.userId]);
    if (credential.rows.length === 0) {
      await client.query(`
        insert into authn.account (
          id, "accountId", "providerId", "userId", password, "updatedAt"
        ) values ($1, $2, 'credential', $2, $3, now())
      `, [configuration.authAccountId, configuration.userId, await hashPassword(configuration.password)]);
    }
    await client.query(`
      insert into public.user_identities (
        id, app_user_id, provider_type, provider_id, issuer, subject
      ) values ($1, $2::uuid, 'local', 'better-auth', 'urn:magrit:local', $2::text)
      on conflict (issuer, subject) do nothing
    `, [configuration.localIdentityId, configuration.userId]);
    const localIdentity = await client.query(`
      select app_user_id::text as app_user_id
      from public.user_identities
      where issuer = 'urn:magrit:local' and subject = $1
    `, [configuration.userId]);
    if (localIdentity.rows[0]?.app_user_id !== configuration.userId) {
      throw new Error('Le compte local de developpement appartient deja a un autre utilisateur.');
    }
    await client.query(`
      insert into public.tenant_members (tenant_id, user_id, role)
      values ($1, $2, $3)
      on conflict (tenant_id, user_id) do update set role = excluded.role
    `, [configuration.tenantId, configuration.userId, configuration.role]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

async function main() {
  const configuration = developmentSeedConfiguration();
  const reference = await readPimReference();
  const client = new Client(databaseConfiguration());
  await client.connect();
  try {
    const pim = await seedPimReference(client, reference);
    process.stdout.write(`Referentiel PIM synchronise : ${pim.gammes} gammes.\n`);
    await seedDevelopmentIdentity(client, configuration);
    process.stdout.write(
      `Seed local pret : ${configuration.email}, tenant ${configuration.tenantSlug}, sujet ${configuration.subject}.\n`,
    );
  } finally {
    await client.end();
  }
}

function value(environment, key, fallback) {
  const candidate = environment[key]?.trim();
  return candidate ? candidate : fallback;
}

function normalizedIssuer(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) {
    throw new Error('Issuer OIDC du seed non securise.');
  }
  url.search = '';
  url.hash = '';
  return url.href.replace(/\/$/, '');
}

function assertUuid(value, name) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${name} du seed doit etre un UUID.`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
