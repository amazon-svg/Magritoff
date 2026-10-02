import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { PostgresMembersRepository } from '../../src/adapters/postgres/members-repository.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';

const integrationEnabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('PostgresMembersRepository — PostgreSQL reel', () => {
  let pool: Pool;
  let repository: PostgresMembersRepository;
  const tenantId = randomUUID() as TenantId;
  const adminId = randomUUID() as UserId;
  const secondAdminId = randomUUID() as UserId;
  const memberId = randomUUID() as UserId;
  const outsiderId = randomUUID() as UserId;

  beforeAll(async () => {
    pool = createPostgresPool();
    repository = new PostgresMembersRepository(new PostgresTransactionRunner(pool, 'magrit_api'));
    await pool.query(`
      insert into public.app_users (id,email_normalized,display_name) values
        ($1,$2,'Owner'),($3,$4,'Admin'),($5,$6,'Member'),($7,$8,'Outsider')
    `, [
      adminId, `owner-${adminId}@example.invalid`,
      secondAdminId, `admin-${secondAdminId}@example.invalid`,
      memberId, `member-${memberId}@example.invalid`,
      outsiderId, `outsider-${outsiderId}@example.invalid`,
    ]);
    await pool.query(`insert into public.tenants (id,slug,name) values ($1,$2,'Members Integration')`,
      [tenantId, `members-${tenantId}`]);
    await pool.query(`
      insert into public.tenant_members (tenant_id,user_id,role) values
        ($1,$2,'owner'),($1,$3,'admin'),($1,$4,'member')
    `, [tenantId, adminId, secondAdminId, memberId]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('delete from public.tenants where id=$1', [tenantId]);
    await pool.query('delete from public.app_users where id=any($1::uuid[])', [
      [adminId, secondAdminId, memberId, outsiderId],
    ]);
    await pool.end();
  });

  it('liste les membres avec leur identite Magrit et les valeurs d acces portables', async () => {
    const members = await repository.list(memberId, tenantId);
    expect(members).toHaveLength(3);
    expect(members.find((member) => member.userId === adminId)).toMatchObject({
      role: 'admin',
      accessScope: 'magrit_full',
      allowedShopIds: [],
      permissions: { canQuote: true, canOrder: true, canInvite: false },
    });
    await expect(repository.list(outsiderId, tenantId)).rejects.toMatchObject({
      name: 'MemberRejectedError',
      code: 'permission_denied',
    });
  });

  it('modifie role et acces atomiquement avec un journal explicite', async () => {
    await repository.changeRole(adminId, tenantId, memberId, { role: 'admin' });
    await repository.updateAccess(adminId, tenantId, memberId, {
      accessScope: 'magrit_full',
      allowedShopIds: [],
      permissions: { canQuote: true, canOrder: false, canInvite: true },
    });
    const member = (await repository.list(adminId, tenantId)).find((entry) => entry.userId === memberId);
    expect(member).toMatchObject({
      role: 'admin',
      permissions: { canQuote: true, canOrder: false, canInvite: true },
    });
    const events = await pool.query(`
      select event_type,performed_by,metadata from public.tenant_member_events
       where tenant_id=$1 and target_user_id=$2 order by created_at,id
    `, [tenantId, memberId]);
    expect(events.rows).toEqual([
      expect.objectContaining({ event_type: 'role_changed', performed_by: adminId }),
      expect.objectContaining({ event_type: 'access_changed', performed_by: adminId }),
    ]);
  });

  it('refuse les mutations par un non-admin et protege le dernier administrateur', async () => {
    await repository.changeRole(adminId, tenantId, memberId, { role: 'member' });
    await expect(repository.remove(memberId, tenantId, secondAdminId)).rejects.toMatchObject({
      code: 'permission_denied',
    });
    await repository.remove(adminId, tenantId, secondAdminId);
    await expect(repository.changeRole(adminId, tenantId, adminId, { role: 'member' }))
      .rejects.toMatchObject({ code: 'last_admin_protected' });
    await expect(repository.remove(adminId, tenantId, adminId))
      .rejects.toMatchObject({ code: 'last_admin_protected' });
  });
});
