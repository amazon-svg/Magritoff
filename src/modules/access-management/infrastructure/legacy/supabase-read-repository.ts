import type { SupabaseClient } from '@supabase/supabase-js';
import {
  appError,
  err,
  ok,
  parseId,
  type Result,
  type TenantId,
} from '../../../../kernel';
import type { Database } from '../../../../types/database.types';
import type {
  AccessManagementReadRepository,
  AccessManagementRepositoryError,
  RoleStatusFilter,
} from '../../application';
import type {
  MemberRoleAssignments,
  RoleDefinition,
  RoleId,
} from '../../domain';
import { canonicalCapabilityNames } from './capability-mapping';

type AccessSupabaseClient = SupabaseClient<Database>;

type LegacyRoleRow = Readonly<{
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  capabilities: unknown;
  created_at: string;
  archived_at: string | null;
}>;

type LegacyMemberRow = Readonly<{
  user_id: string;
  email: string;
  joined_at: string;
}>;

type LegacyAssignmentRow = Readonly<{
  user_id: string;
  role_definition_id: string;
  assigned_at: string;
  tenant_role_definitions: unknown;
}>;

const legacySystemRoleNames = new Set(['owner', 'admin', 'acheteur', 'validateur', 'producteur']);

function repositoryError(
  code: AccessManagementRepositoryError['code'],
  message: string,
  retryable = false,
): AccessManagementRepositoryError {
  return appError(code, message, retryable) as AccessManagementRepositoryError;
}

function invalidData<T>(message: string): Result<T, AccessManagementRepositoryError> {
  return err(repositoryError('access_management.invalid_legacy_data', message));
}

function roleFromRelation(value: unknown): Pick<LegacyRoleRow, 'tenant_id' | 'archived_at' | 'capabilities'> | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== 'object' || candidate === null) return null;
  const row = candidate as Record<string, unknown>;
  if (typeof row.tenant_id !== 'string') return null;
  if (row.archived_at !== null && typeof row.archived_at !== 'string') return null;
  return {
    tenant_id: row.tenant_id,
    archived_at: row.archived_at as string | null,
    capabilities: row.capabilities,
  };
}

function mapRole(row: LegacyRoleRow): Result<RoleDefinition, AccessManagementRepositoryError> {
  const roleId = parseId<'RoleId'>(row.id);
  const tenantId = parseId<'TenantId'>(row.tenant_id);
  if (!roleId.ok || !tenantId.ok) return invalidData('A legacy role contains an invalid identifier.');
  const description = row.description?.trim();
  return ok({
    id: roleId.value,
    tenantId: tenantId.value,
    name: row.name,
    ...(description ? { description } : {}),
    capabilities: canonicalCapabilityNames(row.capabilities),
    kind: legacySystemRoleNames.has(row.name.trim().toLowerCase()) ? 'system' : 'custom',
    status: row.archived_at ? 'archived' : 'active',
    version: 1,
    createdAt: row.created_at,
    updatedAt: row.archived_at ?? row.created_at,
  });
}

export class SupabaseAccessManagementReadRepository implements AccessManagementReadRepository {
  constructor(private readonly client: AccessSupabaseClient) {}

  async listRoles(
    tenantId: TenantId,
    status: RoleStatusFilter,
  ): Promise<Result<readonly RoleDefinition[], AccessManagementRepositoryError>> {
    let query = this.client
      .from('tenant_role_definitions')
      .select('id, tenant_id, name, description, capabilities, created_at, archived_at')
      .eq('tenant_id', tenantId)
      .order('ordering_index', { ascending: true });
    if (status === 'active') query = query.is('archived_at', null);
    if (status === 'archived') query = query.not('archived_at', 'is', null);
    const { data, error } = await query;
    if (error) return this.providerFailure('Roles could not be loaded.');
    return this.mapRoles((data ?? []) as LegacyRoleRow[]);
  }

  async getRole(
    tenantId: TenantId,
    roleId: RoleId,
  ): Promise<Result<RoleDefinition | null, AccessManagementRepositoryError>> {
    const { data, error } = await this.client
      .from('tenant_role_definitions')
      .select('id, tenant_id, name, description, capabilities, created_at, archived_at')
      .eq('tenant_id', tenantId)
      .eq('id', roleId)
      .maybeSingle();
    if (error) return this.providerFailure('The role could not be loaded.');
    if (!data) return ok(null);
    return mapRole(data as LegacyRoleRow);
  }

  async listMemberAssignments(
    tenantId: TenantId,
  ): Promise<Result<readonly MemberRoleAssignments[], AccessManagementRepositoryError>> {
    const membersResult = await this.client.rpc('get_tenant_members_with_email', {
      p_tenant_id: tenantId,
    });
    if (membersResult.error) return this.providerFailure('Members could not be loaded.');

    const assignmentsResult = await this.client
      .from('tenant_role_assignments')
      .select(
        'user_id, role_definition_id, assigned_at, tenant_role_definitions!inner(tenant_id, archived_at, capabilities)',
      )
      .is('revoked_at', null)
      .eq('tenant_role_definitions.tenant_id', tenantId)
      .is('tenant_role_definitions.archived_at', null);
    if (assignmentsResult.error) {
      return this.providerFailure('Role assignments could not be loaded.');
    }

    const assignmentsByUser = new Map<string, LegacyAssignmentRow[]>();
    for (const assignment of (assignmentsResult.data ?? []) as LegacyAssignmentRow[]) {
      const current = assignmentsByUser.get(assignment.user_id) ?? [];
      current.push(assignment);
      assignmentsByUser.set(assignment.user_id, current);
    }

    const output: MemberRoleAssignments[] = [];
    for (const member of (membersResult.data ?? []) as LegacyMemberRow[]) {
      const userId = parseId<'UserId'>(member.user_id);
      if (!userId.ok) return invalidData('A legacy member contains an invalid identifier.');
      const assignments = assignmentsByUser.get(member.user_id) ?? [];
      const roleIds: RoleId[] = [];
      const capabilities = new Set<string>();
      let updatedAt = member.joined_at;
      for (const assignment of assignments) {
        const roleId = parseId<'RoleId'>(assignment.role_definition_id);
        const relation = roleFromRelation(assignment.tenant_role_definitions);
        if (!roleId.ok || !relation || relation.tenant_id !== tenantId || relation.archived_at) {
          return invalidData('A legacy role assignment is inconsistent with its tenant.');
        }
        roleIds.push(roleId.value);
        for (const capability of canonicalCapabilityNames(relation.capabilities)) {
          capabilities.add(capability);
        }
        if (assignment.assigned_at > updatedAt) updatedAt = assignment.assigned_at;
      }
      output.push({
        tenantId,
        userId: userId.value,
        displayName: member.email || member.user_id,
        ...(member.email ? { email: member.email } : {}),
        roleIds,
        effectiveCapabilities: [...capabilities].sort(),
        version: Math.max(1, assignments.length),
        updatedAt,
      });
    }
    return ok(output);
  }

  private mapRoles(
    rows: readonly LegacyRoleRow[],
  ): Result<readonly RoleDefinition[], AccessManagementRepositoryError> {
    const roles: RoleDefinition[] = [];
    for (const row of rows) {
      const role = mapRole(row);
      if (role.ok === false) return err(role.error);
      roles.push(role.value);
    }
    return ok(roles);
  }

  private providerFailure<T>(
    message: string,
  ): Result<T, AccessManagementRepositoryError> {
    return err(repositoryError('access_management.provider_unavailable', message, true));
  }
}
