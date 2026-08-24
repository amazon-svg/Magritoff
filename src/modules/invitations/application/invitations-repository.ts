import type { UserId } from '../../../kernel/ids/index.ts';
import type {
  CreateInvitationCommand,
  CreateInvitationResult,
  InvitationActivation,
  InvitationOptions,
  PendingInvitation,
  ResendInvitationResult,
} from '../api/contracts.ts';

export type InvitationRejectionCode =
  | 'authentication_required'
  | 'permission_denied'
  | 'already_member'
  | 'duplicate_pending'
  | 'role_mismatch_tenant'
  | 'invalid_request'
  | 'delivery_failed';

export class InvitationRejectedError extends Error {
  constructor(
    public readonly code: InvitationRejectionCode,
    message: string,
  ) {
    super(message);
    this.name = 'InvitationRejectedError';
  }
}

export interface InvitationsRepository {
  activation(token: string): Promise<InvitationActivation>;
  create(
    actorUserId: UserId,
    command: CreateInvitationCommand,
  ): Promise<CreateInvitationResult>;
  options(actorUserId: UserId, tenantId: string): Promise<InvitationOptions>;
  pending(actorUserId: UserId, tenantId: string): Promise<PendingInvitation[]>;
  resend(actorUserId: UserId, invitationId: string, baseUrl: string): Promise<ResendInvitationResult>;
  revoke(actorUserId: UserId, invitationId: string): Promise<void>;
}
