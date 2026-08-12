import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  archiveRoleResultSchema, roleCatalogDefinitionSchema, reorderRolesCommandSchema,
  reorderRolesResultSchema, rolesCatalogSchema, rolesOverviewSchema,
  saveRoleDefinitionCommandSchema, setRoleAssignmentCommandSchema,
  setRoleAssignmentResultSchema, userRolesDetailSchema,
  userCapabilitySchema,
  type RoleCatalogDefinition, type RolesCatalog, type RolesOverview,
  type SaveRoleDefinitionCommand, type SetRoleAssignmentResult, type UserRolesDetail,
} from './contracts.ts';
export class RolesApiClient {
  constructor(private readonly client: FetchApiClient) {}
  userCapability(tenantId: string, capability: string): Promise<boolean> {
    return this.client.request({ path: `${API_V1_BASE_PATH}/tenants/${tenantId}/capabilities/${encodeURIComponent(capability)}`, responseSchema: userCapabilitySchema }).then(({ granted }) => granted);
  }
  overview(tenantId: string): Promise<RolesOverview> {
    return this.client.request({ path: `${API_V1_BASE_PATH}/tenants/${tenantId}/roles-overview`, responseSchema: rolesOverviewSchema });
  }
  catalog(tenantId: string): Promise<RolesCatalog> {
    return this.client.request({ path: `${API_V1_BASE_PATH}/tenants/${tenantId}/roles-catalog`, responseSchema: rolesCatalogSchema });
  }
  userDetail(tenantId: string, userId: string): Promise<UserRolesDetail> {
    return this.client.request({ path: `${API_V1_BASE_PATH}/tenants/${tenantId}/members/${userId}/roles-detail`, responseSchema: userRolesDetailSchema });
  }
  setAssignment(tenantId: string, userId: string, roleId: string, active: boolean): Promise<SetRoleAssignmentResult> {
    return this.client.request({ method: 'PUT', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/members/${userId}/roles/${roleId}`, body: setRoleAssignmentCommandSchema.parse({ active }), responseSchema: setRoleAssignmentResultSchema });
  }
  createDefinition(tenantId: string, command: SaveRoleDefinitionCommand): Promise<RoleCatalogDefinition> {
    return this.client.request({ method: 'POST', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/roles`, body: saveRoleDefinitionCommandSchema.parse(command), responseSchema: roleCatalogDefinitionSchema });
  }
  updateDefinition(tenantId: string, roleId: string, command: SaveRoleDefinitionCommand): Promise<RoleCatalogDefinition> {
    return this.client.request({ method: 'PUT', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/roles/${roleId}`, body: saveRoleDefinitionCommandSchema.parse(command), responseSchema: roleCatalogDefinitionSchema });
  }
  archiveDefinition(tenantId: string, roleId: string): Promise<void> {
    return this.client.request({ method: 'DELETE', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/roles/${roleId}`, responseSchema: archiveRoleResultSchema }).then(() => undefined);
  }
  reorderDefinitions(tenantId: string, firstRoleId: string, secondRoleId: string): Promise<void> {
    return this.client.request({ method: 'PUT', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/roles-order`, body: reorderRolesCommandSchema.parse({ firstRoleId, secondRoleId }), responseSchema: reorderRolesResultSchema }).then(() => undefined);
  }
}
