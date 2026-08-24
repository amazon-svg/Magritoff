import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InvitationsApiClient, type PendingInvitation, type ResendInvitationResult } from '../../../invitations';
import { useWorkspaceUiRuntime } from '../../../../platform/runtime/workspace-ui-runtime';
import { MembersApiClient } from '../../api/client';
import type { TenantMember } from '../../api/contracts';

export type MemberRole = 'admin' | 'member';
export type MemberAccessScope = 'magrit_full' | 'shop_only';

export interface MemberPermissions {
  can_quote: boolean;
  can_order: boolean;
  can_invite: boolean;
}

export interface MagritMemberRow {
  user_id: string;
  email: string | null;
  role: MemberRole;
  joined_at: string;
  access_scope: MemberAccessScope;
  allowed_shop_ids: string[];
  permissions: MemberPermissions;
}

export interface MagritInvitationRow {
  id: string;
  email: string;
  role: MemberRole;
  expires_at: string;
  created_at: string;
  access_scope: MemberAccessScope;
  allowed_shop_ids: string[];
  permissions: MemberPermissions;
}

function mapPermissions(permissions: {
  canQuote: boolean;
  canOrder: boolean;
  canInvite: boolean;
}): MemberPermissions {
  return {
    can_quote: permissions.canQuote,
    can_order: permissions.canOrder,
    can_invite: permissions.canInvite,
  };
}

export function toMagritMemberRow(member: TenantMember): MagritMemberRow {
  return {
    user_id: member.userId,
    email: member.email,
    role: member.role,
    joined_at: member.joinedAt,
    access_scope: member.accessScope,
    allowed_shop_ids: member.allowedShopIds,
    permissions: mapPermissions(member.permissions),
  };
}

export function toMagritInvitationRow(invitation: PendingInvitation): MagritInvitationRow {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    expires_at: invitation.expiresAt,
    created_at: invitation.createdAt,
    access_scope: invitation.accessScope,
    allowed_shop_ids: invitation.allowedShopIds,
    permissions: mapPermissions(invitation.permissions),
  };
}

export function useMembersWorkspace(tenantId: string | null) {
  const { apiClient } = useWorkspaceUiRuntime();
  const invitationsApi = useMemo(() => new InvitationsApiClient(apiClient), [apiClient]);
  const membersApi = useMemo(() => new MembersApiClient(apiClient), [apiClient]);
  const requestVersion = useRef(0);
  const [members, setMembers] = useState<MagritMemberRow[]>([]);
  const [invitations, setInvitations] = useState<MagritInvitationRow[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [updatingRoleFor, setUpdatingRoleFor] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!tenantId) {
      setMembers([]);
      setInvitations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [membersResult, invitationsResult] = await Promise.allSettled([
      membersApi.list(tenantId),
      invitationsApi.pending(tenantId),
    ]);
    if (version !== requestVersion.current) return;

    if (membersResult.status === 'fulfilled') {
      setMembers(membersResult.value.map(toMagritMemberRow));
    } else {
      console.error('[useMembersWorkspace] members API failed', membersResult.reason);
      setMembers([]);
    }
    if (invitationsResult.status === 'fulfilled') {
      setInvitations(invitationsResult.value.map(toMagritInvitationRow));
    } else {
      console.error('[useMembersWorkspace] invitations API failed', invitationsResult.reason);
      setInvitations([]);
    }
    setLoading(false);
  }, [invitationsApi, membersApi, tenantId]);

  useEffect(() => {
    void reload();
    return () => { requestVersion.current += 1; };
  }, [reload]);

  const resendInvitation = (invitationId: string, baseUrl: string): Promise<ResendInvitationResult> =>
    invitationsApi.resend(invitationId, baseUrl);

  const revokeInvitation = async (invitationId: string) => {
    await invitationsApi.revoke(invitationId);
    await reload();
  };

  const changeRole = async (member: MagritMemberRow, role: MemberRole) => {
    if (!tenantId || member.role === role) return;
    setUpdatingRoleFor(member.user_id);
    try {
      await membersApi.changeRole(tenantId, member.user_id, { role });
      await reload();
    } finally {
      setUpdatingRoleFor(null);
    }
  };

  const removeMember = async (userId: string) => {
    if (!tenantId) return;
    await membersApi.remove(tenantId, userId);
    await reload();
  };

  return {
    members,
    invitations,
    loading,
    updatingRoleFor,
    reload,
    resendInvitation,
    revokeInvitation,
    changeRole,
    removeMember,
  } as const;
}
