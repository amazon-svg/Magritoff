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
  type InvitationsRepository,
} from '../../modules/invitations/application/invitations-repository.ts';
import type { Database } from '../../types/database.types.ts';
import type { InvitationEmailSender } from '../../modules/invitations/application/invitation-email-sender.ts';

export class SupabaseInvitationsRepository implements InvitationsRepository {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly emailSender: InvitationEmailSender,
  ) {}

  async create(
    _actorUserId: UserId,
    command: CreateInvitationCommand,
  ): Promise<CreateInvitationResult> {
    const { data, error } = await this.client.rpc('api_create_tenant_invitation', {
      p_tenant_id: command.tenantId,
      p_email: command.email,
      p_access_scope: 'magrit_full',
      p_allowed_shop_ids: [],
      p_role_definition_ids: command.roleDefinitionIds,
    });
    if (error) throw new InvitationRejectedError(toRejectionCode(error.message), error.message);
    const invitation = data?.[0];
    if (!invitation) throw new Error('La commande de création n’a retourné aucune invitation.');
    const link = `${command.baseUrl.replace(/\/+$/, '')}/invitations/${invitation.invitation_token}`;
    const delivery = await this.emailSender.send({
      to: command.email.toLowerCase().trim(), tenantName: invitation.tenant_name,
      role: 'member', link, expiresAt: invitation.invitation_expires_at,
    });
    return {
      invitationId: invitation.invitation_id,
      sent: delivery.sent,
      link,
      ...(delivery.reason ? { reason: delivery.reason } : {}),
    };
  }

  async options(_actorUserId: UserId, tenantId: string): Promise<InvitationOptions> {
    const [rolesResult, shopsResult] = await Promise.all([
      this.client.from('tenant_role_definitions').select('id, name, description, ordering_index')
        .eq('tenant_id', tenantId).eq('identity_context', 'magrit')
        .is('archived_at', null).order('ordering_index'),
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
      .select('id, email, token, expires_at, tenant_id, role').eq('id', invitationId).is('accepted_at', null).maybeSingle();
    if (visibilityError || !visible) throw new InvitationRejectedError('permission_denied', visibilityError?.message ?? 'Invitation inaccessible');
    const { data: tenant, error: tenantError } = await this.client.from('tenants').select('name').eq('id', visible.tenant_id).maybeSingle();
    if (tenantError || !tenant) throw new InvitationRejectedError('permission_denied', tenantError?.message ?? 'Tenant inaccessible');
    const link = `${baseUrl.replace(/\/+$/, '')}/invitations/${visible.token}`;
    const delivery = await this.emailSender.send({
      to: visible.email, tenantName: tenant.name, link, expiresAt: visible.expires_at,
      role: toInvitationRole(visible.role),
    });
    return { sent: delivery.sent, link, ...(delivery.reason ? { reason: delivery.reason } : {}) };
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

function toInvitationRole(role: string): 'owner' | 'admin' | 'member' | 'partner' {
  return role === 'owner' || role === 'admin' || role === 'partner' ? role : 'member';
}

function toRejectionCode(message: string): 'permission_denied' | 'duplicate_pending' | 'role_mismatch_tenant' | 'invalid_request' | 'delivery_failed' {
  if (/duplicate_pending/i.test(message)) return 'duplicate_pending';
  if (/role_mismatch_tenant/i.test(message)) return 'role_mismatch_tenant';
  if (/permission_denied|can_invite/i.test(message)) return 'permission_denied';
  if (/invalid_request/i.test(message)) return 'invalid_request';
  return 'delivery_failed';
}
