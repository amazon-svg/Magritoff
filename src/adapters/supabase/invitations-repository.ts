import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import type {
  CreateInvitationCommand,
  CreateInvitationResult,
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
