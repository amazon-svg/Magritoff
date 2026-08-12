import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import { rolesOverviewSchema, setRoleAssignmentCommandSchema, setRoleAssignmentResultSchema, userRolesDetailSchema, type RolesOverview, type SetRoleAssignmentResult, type UserRolesDetail } from './contracts.ts';
export class RolesApiClient {
  constructor(private readonly client: FetchApiClient) {}
  overview(tenantId: string): Promise<RolesOverview> {
    return this.client.request({ path: `${API_V1_BASE_PATH}/tenants/${tenantId}/roles-overview`, responseSchema: rolesOverviewSchema });
  }
  userDetail(tenantId: string, userId: string): Promise<UserRolesDetail> {
    return this.client.request({ path: `${API_V1_BASE_PATH}/tenants/${tenantId}/members/${userId}/roles-detail`, responseSchema: userRolesDetailSchema });
  }
  setAssignment(tenantId: string, userId: string, roleId: string, active: boolean): Promise<SetRoleAssignmentResult> {
    return this.client.request({ method: 'PUT', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/members/${userId}/roles/${roleId}`, body: setRoleAssignmentCommandSchema.parse({ active }), responseSchema: setRoleAssignmentResultSchema });
  }
}
