import type { UserId } from '../../../kernel/ids/index.ts';
import type { ChangeMemberRoleCommand, TenantMember, UpdateMemberAccessCommand } from '../api/contracts.ts';
import type { MembersRepository } from './members-repository.ts';
export class MembersService {
  constructor(private readonly repository: MembersRepository) {}
  list(actor: UserId, tenantId: string): Promise<TenantMember[]> { return this.repository.list(actor, tenantId); }
  changeRole(actor: UserId, tenantId: string, userId: string, command: ChangeMemberRoleCommand): Promise<void> { return this.repository.changeRole(actor, tenantId, userId, command); }
  updateAccess(actor: UserId, tenantId: string, userId: string, command: UpdateMemberAccessCommand): Promise<void> { return this.repository.updateAccess(actor, tenantId, userId, command); }
  remove(actor: UserId, tenantId: string, userId: string): Promise<void> { return this.repository.remove(actor, tenantId, userId); }
}
