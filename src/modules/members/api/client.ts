import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  changeMemberRoleCommandSchema, memberMutationResultSchema, memberRemovalResultSchema,
  tenantMembersSchema, updateMemberAccessCommandSchema,
  type ChangeMemberRoleCommand, type TenantMember, type UpdateMemberAccessCommand,
} from './contracts.ts';

export class MembersApiClient {
  constructor(private readonly client: FetchApiClient) {}
  list(tenantId: string): Promise<TenantMember[]> {
    return this.client.request({ path: `${API_V1_BASE_PATH}/tenants/${tenantId}/members`, responseSchema: tenantMembersSchema });
  }
  changeRole(tenantId: string, userId: string, command: ChangeMemberRoleCommand): Promise<void> {
    return this.client.request({ method: 'PATCH', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/members/${userId}/role`, body: changeMemberRoleCommandSchema.parse(command), responseSchema: memberMutationResultSchema }).then(() => undefined);
  }
  updateAccess(tenantId: string, userId: string, command: UpdateMemberAccessCommand): Promise<void> {
    return this.client.request({ method: 'PATCH', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/members/${userId}/access`, body: updateMemberAccessCommandSchema.parse(command), responseSchema: memberMutationResultSchema }).then(() => undefined);
  }
  remove(tenantId: string, userId: string): Promise<void> {
    return this.client.request({ method: 'DELETE', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/members/${userId}`, responseSchema: memberRemovalResultSchema }).then(() => undefined);
  }
}
