import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { PostgresInvitationsRepository } from '../../src/adapters/postgres/invitations-repository.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresSessionBootstrapRepository } from '../../src/adapters/postgres/session-bootstrap-repository.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import type { InvitationEmail, InvitationEmailSender } from '../../src/modules/invitations/application/invitation-email-sender.ts';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';

const enabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';

(enabled ? describe : describe.skip)('PostgresInvitationsRepository — PostgreSQL reel', () => {
  let pool: Pool;
  let invitations: PostgresInvitationsRepository;
  let sessions: PostgresSessionBootstrapRepository;
  const sent: InvitationEmail[] = [];
  const tenantId = randomUUID() as TenantId;
  const ownerId = randomUUID() as UserId;
  const targetId = randomUUID() as UserId;
  const delegatedInviterId = randomUUID() as UserId;
  const outsiderId = randomUUID() as UserId;
  const targetEmail = `invite-${targetId}@example.invalid`;

  beforeAll(async () => {
    pool = createPostgresPool();
    const transactions = new PostgresTransactionRunner(pool, 'magrit_api');
    const sender: InvitationEmailSender = {
      async send(message) { sent.push(message); return { sent: true }; },
    };
    invitations = new PostgresInvitationsRepository(transactions, sender);
    sessions = new PostgresSessionBootstrapRepository(transactions);
    await pool.query(`
      insert into public.app_users(id,email_normalized,display_name) values
        ($1,$2,'Owner'),($3,$4,'Invite'),($5,$6,'Delegated'),($7,$8,'Outsider')
    `, [
      ownerId, `owner-${ownerId}@example.invalid`,
      targetId, targetEmail,
      delegatedInviterId, `delegated-${delegatedInviterId}@example.invalid`,
      outsiderId, `outsider-${outsiderId}@example.invalid`,
    ]);
    await pool.query(`insert into public.tenants(id,slug,name) values($1,$2,'Invitations')`,
      [tenantId, `invitations-${tenantId}`]);
    await pool.query(`
      insert into public.tenant_members(tenant_id,user_id,role,permissions) values
        ($1,$2,'owner','{"can_quote":true,"can_order":true,"can_invite":false}'),
        ($1,$3,'member','{"can_quote":true,"can_order":true,"can_invite":true}')
    `, [tenantId, ownerId, delegatedInviterId]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('delete from public.tenants where id=$1', [tenantId]);
    await pool.query('delete from public.app_users where id=any($1::uuid[])', [
      [ownerId, targetId, delegatedInviterId, outsiderId],
    ]);
    await pool.end();
  });

  it('cree, expose et accepte une invitation sans stocker le jeton en clair', async () => {
    const option = await pool.query<{ id: string }>(`
      select id::text from public.tenant_role_definitions
       where tenant_id=$1 and system_key='option_shops'
    `, [tenantId]);
    const result = await invitations.create(ownerId, {
      tenantId,
      email: targetEmail.toUpperCase(),
      baseUrl: 'https://app.example.test/',
      role: 'member',
      roleDefinitionIds: [option.rows[0]!.id],
    });
    expect(result).toMatchObject({ sent: true, invitationId: expect.any(String) });
    const token = result.link.split('/').at(-1)!;
    const stored = await pool.query<{ token_hash: string }>(
      'select token_hash from public.tenant_invitations where id=$1', [result.invitationId],
    );
    expect(stored.rows[0]?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.rows[0]?.token_hash).not.toContain(token);
    await expect(invitations.activation(token)).resolves.toMatchObject({
      email: targetEmail,
      tenantName: 'Invitations',
      accountExists: true,
    });
    await expect(invitations.create(ownerId, {
      tenantId, email: targetEmail, baseUrl: 'https://app.example.test',
      role: 'member', roleDefinitionIds: [],
    })).rejects.toMatchObject({ code: 'duplicate_pending' });
    await expect(invitations.pending(ownerId, tenantId)).resolves.toHaveLength(1);
    await expect(invitations.pending(outsiderId, tenantId)).rejects.toMatchObject({ code: 'permission_denied' });

    await expect(sessions.acceptInvitation(outsiderId, token)).rejects.toMatchObject({
      code: 'email_mismatch',
    });
    await expect(sessions.acceptInvitation(targetId, token)).resolves.toBe(tenantId);
    await expect(sessions.acceptInvitation(targetId, token)).resolves.toBe(tenantId);
    await expect(invitations.activation(token)).rejects.toMatchObject({ code: 'invalid_request' });
    const membership = await pool.query<{ role: string }>(`
      select role from public.tenant_members where tenant_id=$1 and user_id=$2
    `, [tenantId, targetId]);
    expect(membership.rows[0]?.role).toBe('member');
    const assignment = await pool.query<{ count: string }>(`
      select count(*)::text from public.tenant_role_assignments assignment
      join public.tenant_role_definitions definition on definition.id=assignment.role_definition_id
      where definition.tenant_id=$1 and assignment.user_id=$2 and assignment.revoked_at is null
    `, [tenantId, targetId]);
    expect(assignment.rows[0]?.count).toBe('1');
  });

  it('renouvelle puis revoque une invitation avec le droit can_invite delegue', async () => {
    const delegatedRights = await new PostgresTransactionRunner(pool, 'magrit_api').run(
      { userId: delegatedInviterId, tenantId },
      async (client) => client.query<{ can_invite: boolean; can_manage_members: boolean }>(`
        select magrit.actor_has_capability($1,'can_invite') as can_invite,
               magrit.actor_has_capability($1,'can_manage_members') as can_manage_members
      `, [tenantId]),
    );
    expect(delegatedRights.rows[0]).toEqual({ can_invite: true, can_manage_members: false });
    const created = await invitations.create(delegatedInviterId, {
      tenantId, email: 'future@example.invalid', baseUrl: 'https://app.example.test',
      role: 'member', roleDefinitionIds: [],
    });
    const oldToken = created.link.split('/').at(-1)!;
    const resent = await invitations.resend(delegatedInviterId, created.invitationId, 'https://app.example.test/');
    const newToken = resent.link.split('/').at(-1)!;
    expect(newToken).not.toBe(oldToken);
    await expect(invitations.activation(oldToken)).rejects.toMatchObject({ code: 'invalid_request' });
    await expect(invitations.activation(newToken)).resolves.toMatchObject({ accountExists: false });
    await invitations.revoke(delegatedInviterId, created.invitationId);
    await expect(invitations.activation(newToken)).rejects.toMatchObject({ code: 'invalid_request' });
    const event = await pool.query<{ event_type: string }>(`
      select event_type from public.tenant_member_events
       where tenant_id=$1 and metadata->>'invitation_id'=$2
    `, [tenantId, created.invitationId]);
    expect(event.rows[0]?.event_type).toBe('invitation_revoked');
    expect(sent).toHaveLength(3);
  });
});
