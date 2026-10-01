import { createHash, randomUUID } from 'node:crypto';
import { APIError, betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { PostgresDialect } from 'kysely';
import type { Pool } from 'pg';
import type { PasswordResetEmailSender } from '../../modules/account/application/password-reset-email-sender.ts';
import { TRUSTED_CLIENT_IP_HEADER } from './client-ip.ts';

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
  passwordResetEmailSender: PasswordResetEmailSender = disabledPasswordResetEmailSender,
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
      disableSignUp: false,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      async sendResetPassword({ user, url }) {
        const delivery = await passwordResetEmailSender.send({
          to: user.email,
          displayName: user.name,
          link: url,
        });
        if (!delivery.sent) {
          throw new Error(delivery.reason ?? 'Envoi du courriel de réinitialisation impossible.');
        }
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
    },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (context.path !== '/sign-up/email') return;
        const body = context.body as Record<string, unknown> | undefined;
        const invitationToken = typeof body?.['invitationToken'] === 'string'
          ? body['invitationToken']
          : '';
        const email = typeof body?.['email'] === 'string' ? body['email'].toLowerCase().trim() : '';
        const allowed = invitationToken.length >= 32
          && await isValidInvitationRegistration(pool, invitationToken, email);
        if (!allowed) {
          throw new APIError('FORBIDDEN', {
            code: 'INVITATION_REQUIRED',
            message: 'Une invitation Magrit valide est requise pour créer ce compte.',
          });
        }
        delete body!['invitationToken'];
      }),
    },
    advanced: {
      cookiePrefix: 'magrit',
      useSecureCookies: baseUrl.protocol === 'https:',
      ipAddress: { ipAddressHeaders: [TRUSTED_CLIENT_IP_HEADER] },
      database: { joins: true, generateId: () => randomUUID() },
    },
  });
}

const disabledPasswordResetEmailSender: PasswordResetEmailSender = Object.freeze({
  async send() { return { sent: false, reason: 'Aucun transport email configuré' }; },
});

async function isValidInvitationRegistration(
  pool: Pool,
  token: string,
  email: string,
): Promise<boolean> {
  const result = await pool.query<{ allowed: boolean }>(`
    select exists (
      select 1 from public.tenant_invitations
       where token_hash=$1 and email=$2
         and accepted_at is null and expires_at > clock_timestamp()
    ) as allowed
  `, [createHash('sha256').update(token, 'utf8').digest('hex'), email]);
  return result.rows[0]?.allowed === true;
}

function nonEmpty(value: string | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length === 0 ? null : normalized;
}

function isLocalHttp(url: URL): boolean {
  return url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname);
}
