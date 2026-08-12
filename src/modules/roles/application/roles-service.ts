import type { UserId } from '../../../kernel/ids/index.ts';
import type { RolesOverview, SetRoleAssignmentResult, UserRolesDetail } from '../api/contracts.ts';
import type { RolesRepository } from './roles-repository.ts';
export class RolesService {
  constructor(private readonly repository: RolesRepository) {}
  overview(actor: UserId, tenantId: string): Promise<RolesOverview> { return this.repository.overview(actor, tenantId); }
  userDetail(actor: UserId, tenantId: string, userId: string): Promise<UserRolesDetail> { return this.repository.userDetail(actor, tenantId, userId); }
  setAssignment(actor: UserId, tenantId: string, userId: string, roleId: string, active: boolean): Promise<SetRoleAssignmentResult> { return this.repository.setAssignment(actor, tenantId, userId, roleId, active); }
}
