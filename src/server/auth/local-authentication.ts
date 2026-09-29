import { betterAuth } from 'better-auth';
import { PostgresDialect } from 'kysely';
import type { Pool } from 'pg';

export type LocalAuthenticationConfiguration = Readonly<{
  baseUrl: string;
  secret: string;
}>;

export function readLocalAuthenticationConfiguration(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): LocalAuthenticationConfiguration | null {
  const baseUrl = nonEmpty(environment['APP_BASE_URL']);
  const secret = nonEmpty(environment['MAGRIT_AUTH_SECRET']);
  if (baseUrl === null && secret === null) return null;
  if (baseUrl === null || secret === null) {
    throw new Error(`Configuration auth locale incomplete : ${baseUrl === null ? 'APP_BASE_URL' : 'MAGRIT_AUTH_SECRET'}`);
  }
  if (secret.length < 32) throw new Error('MAGRIT_AUTH_SECRET doit contenir au moins 32 caracteres.');

  const url = new URL(baseUrl);
  if (url.protocol !== 'https:' && !isLocalHttp(url)) {
    throw new Error('APP_BASE_URL doit utiliser HTTPS hors environnement local.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('APP_BASE_URL ne doit contenir ni identifiants, ni query, ni fragment.');
  }
  return Object.freeze({ baseUrl: url.href.replace(/\/$/, ''), secret });
}

/**
 * Frontiere Better Auth. Les tables de la bibliotheque restent dans `authn` ;
 * aucun module metier ne doit importer Better Auth ou referencer ce schema.
 * L'inscription publique reste fermee : les comptes seront crees depuis le
 * flux d'invitation Magrit.
 */
export function createLocalAuthentication(
  pool: Pool,
  configuration: LocalAuthenticationConfiguration,
) {
  const baseUrl = new URL(configuration.baseUrl);
  return betterAuth({
    appName: 'Magrit',
    baseURL: configuration.baseUrl,
    basePath: '/api/v1/auth',
    secret: configuration.secret,
    trustedOrigins: [baseUrl.origin],
    database: {
      dialect: new PostgresDialect({ pool }),
      type: 'postgres',
      schemaName: 'authn',
      transaction: true,
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
    },
    advanced: {
      cookiePrefix: 'magrit',
      useSecureCookies: baseUrl.protocol === 'https:',
      database: { joins: true },
    },
  });
}

function nonEmpty(value: string | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length === 0 ? null : normalized;
}

function isLocalHttp(url: URL): boolean {
  return url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname);
}
