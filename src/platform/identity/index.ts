import type { AppError, Result, UserId } from '../../kernel';

export type IdentitySession = Readonly<{
  accessToken: string;
}>;

export type UserIdentity = Readonly<{
  id: UserId;
  email?: string;
  displayName?: string;
  status: 'active' | 'disabled';
}>;

export type AuthenticatedIdentity = Readonly<{
  identity: UserIdentity;
  authenticatedAt: string;
}>;

export type IdentityErrorCode =
  | 'identity.invalid_token'
  | 'identity.session_expired'
  | 'identity.not_authenticated'
  | 'identity.disabled'
  | 'identity.provider_unavailable';

export type IdentityError = AppError & Readonly<{
  code: IdentityErrorCode;
}>;

export interface IdentityService {
  verifyToken(token: string): Promise<Result<AuthenticatedIdentity, IdentityError>>;
  getCurrentIdentity(session: IdentitySession): Promise<Result<UserIdentity, IdentityError>>;
  getIdentity(userId: UserId): Promise<Result<UserIdentity | null, IdentityError>>;
}
