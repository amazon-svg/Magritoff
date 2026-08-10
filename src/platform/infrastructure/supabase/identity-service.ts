import type { AuthError, SupabaseClient, User } from '@supabase/supabase-js';
import {
  appError,
  err,
  ok,
  parseId,
  systemClock,
  type Clock,
  type Result,
  type UserId,
} from '../../../kernel';
import type { Database } from '../../../types/database.types';
import type {
  AuthenticatedIdentity,
  IdentityError,
  IdentityService,
  IdentitySession,
  UserIdentity,
} from '../../identity';

type PlatformSupabaseClient = SupabaseClient<Database>;

function identityError(
  code: IdentityError['code'],
  message: string,
  retryable = false,
): IdentityError {
  return appError(code, message, retryable) as IdentityError;
}

function isNotFound(error: AuthError): boolean {
  return error.status === 404 || error.code === 'user_not_found';
}

function isInvalidToken(error: AuthError): boolean {
  return error.status === 401 || error.status === 403;
}

export class SupabaseIdentityService implements IdentityService {
  constructor(
    private readonly client: PlatformSupabaseClient,
    private readonly clock: Clock = systemClock,
  ) {}

  async verifyToken(
    token: string,
  ): Promise<Result<AuthenticatedIdentity, IdentityError>> {
    if (token.trim().length === 0) {
      return err(identityError('identity.invalid_token', 'The authentication token is invalid.'));
    }

    const { data, error } = await this.client.auth.getUser(token);
    if (error) {
      return err(
        isInvalidToken(error)
          ? identityError('identity.invalid_token', 'The authentication token is invalid.')
          : identityError(
              'identity.provider_unavailable',
              'The identity provider is temporarily unavailable.',
              true,
            ),
      );
    }
    if (!data.user) {
      return err(identityError('identity.not_authenticated', 'No authenticated identity was found.'));
    }

    const identity = this.mapUser(data.user);
    if (!identity.ok) return identity;

    return ok({
      identity: identity.value,
      authenticatedAt: this.clock.now().toISOString(),
    });
  }

  async getCurrentIdentity(
    session: IdentitySession,
  ): Promise<Result<UserIdentity, IdentityError>> {
    const authenticated = await this.verifyToken(session.accessToken);
    return authenticated.ok ? ok(authenticated.value.identity) : authenticated;
  }

  async getIdentity(
    userId: UserId,
  ): Promise<Result<UserIdentity | null, IdentityError>> {
    const { data, error } = await this.client.auth.admin.getUserById(userId);
    if (error) {
      if (isNotFound(error)) return ok(null);
      return err(
        identityError(
          'identity.provider_unavailable',
          'The identity provider is temporarily unavailable.',
          true,
        ),
      );
    }

    return this.mapUser(data.user);
  }

  private mapUser(user: User): Result<UserIdentity, IdentityError> {
    const parsedId = parseId<'UserId'>(user.id);
    if (!parsedId.ok) {
      return err(
        identityError(
          'identity.provider_unavailable',
          'The identity provider returned an invalid user identifier.',
          true,
        ),
      );
    }

    if (this.isDisabled(user)) {
      return err(identityError('identity.disabled', 'The user account is disabled.'));
    }

    const displayName = user.user_metadata.full_name;
    return ok({
      id: parsedId.value,
      status: 'active',
      ...(user.email ? { email: user.email } : {}),
      ...(typeof displayName === 'string' && displayName.trim().length > 0
        ? { displayName: displayName.trim() }
        : {}),
    });
  }

  private isDisabled(user: User): boolean {
    if (!user.banned_until) return false;
    const bannedUntil = Date.parse(user.banned_until);
    return Number.isNaN(bannedUntil) || bannedUntil > this.clock.now().getTime();
  }
}
