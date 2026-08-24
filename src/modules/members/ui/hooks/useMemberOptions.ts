import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RolesApiClient, type UserRolesDetail } from '../../../roles';
import { useWorkspaceUiRuntime } from '../../../../platform/runtime/workspace-ui-runtime';

export interface MemberOption {
  id: string;
  name: string;
  description: string;
  systemKey: string | null;
}
export interface MemberOptionAssignment {
  id: string;
  role_definition_id: string;
  user_id: string;
}

export function mapMemberOptionsDetail(detail: UserRolesDetail) {
  return {
    roles: detail.roles.map((role): MemberOption => ({
      id: role.id,
      name: role.name,
      description: role.description,
      systemKey: role.systemKey,
    })),
    assignments: detail.assignments.map((assignment): MemberOptionAssignment => ({
      id: assignment.id,
      role_definition_id: assignment.roleId,
      user_id: assignment.userId,
    })),
  };
}

function optionError(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

export function useMemberOptions({
  open,
  tenantId,
  targetUserId,
  onChanged,
}: {
  open: boolean;
  tenantId: string;
  targetUserId: string;
  onChanged: () => void | Promise<void>;
}) {
  const { apiClient } = useWorkspaceUiRuntime();
  const rolesApi = useMemo(() => new RolesApiClient(apiClient), [apiClient]);
  const requestVersion = useRef(0);
  const [roles, setRoles] = useState<MemberOption[]>([]);
  const [assignments, setAssignments] = useState<MemberOptionAssignment[]>([]);
  const [loading, setLoading] = useState(open);
  const [error, setError] = useState<string | null>(null);
  const [pendingRoleIds, setPendingRoleIds] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const mapped = mapMemberOptionsDetail(await rolesApi.userDetail(tenantId, targetUserId));
      if (version !== requestVersion.current) return;
      setRoles(mapped.roles);
      setAssignments(mapped.assignments);
    } catch (cause) {
      if (version === requestVersion.current) {
        setError(`Rôles : ${optionError(cause, 'chargement impossible')}`);
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [rolesApi, targetUserId, tenantId]);

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
      setError(`Erreur : ${optionError(cause, 'inconnue')}`);
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
