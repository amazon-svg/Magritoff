import type { UserId } from '../../../kernel/ids/index.ts';
import type { RolesOverview, SetRoleAssignmentResult, UserRolesDetail } from '../api/contracts.ts';
export class RoleRejectedError extends Error {
  constructor(public readonly code: 'permission_denied' | 'role_not_found' | 'member_not_found', message: string) { super(message); this.name = 'RoleRejectedError'; }
}
export interface RolesRepository {
  overview(actor: UserId, tenantId: string): Promise<RolesOverview>;
  userDetail(actor: UserId, tenantId: string, userId: string): Promise<UserRolesDetail>;
  setAssignment(actor: UserId, tenantId: string, userId: string, roleId: string, active: boolean): Promise<SetRoleAssignmentResult>;
}
