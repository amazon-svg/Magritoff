import type { UserId } from '../../../kernel/ids/index.ts';
import type { ChangeMemberRoleCommand, TenantMember, UpdateMemberAccessCommand } from '../api/contracts.ts';

export type MemberRejectionCode = 'permission_denied' | 'member_not_found' | 'last_admin_protected' | 'invalid_request';
export class MemberRejectedError extends Error {
  constructor(public readonly code: MemberRejectionCode, message: string) { super(message); this.name = 'MemberRejectedError'; }
}
export interface MembersRepository {
  list(actorUserId: UserId, tenantId: string): Promise<TenantMember[]>;
  changeRole(actorUserId: UserId, tenantId: string, userId: string, command: ChangeMemberRoleCommand): Promise<void>;
  updateAccess(actorUserId: UserId, tenantId: string, userId: string, command: UpdateMemberAccessCommand): Promise<void>;
  remove(actorUserId: UserId, tenantId: string, userId: string): Promise<void>;
}
