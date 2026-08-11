import type { UserId } from '../../../kernel/ids/index.ts';
import type {
  CreateInvitationCommand,
  CreateInvitationResult,
} from '../api/contracts.ts';

export type InvitationRejectionCode =
  | 'authentication_required'
  | 'permission_denied'
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
  create(
    actorUserId: UserId,
    command: CreateInvitationCommand,
  ): Promise<CreateInvitationResult>;
}
