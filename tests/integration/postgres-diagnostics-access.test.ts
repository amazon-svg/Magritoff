import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { PostgresDiagnosticsAccessGateway } from '../../src/adapters/postgres/diagnostics-access-gateway.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';

const describeIntegration = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1' ? describe : describe.skip;

describeIntegration('Acces diagnostics et assistant — PostgreSQL reel', () => {
  let pool: Pool;
  let gateway: PostgresDiagnosticsAccessGateway;
  const tenantId = randomUUID() as TenantId;
  const adminId = randomUUID() as UserId;
  const memberId = randomUUID() as UserId;
  const outsiderId = randomUUID() as UserId;

  beforeAll(async () => {
    pool = createPostgresPool();
    gateway = new PostgresDiagnosticsAccessGateway(
      new PostgresTransactionRunner(pool, 'magrit_api'),
    );
    await pool.query(
      'insert into public.app_users(id,email_normalized) values($1,$2),($3,$4),($5,$6)',
      [
        adminId,
        `admin-${adminId}@example.invalid`,
        memberId,
        `member-${memberId}@example.invalid`,
        outsiderId,
        `outside-${outsiderId}@example.invalid`,
      ],
    );
    await pool.query(
      "insert into public.tenants(id,slug,name) values($1,$2,'Diagnostics')",
      [tenantId, `diagnostics-${tenantId}`],
    );
    await pool.query(
      "insert into public.tenant_members(tenant_id,user_id,role) values($1,$2,'owner'),($1,$3,'member')",
      [tenantId, adminId, memberId],
    );
    await pool.query(
      'insert into public.user_preferences(user_id,is_admin) values($1,true)',
      [adminId],
    );
  });

  afterAll(async () => {
    if (pool === undefined) return;
    await pool.query('delete from public.tenants where id = $1', [tenantId]);
    await pool.query('delete from public.app_users where id = any($1::uuid[])', [
      [adminId, memberId, outsiderId],
    ]);
    await pool.end();
  });

  it('reserve les diagnostics a admin plateforme', async () => {
    await expect(gateway.isPlatformAdmin(adminId)).resolves.toBe(true);
    await expect(gateway.isPlatformAdmin(memberId)).resolves.toBe(false);
  });

  it('autorise assistant uniquement aux membres du tenant', async () => {
    await expect(gateway.isTenantMember(memberId, tenantId)).resolves.toBe(true);
    await expect(gateway.isTenantMember(outsiderId, tenantId)).resolves.toBe(false);
  });
});
