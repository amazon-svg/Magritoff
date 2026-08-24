import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RolesOverview, UserRolesDetail } from '../../modules/roles';
import { useWorkspaceRolesApi } from '../contexts/ModuleClientsContext';

export interface RoleAssignmentDefinition {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  capabilities: Record<string, boolean>;
  ordering_index: number;
  archived_at: null;
  systemKey: string | null;
}

export interface RoleAssignmentMember {
  user_id: string;
  email: string;
  role: string;
}

export interface RoleAssignmentRow {
  id: string;
  role_definition_id: string;
  user_id: string;
}

export interface UserRoleOption {
  id: string;
  name: string;
  description: string;
  systemKey: string | null;
}

export function mapRolesOverview(tenantId: string, overview: RolesOverview) {
  return {
    roles: overview.roles.map((role): RoleAssignmentDefinition => ({
      id: role.id,
      tenant_id: tenantId,
      name: role.name,
      description: role.description,
      capabilities: role.capabilities,
      ordering_index: role.orderingIndex,
      archived_at: null,
      systemKey: role.systemKey,
    })),
    members: overview.members.map((member): RoleAssignmentMember => ({
      user_id: member.userId,
      email: member.email,
      role: member.legacyRole,
    })),
    assignments: overview.assignments.map((assignment): RoleAssignmentRow => ({
      id: assignment.id,
      role_definition_id: assignment.roleId,
      user_id: assignment.userId,
    })),
  };
}

export function mapUserRolesDetail(detail: UserRolesDetail) {
  return {
    roles: detail.roles.map((role): UserRoleOption => ({
      id: role.id,
      name: role.name,
      description: role.description,
      systemKey: role.systemKey,
    })),
    assignments: detail.assignments.map((assignment): RoleAssignmentRow => ({
      id: assignment.id,
      role_definition_id: assignment.roleId,
      user_id: assignment.userId,
    })),
  };
}

export function roleAssignmentError(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

export function useRoleAssignmentMatrix(tenantId: string | null) {
  const rolesApi = useWorkspaceRolesApi();
  const requestVersion = useRef(0);
  const [roles, setRoles] = useState<RoleAssignmentDefinition[]>([]);
  const [members, setMembers] = useState<RoleAssignmentMember[]>([]);
  const [assignments, setAssignments] = useState<RoleAssignmentRow[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!tenantId) {
      setRoles([]);
      setMembers([]);
      setAssignments([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const mapped = mapRolesOverview(tenantId, await rolesApi.overview(tenantId));
      if (version !== requestVersion.current) return;
      setRoles(mapped.roles);
      setMembers(mapped.members);
      setAssignments(mapped.assignments);
    } catch (cause) {
      if (version === requestVersion.current) {
        setError(`Rôles : ${roleAssignmentError(cause, 'chargement impossible')}`);
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [rolesApi, tenantId]);

  useEffect(() => {
    void reload();
    return () => { requestVersion.current += 1; };
  }, [reload]);

  const assignmentByKey = useMemo(() => new Map(
    assignments.map((assignment) => [
      `${assignment.user_id}:${assignment.role_definition_id}`,
      assignment,
    ]),
  ), [assignments]);

  const toggleAssignment = async (userId: string, roleId: string) => {
    if (!tenantId) return;
    const key = `${userId}:${roleId}`;
    if (pending.has(key)) return;
    setPending((current) => new Set(current).add(key));
    setError(null);
    try {
      await rolesApi.setAssignment(tenantId, userId, roleId, !assignmentByKey.has(key));
      await reload();
    } catch (cause) {
      setError(`Erreur assignation : ${roleAssignmentError(cause, 'inconnue')}`);
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  return { roles, members, loading, error, pending, assignmentByKey, toggleAssignment } as const;
}

interface UseUserRoleManagementOptions {
  open: boolean;
  tenantId: string;
  targetUserId: string;
  onChanged: () => void | Promise<void>;
}

export function useUserRoleManagement({
  open,
  tenantId,
  targetUserId,
  onChanged,
}: UseUserRoleManagementOptions) {
  const rolesApi = useWorkspaceRolesApi();
  const requestVersion = useRef(0);
  const [roles, setRoles] = useState<UserRoleOption[]>([]);
  const [assignments, setAssignments] = useState<RoleAssignmentRow[]>([]);
  const [loading, setLoading] = useState(open);
  const [error, setError] = useState<string | null>(null);
  const [pendingRoleIds, setPendingRoleIds] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const mapped = mapUserRolesDetail(await rolesApi.userDetail(tenantId, targetUserId));
      if (version !== requestVersion.current) return;
      setRoles(mapped.roles);
      setAssignments(mapped.assignments);
    } catch (cause) {
      if (version === requestVersion.current) {
        setError(`Rôles : ${roleAssignmentError(cause, 'chargement impossible')}`);
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [rolesApi, tenantId, targetUserId]);

  useEffect(() => {
    if (open) void reload();
    return () => { requestVersion.current += 1; };
  }, [open, reload]);

  const assignmentByRoleId = useMemo(() => new Map(
    assignments.map((assignment) => [assignment.role_definition_id, assignment]),
  ), [assignments]);

  const toggleAssignment = async (roleId: string) => {
    if (pendingRoleIds.has(roleId)) return;
    setPendingRoleIds((current) => new Set(current).add(roleId));
    setError(null);
    try {
      await rolesApi.setAssignment(
        tenantId,
        targetUserId,
        roleId,
        !assignmentByRoleId.has(roleId),
      );
      await reload();
      await onChanged();
    } catch (cause) {
      setError(`Erreur : ${roleAssignmentError(cause, 'inconnue')}`);
    } finally {
      setPendingRoleIds((current) => {
        const next = new Set(current);
        next.delete(roleId);
        return next;
      });
    }
  };

  return {
    roles,
    loading,
    error,
    pendingRoleIds,
    assignmentByRoleId,
    toggleAssignment,
  } as const;
}
