import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  RoleCatalogDefinition,
  RolesCatalog,
  SaveRoleDefinitionCommand,
} from '../../modules/roles';
import { useWorkspaceRolesApi } from '../contexts/ModuleClientsContext';
import type { RoleAssignmentView, TenantRoleDefinition } from './roleManagement.types';

export function toTenantRoleDefinition(role: RoleCatalogDefinition): TenantRoleDefinition {
  return {
    id: role.id,
    tenant_id: role.tenantId,
    name: role.name,
    description: role.description,
    capabilities: role.capabilities,
    notify_policy: role.notifyPolicy,
    scope: role.scope,
    scope_shop_id: role.scopeShopId,
    ordering_index: role.orderingIndex,
    archived_at: role.archivedAt,
  };
}

export function toRoleAssignmentViews(catalog: RolesCatalog): RoleAssignmentView[] {
  const emailByUserId = new Map(catalog.members.map((member) => [member.userId, member.email]));
  return catalog.assignments.map((assignment) => ({
    role_definition_id: assignment.roleId,
    user_id: assignment.userId,
    user_email: emailByUserId.get(assignment.userId) ?? null,
  }));
}

export function roleCatalogError(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

export function useRoleCatalogManagement(tenantId: string | null) {
  const rolesApi = useWorkspaceRolesApi();
  const requestVersion = useRef(0);
  const targetRef = useRef(tenantId);
  targetRef.current = tenantId;
  const [roles, setRoles] = useState<TenantRoleDefinition[]>([]);
  const [assignments, setAssignments] = useState<RoleAssignmentView[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!tenantId) {
      setRoles([]);
      setAssignments([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const catalog = await rolesApi.catalog(tenantId);
      if (version !== requestVersion.current) return;
      setRoles(catalog.roles.map(toTenantRoleDefinition));
      setAssignments(toRoleAssignmentViews(catalog));
    } catch (cause) {
      if (version === requestVersion.current) {
        setError(roleCatalogError(cause, 'Chargement des rôles impossible.'));
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [rolesApi, tenantId]);

  useEffect(() => {
    setRoles([]);
    setAssignments([]);
    void reload();
    return () => {
      requestVersion.current += 1;
    };
  }, [reload]);

  const runMutation = async (operation: (currentTenantId: string) => Promise<unknown>) => {
    if (!tenantId) throw new Error('Aucun espace actif.');
    const target = tenantId;
    setError(null);
    try {
      await operation(tenantId);
      if (target === targetRef.current) await reload();
    } catch (cause) {
      if (target === targetRef.current) {
        setError(roleCatalogError(cause, 'Modification du rôle impossible.'));
      }
      throw cause;
    }
  };

  const saveDefinition = (
    roleId: string | null,
    command: SaveRoleDefinitionCommand,
  ) => runMutation((currentTenantId) => roleId
    ? rolesApi.updateDefinition(currentTenantId, roleId, command)
    : rolesApi.createDefinition(currentTenantId, command));

  const reorderDefinitions = (firstRoleId: string, secondRoleId: string) => runMutation(
    (currentTenantId) => rolesApi.reorderDefinitions(currentTenantId, firstRoleId, secondRoleId),
  );

  const archiveDefinition = (roleId: string) => runMutation(
    (currentTenantId) => rolesApi.archiveDefinition(currentTenantId, roleId),
  );

  return {
    roles,
    assignments,
    loading,
    error,
    reload,
    saveDefinition,
    reorderDefinitions,
    archiveDefinition,
  } as const;
}
