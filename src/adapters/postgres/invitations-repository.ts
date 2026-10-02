import { createHash, randomBytes } from 'node:crypto';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import type {
  CreateInvitationCommand,
  CreateInvitationResult,
  InvitationActivation,
  InvitationOptions,
  PendingInvitation,
  ResendInvitationResult,
} from '../../modules/invitations/api/contracts.ts';
import type { InvitationEmailSender } from '../../modules/invitations/application/invitation-email-sender.ts';
import {
  InvitationRejectedError,
  type InvitationsRepository,
} from '../../modules/invitations/application/invitations-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type InvitationRow = Readonly<{
  id: string;
  tenant_id: string;
  tenant_name: string;
  email: string;
  role: string;
  expires_at: Date;
  created_at: Date;
  access_scope: string;
  allowed_shop_ids: string[];
  permissions: unknown;
}>;

const INVITATION_VALIDITY_MS = 14 * 24 * 60 * 60 * 1_000;

export class PostgresInvitationsRepository implements InvitationsRepository {
  constructor(
    private readonly transactions: PostgresTransactionRunner,
    private readonly emailSender: InvitationEmailSender,
    private readonly now: () => Date = () => new Date(),
    private readonly createToken: () => string = () => randomBytes(32).toString('base64url'),
  ) {}

  activation(token: string): Promise<InvitationActivation> {
    return this.transactions.run({}, async (client) => {
      const result = await client.query<InvitationRow & { account_exists: boolean }>(`
        select invitation.id::text, invitation.tenant_id::text,
               tenant.name as tenant_name, invitation.email, invitation.role,
               invitation.expires_at, invitation.created_at,
               invitation.access_scope, invitation.allowed_shop_ids,
               invitation.permissions,
               exists (
                 select 1 from public.app_users account
                  where account.email_normalized=invitation.email
                    and account.status='active'
               ) as account_exists
          from public.tenant_invitations invitation
          join public.tenants tenant on tenant.id=invitation.tenant_id
         where invitation.token_hash=$1
           and invitation.accepted_at is null
           and invitation.expires_at > clock_timestamp()
      `, [hashToken(token)]);
      const invitation = result.rows[0];
      if (invitation === undefined) {
        throw new InvitationRejectedError('invalid_request', 'Invitation invalide ou expirée.');
      }
      return {
        email: invitation.email,
        tenantName: invitation.tenant_name,
        accountExists: invitation.account_exists,
        expiresAt: invitation.expires_at.toISOString(),
      };
    });
  }

  async create(actorUserId: UserId, command: CreateInvitationCommand): Promise<CreateInvitationResult> {
    const email = command.email.toLowerCase().trim();
    const roleIds = [...new Set(command.roleDefinitionIds)];
    if (roleIds.length !== command.roleDefinitionIds.length
      || (command.role === 'admin' && roleIds.length > 0)) {
      throw new InvitationRejectedError('invalid_request', 'Combinaison de rôle et options invalide.');
    }
    const token = this.createToken();
    const expiresAt = new Date(this.now().getTime() + INVITATION_VALIDITY_MS);

    let invitation: InvitationRow;
    try {
      invitation = await this.transactions.run(
        { userId: actorUserId, tenantId: command.tenantId as TenantId },
        async (client) => {
          await requireCanInvite(client, command.tenantId);
          if (await isExistingMember(client, command.tenantId, email)) {
            throw new InvitationRejectedError('already_member', 'Cet utilisateur est déjà membre de cet espace.');
          }
          if (roleIds.length > 0) {
            const roles = await client.query<{ id: string }>(`
              select id::text from public.tenant_role_definitions
               where tenant_id=$1 and id=any($2::uuid[])
                 and identity_context='magrit'
                 and system_key in ('option_shops','option_orders')
                 and archived_at is null
            `, [command.tenantId, roleIds]);
            if (roles.rowCount !== roleIds.length) {
              throw new InvitationRejectedError('role_mismatch_tenant', 'Une option ne dépend pas de cet espace.');
            }
          }
          const result = await client.query<InvitationRow>(`
            with inserted as (
              insert into public.tenant_invitations (
                tenant_id,email,role,token_hash,expires_at,invited_by,pending_role_ids
              ) values ($1,$2,$3,$4,$5,$6,$7::uuid[])
              returning *
            )
            select inserted.id::text,inserted.tenant_id::text,
                   tenant.name as tenant_name,inserted.email,inserted.role,
                   inserted.expires_at,inserted.created_at,inserted.access_scope,
                   inserted.allowed_shop_ids,inserted.permissions
              from inserted join public.tenants tenant on tenant.id=inserted.tenant_id
          `, [
            command.tenantId, email, command.role, hashToken(token), expiresAt,
            actorUserId, roleIds,
          ]);
          return requiredInvitation(result.rows);
        },
      );
    } catch (error) {
      throw mapInvitationError(error);
    }

    const link = invitationLink(command.baseUrl, token);
    const delivery = await this.emailSender.send({
      to: invitation.email,
      tenantName: invitation.tenant_name,
      role: toRole(invitation.role),
      link,
      expiresAt: invitation.expires_at.toISOString(),
    });
    return {
      invitationId: invitation.id,
      sent: delivery.sent,
      link,
      ...(delivery.reason === undefined ? {} : { reason: delivery.reason }),
    };
  }

  options(actorUserId: UserId, tenantId: string): Promise<InvitationOptions> {
    return this.transactions.run(
      { userId: actorUserId, tenantId: tenantId as TenantId },
      async (client) => {
        await requireCanInvite(client, tenantId);
        const [roles, shops] = await Promise.all([
          client.query<{ id: string; name: string; description: string; system_key: string | null }>(`
            select id::text,name,description,system_key
              from public.tenant_role_definitions
             where tenant_id=$1 and identity_context='magrit' and archived_at is null
             order by ordering_index,id
          `, [tenantId]),
          client.query<{ id: string; name: string }>(`
            select id::text,name from public.shops
             where tenant_id=$1 and deleted_at is null order by name,id
          `, [tenantId]),
        ]);
        return {
          roles: roles.rows.map((role) => ({
            id: role.id, name: role.name, description: role.description,
            systemKey: role.system_key,
          })),
          shops: shops.rows,
        };
      },
    ).catch((error) => { throw mapInvitationError(error); });
  }

  pending(actorUserId: UserId, tenantId: string): Promise<PendingInvitation[]> {
    return this.transactions.run(
      { userId: actorUserId, tenantId: tenantId as TenantId },
      async (client) => {
        await requireCanInvite(client, tenantId);
        const result = await client.query<InvitationRow>(`
          select invitation.id::text,invitation.tenant_id::text,
                 tenant.name as tenant_name,invitation.email,invitation.role,
                 invitation.expires_at,invitation.created_at,
                 invitation.access_scope,invitation.allowed_shop_ids,
                 invitation.permissions
            from public.tenant_invitations invitation
            join public.tenants tenant on tenant.id=invitation.tenant_id
           where invitation.tenant_id=$1 and invitation.accepted_at is null
             and invitation.access_scope='magrit_full'
           order by invitation.created_at desc,invitation.id desc
        `, [tenantId]);
        return result.rows.map(mapPending);
      },
    ).catch((error) => { throw mapInvitationError(error); });
  }

  async resend(actorUserId: UserId, invitationId: string, baseUrl: string): Promise<ResendInvitationResult> {
    const token = this.createToken();
    const expiresAt = new Date(this.now().getTime() + INVITATION_VALIDITY_MS);
    let invitation: InvitationRow;
    try {
      invitation = await this.transactions.run({ userId: actorUserId }, async (client) => {
        const current = await client.query<InvitationRow>(`
          select invitation.id::text,invitation.tenant_id::text,
                 tenant.name as tenant_name,invitation.email,invitation.role,
                 invitation.expires_at,invitation.created_at,
                 invitation.access_scope,invitation.allowed_shop_ids,
                 invitation.permissions
            from public.tenant_invitations invitation
            join public.tenants tenant on tenant.id=invitation.tenant_id
           where invitation.id=$1 and invitation.accepted_at is null
           for update of invitation
        `, [invitationId]);
        const row = current.rows[0];
        if (row === undefined) throw permissionDenied();
        await client.query(`select set_config('magrit.tenant_id',$1,true)`, [row.tenant_id]);
        await requireCanInvite(client, row.tenant_id);
        const updated = await client.query<InvitationRow>(`
          update public.tenant_invitations invitation
             set token_hash=$2,expires_at=$3
           where invitation.id=$1
          returning invitation.id::text,invitation.tenant_id::text,
            $4::text as tenant_name,invitation.email,invitation.role,
            invitation.expires_at,invitation.created_at,
            invitation.access_scope,invitation.allowed_shop_ids,invitation.permissions
        `, [invitationId, hashToken(token), expiresAt, row.tenant_name]);
        return requiredInvitation(updated.rows);
      });
    } catch (error) {
      throw mapInvitationError(error);
    }
    const link = invitationLink(baseUrl, token);
    const delivery = await this.emailSender.send({
      to: invitation.email,
      tenantName: invitation.tenant_name,
      role: toRole(invitation.role),
      link,
      expiresAt: invitation.expires_at.toISOString(),
    });
    return { sent: delivery.sent, link, ...(delivery.reason === undefined ? {} : { reason: delivery.reason }) };
  }

  async revoke(actorUserId: UserId, invitationId: string): Promise<void> {
    try {
      await this.transactions.run({ userId: actorUserId }, async (client) => {
        const current = await client.query<{ id: string; tenant_id: string; email: string }>(`
          select id::text,tenant_id::text,email from public.tenant_invitations
           where id=$1 and accepted_at is null for update
        `, [invitationId]);
        const invitation = current.rows[0];
        if (invitation === undefined) throw permissionDenied();
        await client.query(`select set_config('magrit.tenant_id',$1,true)`, [invitation.tenant_id]);
        await requireCanInvite(client, invitation.tenant_id);
        await client.query(`delete from public.tenant_invitations where id=$1`, [invitationId]);
        await client.query(`
          insert into public.tenant_member_events (
            tenant_id,target_user_id,event_type,performed_by,metadata
          ) values ($1,null,'invitation_revoked',$2,$3::jsonb)
        `, [invitation.tenant_id, actorUserId, JSON.stringify({
          invitation_id: invitation.id, email: invitation.email,
        })]);
      });
    } catch (error) {
      throw mapInvitationError(error);
    }
  }
}

type QueryClient = Parameters<Parameters<PostgresTransactionRunner['run']>[1]>[0];

async function requireCanInvite(client: QueryClient, tenantId: string): Promise<void> {
  const result = await client.query<{ allowed: boolean }>(`
    select magrit.actor_has_capability($1,'can_invite') as allowed
  `, [tenantId]);
  if (result.rows[0]?.allowed !== true) throw permissionDenied();
}

async function isExistingMember(client: QueryClient, tenantId: string, email: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(`
    select exists (
      select 1 from public.tenant_members member
      join public.app_users account on account.id=member.user_id
      where member.tenant_id=$1 and account.email_normalized=$2
    ) as exists
  `, [tenantId, email]);
  return result.rows[0]?.exists === true;
}

function mapPending(row: InvitationRow): PendingInvitation {
  const permissions = asRecord(row.permissions);
  return {
    id: row.id,
    email: row.email,
    role: toRole(row.role),
    expiresAt: row.expires_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    accessScope: row.access_scope === 'shop_only' ? 'shop_only' : 'magrit_full',
    allowedShopIds: row.allowed_shop_ids,
    permissions: {
      canQuote: permissions['can_quote'] !== false,
      canOrder: permissions['can_order'] !== false,
      canInvite: permissions['can_invite'] === true,
    },
  };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function invitationLink(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/invitations/${token}`;
}

function toRole(role: string): 'admin' | 'member' {
  return role === 'admin' ? 'admin' : 'member';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function requiredInvitation(rows: readonly InvitationRow[]): InvitationRow {
  const invitation = rows[0];
  if (invitation === undefined) throw new Error('Invitation créée introuvable.');
  return invitation;
}

function permissionDenied(): InvitationRejectedError {
  return new InvitationRejectedError('permission_denied', 'Invitation inaccessible ou action interdite.');
}

function mapInvitationError(error: unknown): Error {
  if (error instanceof InvitationRejectedError) return error;
  const candidate = error as { code?: unknown; constraint?: unknown; message?: unknown };
  if (candidate.code === '23505' && candidate.constraint === 'tenant_invitations_pending_email_uidx') {
    return new InvitationRejectedError('duplicate_pending', 'Une invitation est déjà active pour cette adresse.');
  }
  return error instanceof Error ? error : new Error(String(error));
}
