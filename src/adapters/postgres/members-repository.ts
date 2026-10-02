import type { PoolClient } from 'pg';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';
import type {
  ChangeMemberRoleCommand,
  TenantMember,
  UpdateMemberAccessCommand,
} from '../../modules/members/api/contracts.ts';
import {
  MemberRejectedError,
  type MembersRepository,
} from '../../modules/members/application/members-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type MemberRow = Record<string, unknown> & {
  user_id: string;
  role: string;
  joined_at: Date;
};

export class PostgresMembersRepository implements MembersRepository {
  constructor(private readonly transactions: PostgresTransactionRunner) {}

  list(actor: UserId, tenantId: string): Promise<TenantMember[]> {
    return this.transactions.run({ tenantId: tenantId as TenantId, userId: actor }, async (client) => {
      await requireMembership(client, tenantId, actor);
      const result = await client.query<MemberRow>(`
        select m.user_id,u.email_normalized as email,m.role,m.joined_at,
               m.access_scope,m.allowed_shop_ids,m.permissions
          from public.tenant_members m
          join public.app_users u on u.id=m.user_id
         where m.tenant_id=$1
         order by lower(u.email_normalized),m.user_id
      `, [tenantId]);
      return result.rows.map(toDto);
    });
  }

  changeRole(
    actor: UserId,
    tenantId: string,
    userId: string,
    command: ChangeMemberRoleCommand,
  ): Promise<void> {
    return this.write(actor, tenantId, async (client) => {
      const member = await lockMember(client, tenantId, userId);
      if (isAdministrator(member.role) && command.role !== 'admin') {
        await ensureAnotherAdministrator(client, tenantId, userId);
      }
      await client.query(
        'update public.tenant_members set role=$3 where tenant_id=$1 and user_id=$2',
        [tenantId, userId, command.role],
      );
      await audit(client, tenantId, actor, userId, 'role_changed', {
        old_role: member.role,
        new_role: command.role,
      });
    });
  }

  updateAccess(
    actor: UserId,
    tenantId: string,
    userId: string,
    command: UpdateMemberAccessCommand,
  ): Promise<void> {
    return this.write(actor, tenantId, async (client) => {
      const member = await lockMember(client, tenantId, userId);
      const permissions = {
        can_quote: command.permissions.canQuote,
        can_order: command.permissions.canOrder,
        can_invite: command.permissions.canInvite,
      };
      await client.query(`
        update public.tenant_members
           set access_scope=$3,allowed_shop_ids=$4::uuid[],permissions=$5::jsonb
         where tenant_id=$1 and user_id=$2
      `, [tenantId, userId, command.accessScope, command.allowedShopIds, JSON.stringify(permissions)]);
      await audit(client, tenantId, actor, userId, 'access_changed', {
        access_scope_changed: { from: member.access_scope, to: command.accessScope },
        permissions: command.permissions,
      });
    });
  }

  remove(actor: UserId, tenantId: string, userId: string): Promise<void> {
    return this.write(actor, tenantId, async (client) => {
      const member = await lockMember(client, tenantId, userId);
      if (isAdministrator(member.role)) await ensureAnotherAdministrator(client, tenantId, userId);
      await client.query('delete from public.tenant_members where tenant_id=$1 and user_id=$2', [tenantId, userId]);
      await audit(client, tenantId, actor, userId, 'removed', { old_role: member.role });
    });
  }

  private write(
    actor: UserId,
    tenantId: string,
    operation: (client: PoolClient) => Promise<void>,
  ): Promise<void> {
    return this.transactions.run({ tenantId: tenantId as TenantId, userId: actor }, async (client) => {
      try {
        await requireAdministrator(client, tenantId, actor);
        await operation(client);
      } catch (error) {
        if (error instanceof MemberRejectedError) throw error;
        throw new MemberRejectedError(
          'permission_denied',
          error instanceof Error ? error.message : String(error),
        );
      }
    });
  }
}

async function requireMembership(client: PoolClient, tenantId: string, actor: UserId): Promise<void> {
  const result = await client.query(
    'select 1 from public.tenant_members where tenant_id=$1 and user_id=$2',
    [tenantId, actor],
  );
  if (result.rowCount !== 1) {
    throw new MemberRejectedError('permission_denied', 'Vous n appartenez pas a cet espace.');
  }
}

async function requireAdministrator(client: PoolClient, tenantId: string, actor: UserId): Promise<void> {
  const result = await client.query<{ role: string }>(
    'select role from public.tenant_members where tenant_id=$1 and user_id=$2',
    [tenantId, actor],
  );
  if (!isAdministrator(result.rows[0]?.role ?? '')) {
    throw new MemberRejectedError('permission_denied', 'Un administrateur de l espace est requis.');
  }
}

async function lockMember(client: PoolClient, tenantId: string, userId: string): Promise<MemberRow> {
  const result = await client.query<MemberRow>(`
    select user_id,role,joined_at,access_scope,allowed_shop_ids,permissions
      from public.tenant_members where tenant_id=$1 and user_id=$2 for update
  `, [tenantId, userId]);
  const member = result.rows[0];
  if (member === undefined) throw new MemberRejectedError('member_not_found', 'Membre introuvable.');
  return member;
}

async function ensureAnotherAdministrator(client: PoolClient, tenantId: string, userId: string): Promise<void> {
  const result = await client.query(`
    select 1 from public.tenant_members
     where tenant_id=$1 and user_id<>$2 and role in ('owner','admin') limit 1
  `, [tenantId, userId]);
  if (result.rowCount === 0) {
    throw new MemberRejectedError(
      'last_admin_protected',
      'Le dernier administrateur de l espace ne peut pas etre modifie ou retire.',
    );
  }
}

async function audit(
  client: PoolClient,
  tenantId: string,
  actor: UserId,
  targetUserId: string,
  eventType: 'role_changed' | 'access_changed' | 'removed',
  metadata: Record<string, unknown>,
): Promise<void> {
  await client.query(`
    insert into public.tenant_member_events (
      tenant_id,target_user_id,event_type,performed_by,metadata
    ) values ($1,$2,$3,$4,$5::jsonb)
  `, [tenantId, targetUserId, eventType, actor, JSON.stringify(metadata)]);
}

function toDto(row: MemberRow): TenantMember {
  const permissions = asRecord(row['permissions']);
  return {
    userId: row.user_id,
    email: typeof row['email'] === 'string' ? row['email'] : null,
    role: isAdministrator(row.role) ? 'admin' : 'member',
    joinedAt: toIsoTimestamp(row.joined_at),
    accessScope: row['access_scope'] === 'shop_only' ? 'shop_only' : 'magrit_full',
    allowedShopIds: Array.isArray(row['allowed_shop_ids'])
      ? row['allowed_shop_ids'].map(String)
      : [],
    permissions: {
      canQuote: permissions['can_quote'] !== false,
      canOrder: permissions['can_order'] !== false,
      canInvite: permissions['can_invite'] === true,
    },
  };
}

function isAdministrator(role: string): boolean {
  return role === 'owner' || role === 'admin';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
