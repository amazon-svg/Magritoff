import type { UserId } from '../../../kernel/ids/index.ts';
import type {
  CreateInvitationCommand,
  CreateInvitationResult,
  InvitationOptions,
  PendingInvitation,
  ResendInvitationResult,
} from '../api/contracts.ts';
import type { InvitationsRepository } from './invitations-repository.ts';

export class InvitationsService {
  constructor(private readonly repository: InvitationsRepository) {}

  create(actorUserId: UserId, command: CreateInvitationCommand): Promise<CreateInvitationResult> {
    return this.repository.create(actorUserId, command);
  }

  options(actorUserId: UserId, tenantId: string): Promise<InvitationOptions> {
    return this.repository.options(actorUserId, tenantId);
  }
  pending(actorUserId: UserId, tenantId: string): Promise<PendingInvitation[]> {
    return this.repository.pending(actorUserId, tenantId);
  }
  resend(actorUserId: UserId, invitationId: string, baseUrl: string): Promise<ResendInvitationResult> {
    return this.repository.resend(actorUserId, invitationId, baseUrl);
  }
  revoke(actorUserId: UserId, invitationId: string): Promise<void> {
    return this.repository.revoke(actorUserId, invitationId);
  }
}
