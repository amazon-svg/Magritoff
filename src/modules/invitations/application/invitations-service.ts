import type { UserId } from '../../../kernel/ids/index.ts';
import type {
  CreateInvitationCommand,
  CreateInvitationResult,
} from '../api/contracts.ts';
import type { InvitationsRepository } from './invitations-repository.ts';

export class InvitationsService {
  constructor(private readonly repository: InvitationsRepository) {}

  create(actorUserId: UserId, command: CreateInvitationCommand): Promise<CreateInvitationResult> {
    return this.repository.create(actorUserId, command);
  }
}
