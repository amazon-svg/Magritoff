import type { PoolClient } from 'pg';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import type {
  ClientGroupDto,
  ClientPriceRuleDto,
  CommercialOverview,
  CreatePriceRule,
} from '../../modules/commercial/api/contracts.ts';
import type { CommercialRepository } from '../../modules/commercial/application/commercial-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type RuleRow = Readonly<{
  id: string; tenant_id: string; name: string;
  scope_type: ClientPriceRuleDto['scope_type']; group_id: string | null; user_id: string | null;
  target_type: ClientPriceRuleDto['target_type']; gamme_slug: string | null;
  product_definition_id: string | null; adjust_mode: ClientPriceRuleDto['adjust_mode'];
  value: string | number; priority: number; active: boolean;
  valid_from: string | null; valid_until: string | null; created_at: Date;
}>;
type GroupRow = Readonly<{
  id: string; tenant_id: string; name: string; created_at: Date; member_count: string | number;
}>;

export class PostgresCommercialRepository implements CommercialRepository {
  constructor(private readonly tx: PostgresTransactionRunner) {}

  overview(actor: UserId, tenantId: string): Promise<CommercialOverview> {
    return this.run(actor, tenantId, async (client) => {
      const rules = await client.query<RuleRow>(`
        select id::text,tenant_id::text,name,scope_type,group_id::text,user_id::text,
               target_type,gamme_slug,product_definition_id::text,adjust_mode,value,
               priority,active,valid_from::text,valid_until::text,created_at
          from public.client_price_rules where tenant_id=$1
         order by priority,created_at desc
      `, [tenantId]);
      const groups = await client.query<GroupRow>(`
        select groups.id::text,groups.tenant_id::text,groups.name,groups.created_at,
               count(members.user_id) member_count
          from public.client_groups groups
          left join public.client_group_members members on members.group_id=groups.id
         where groups.tenant_id=$1
         group by groups.id order by groups.name,groups.id
      `, [tenantId]);
      const members = await client.query<{ user_id: string; email: string }>(`
        select member.user_id::text,coalesce(users.email_normalized,'') email
          from public.tenant_members member
          join public.app_users users on users.id=member.user_id
         where member.tenant_id=$1 order by users.email_normalized,member.user_id
      `, [tenantId]);
      const gammes = await client.query<{ slug: string; name: string }>(`
        select slug,name from public.product_gammes order by display_order,slug
      `);
      return {
        available: true,
        rules: rules.rows.map(rule),
        groups: groups.rows.map(group),
        members: members.rows,
        gammes: gammes.rows,
      };
    });
  }

  createGroup(actor: UserId, tenantId: string, name: string): Promise<ClientGroupDto> {
    return this.write(actor, tenantId, async (client) => {
      const result = await client.query<GroupRow>(`
        insert into public.client_groups(tenant_id,name) values($1,$2)
        returning id::text,tenant_id::text,name,created_at,0::bigint member_count
      `, [tenantId, name]);
      return group(required(result.rows[0], 'Création du groupe impossible.'));
    });
  }

  removeGroup(actor: UserId, tenantId: string, groupId: string): Promise<void> {
    return this.write(actor, tenantId, async (client) => {
      const result = await client.query('delete from public.client_groups where tenant_id=$1 and id=$2', [tenantId, groupId]);
      if (result.rowCount !== 1) throw new Error('Groupe introuvable.');
    });
  }

  groupMembers(actor: UserId, tenantId: string, groupId: string): Promise<string[]> {
    return this.run(actor, tenantId, async (client) => {
      await requireGroup(client, tenantId, groupId);
      const result = await client.query<{ user_id: string }>(
        'select user_id::text from public.client_group_members where group_id=$1 order by user_id',
        [groupId],
      );
      return result.rows.map((row) => row.user_id);
    });
  }

  setGroupMember(actor: UserId, tenantId: string, groupId: string, userId: string, member: boolean): Promise<void> {
    return this.write(actor, tenantId, async (client) => {
      await requireGroup(client, tenantId, groupId);
      if (member) {
        const belongs = await client.query(
          'select 1 from public.tenant_members where tenant_id=$1 and user_id=$2',
          [tenantId, userId],
        );
        if (belongs.rowCount !== 1) throw new Error('Membre introuvable dans cet espace.');
        await client.query(`
          insert into public.client_group_members(group_id,user_id) values($1,$2)
          on conflict(group_id,user_id) do nothing
        `, [groupId, userId]);
      } else {
        await client.query(
          'delete from public.client_group_members where group_id=$1 and user_id=$2',
          [groupId, userId],
        );
      }
    });
  }

  createRule(actor: UserId, tenantId: string, input: CreatePriceRule): Promise<ClientPriceRuleDto> {
    return this.write(actor, tenantId, async (client) => {
      const result = await client.query<RuleRow>(`
        insert into public.client_price_rules(
          tenant_id,name,scope_type,group_id,user_id,target_type,gamme_slug,
          product_definition_id,adjust_mode,value,created_by
        ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        returning id::text,tenant_id::text,name,scope_type,group_id::text,user_id::text,
                  target_type,gamme_slug,product_definition_id::text,adjust_mode,value,
                  priority,active,valid_from::text,valid_until::text,created_at
      `, [tenantId, input.name, input.scope_type, input.group_id, input.user_id,
        input.target_type, input.gamme_slug, input.product_definition_id,
        input.adjust_mode, input.value, actor]);
      return rule(required(result.rows[0], 'Création de la règle impossible.'));
    });
  }

  setRuleActive(actor: UserId, tenantId: string, ruleId: string, active: boolean): Promise<ClientPriceRuleDto> {
    return this.write(actor, tenantId, async (client) => {
      const result = await client.query<RuleRow>(`
        update public.client_price_rules set active=$3,updated_at=clock_timestamp()
         where tenant_id=$1 and id=$2
        returning id::text,tenant_id::text,name,scope_type,group_id::text,user_id::text,
                  target_type,gamme_slug,product_definition_id::text,adjust_mode,value,
                  priority,active,valid_from::text,valid_until::text,created_at
      `, [tenantId, ruleId, active]);
      return rule(required(result.rows[0], 'Règle introuvable.'));
    });
  }

  removeRule(actor: UserId, tenantId: string, ruleId: string): Promise<void> {
    return this.write(actor, tenantId, async (client) => {
      const result = await client.query('delete from public.client_price_rules where tenant_id=$1 and id=$2', [tenantId, ruleId]);
      if (result.rowCount !== 1) throw new Error('Règle introuvable.');
    });
  }

  private run<T>(actor: UserId, tenantId: string, operation: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.tx.run({ userId: actor, tenantId: tenantId as TenantId }, operation);
  }

  private write<T>(actor: UserId, tenantId: string, operation: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.run(actor, tenantId, async (client) => {
      const allowed = await client.query<{ allowed: boolean }>(
        'select magrit.actor_has_capability($1,$2) allowed',
        [tenantId, 'can_manage_pricing'],
      );
      if (allowed.rows[0]?.allowed !== true) throw new Error('Gestion commerciale interdite.');
      return operation(client);
    });
  }
}

async function requireGroup(client: PoolClient, tenantId: string, groupId: string): Promise<void> {
  const result = await client.query(
    'select 1 from public.client_groups where tenant_id=$1 and id=$2',
    [tenantId, groupId],
  );
  if (result.rowCount !== 1) throw new Error('Groupe introuvable.');
}

function rule(row: RuleRow): ClientPriceRuleDto {
  return {
    ...row,
    value: Number(row.value),
    priority: Number(row.priority),
    created_at: row.created_at.toISOString(),
  };
}

function group(row: GroupRow): ClientGroupDto {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    created_at: row.created_at.toISOString(),
    member_count: Number(row.member_count),
  };
}

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}
