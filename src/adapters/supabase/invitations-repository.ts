import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import type {
  CreateInvitationCommand,
  CreateInvitationResult,
  InvitationOptions,
  PendingInvitation,
  ResendInvitationResult,
} from '../../modules/invitations/api/contracts.ts';
import {
  InvitationRejectedError,
  type InvitationRejectionCode,
  type InvitationsRepository,
} from '../../modules/invitations/application/invitations-repository.ts';
import type { Database } from '../../types/database.types.ts';

interface LegacyInviteResponse {
  ok?: boolean;
  invitationId?: string;
  sent?: boolean;
  link?: string;
  reason?: string;
  error?: string;
  message?: string;
}

export class SupabaseInvitationsRepository implements InvitationsRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async create(
    actorUserId: UserId,
    command: CreateInvitationCommand,
  ): Promise<CreateInvitationResult> {
    const { data, error } = await this.client.functions.invoke<LegacyInviteResponse>('invite-member', {
      body: {
        email: command.email,
        tenant_id: command.tenantId,
        invited_by: actorUserId,
        baseUrl: command.baseUrl,
        role_definition_ids: command.roleDefinitionIds,
        role: 'member',
        access_scope: command.accessScope,
        allowed_shop_ids: command.accessScope === 'shop_only' ? command.allowedShopIds : [],
        permissions: { can_quote: true, can_order: true, can_invite: false },
      },
    });

    if (error || !data?.ok) {
      const response = await readErrorResponse(error);
      const message = response.payload?.error
        ?? response.payload?.message
        ?? data?.error
        ?? error?.message
        ?? 'Invitation impossible';
      throw new InvitationRejectedError(toRejectionCode(message, response.status), message);
    }

    if (!data.invitationId || !data.link || typeof data.sent !== 'boolean') {
      throw new Error('La fonction invite-member a retourné un résultat invalide.');
    }

    return {
      invitationId: data.invitationId,
      sent: data.sent,
      link: data.link,
      ...(data.reason === undefined ? {} : { reason: data.reason }),
    };
  }

  async options(_actorUserId: UserId, tenantId: string): Promise<InvitationOptions> {
    const [rolesResult, shopsResult] = await Promise.all([
      this.client.from('tenant_role_definitions').select('id, name, description, ordering_index')
        .eq('tenant_id', tenantId).is('archived_at', null).order('ordering_index'),
      this.client.from('shops').select('id, name').eq('tenant_id', tenantId).order('name'),
    ]);
    if (rolesResult.error || shopsResult.error) {
      throw new InvitationRejectedError('permission_denied', rolesResult.error?.message ?? shopsResult.error?.message ?? 'Options inaccessibles');
    }
    return {
      roles: (rolesResult.data ?? []).map((role) => ({ id: role.id, name: role.name, description: role.description ?? '' })),
      shops: (shopsResult.data ?? []).map((shop) => ({ id: shop.id, name: shop.name })),
    };
  }

  async pending(_actorUserId: UserId, tenantId: string): Promise<PendingInvitation[]> {
    const { data, error } = await this.client.from('tenant_invitations')
      .select('id, email, role, expires_at, created_at, access_scope, allowed_shop_ids, permissions')
      .eq('tenant_id', tenantId).is('accepted_at', null).order('created_at', { ascending: false });
    if (error) throw new InvitationRejectedError('permission_denied', error.message);
    return (data ?? []).map((row) => {
      const permissions = row.permissions as Record<string, unknown> | null;
      return {
        id: row.id, email: row.email,
        role: row.role as 'owner' | 'admin' | 'member' | 'partner',
        expiresAt: row.expires_at, createdAt: row.created_at,
        accessScope: row.access_scope === 'shop_only' ? 'shop_only' : 'magrit_full',
        allowedShopIds: row.allowed_shop_ids ?? [],
        permissions: {
          canQuote: permissions?.can_quote !== false,
          canOrder: permissions?.can_order !== false,
          canInvite: permissions?.can_invite === true,
        },
      };
    });
  }

  async resend(_actorUserId: UserId, invitationId: string, baseUrl: string): Promise<ResendInvitationResult> {
    const { data: visible, error: visibilityError } = await this.client.from('tenant_invitations')
      .select('id').eq('id', invitationId).is('accepted_at', null).maybeSingle();
    if (visibilityError || !visible) throw new InvitationRejectedError('permission_denied', visibilityError?.message ?? 'Invitation inaccessible');
    const { data, error } = await this.client.functions.invoke<LegacyInviteResponse>('make-server-e3db71a4/send-invitation-email', {
      body: { invitationId, baseUrl },
    });
    if (error || !data?.ok || !data.link || typeof data.sent !== 'boolean') {
      throw new InvitationRejectedError('delivery_failed', data?.error ?? error?.message ?? 'Renvoi impossible');
    }
    return { sent: data.sent, link: data.link, ...(data.reason ? { reason: data.reason } : {}) };
  }

  async revoke(actorUserId: UserId, invitationId: string): Promise<void> {
    const { data, error } = await this.client.from('tenant_invitations').delete()
      .eq('id', invitationId).select('id, email, tenant_id').maybeSingle();
    if (error || !data) throw new InvitationRejectedError('permission_denied', error?.message ?? 'Invitation inaccessible');
    const { error: eventError } = await this.client.from('tenant_member_events').insert({
      tenant_id: data.tenant_id, target_user_id: null, event_type: 'invitation_revoked',
      performed_by: actorUserId, metadata: { invitation_id: data.id, email: data.email },
    });
    if (eventError) throw new Error(`Invitation révoquée mais audit impossible: ${eventError.message}`);
  }
}

async function readErrorResponse(error: unknown): Promise<{
  status: number | null;
  payload: LegacyInviteResponse | null;
}> {
  const context = (error as { context?: unknown } | null)?.context;
  if (!(context instanceof Response)) return { status: null, payload: null };
  try {
    return {
      status: context.status,
      payload: await context.clone().json() as LegacyInviteResponse,
    };
  } catch {
    return { status: context.status, payload: null };
  }
}

function toRejectionCode(message: string, status: number | null): InvitationRejectionCode {
  if (status === 401 || /expired JWT|Authorization Bearer/i.test(message)) {
    return 'authentication_required';
  }
  if (/duplicate_pending/i.test(message)) return 'duplicate_pending';
  if (/role_mismatch_tenant/i.test(message)) return 'role_mismatch_tenant';
  if (/permission_denied|can_invite|invited_by_mismatch/i.test(message)) return 'permission_denied';
  if (status === 400 || status === 422 || /Body invalide/i.test(message)) return 'invalid_request';
  return 'delivery_failed';
}
