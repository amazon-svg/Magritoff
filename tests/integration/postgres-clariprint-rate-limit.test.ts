import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { PostgresClariprintQuoteBudgetRepository } from '../../src/adapters/postgres/clariprint-quote-budget-repository.ts';
import { PostgresClariprintQuoteMembershipGateway } from '../../src/adapters/postgres/clariprint-quote-membership-gateway.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';

const describeIntegration = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1' ? describe : describe.skip;

describeIntegration('Quota Clariprint — PostgreSQL reel', () => {
  let pool: Pool;
  let budget: PostgresClariprintQuoteBudgetRepository;
  let membership: PostgresClariprintQuoteMembershipGateway;
  const tenantId = randomUUID() as TenantId;
  const memberId = randomUUID() as UserId;
  const outsiderId = randomUUID() as UserId;

  beforeAll(async () => {
    pool = createPostgresPool();
    const transactions = new PostgresTransactionRunner(pool, 'magrit_api');
    budget = new PostgresClariprintQuoteBudgetRepository(transactions);
    membership = new PostgresClariprintQuoteMembershipGateway(transactions);
    await pool.query(
      'insert into public.app_users(id,email_normalized) values($1,$2),($3,$4)',
      [
        memberId,
        `clariprint-member-${memberId}@example.invalid`,
        outsiderId,
        `clariprint-outsider-${outsiderId}@example.invalid`,
      ],
    );
    await pool.query(
      "insert into public.tenants(id,slug,name) values($1,$2,'Clariprint')",
      [tenantId, `clariprint-${tenantId}`],
    );
    await pool.query(
      "insert into public.tenant_members(tenant_id,user_id,role) values($1,$2,'member')",
      [tenantId, memberId],
    );
  });

  afterAll(async () => {
    if (pool === undefined) return;
    await pool.query(`
      update public.api_rate_limits
         set max_hits = case scope
           when 'clariprint_quote_visitor' then 30
           when 'clariprint_quote_member' then 120
           else 500
         end
    `);
    await pool.query(
      "delete from public.api_rate_limit_counters where key_hash in ($1,$2,$3,'global')",
      [`user:${memberId}`, 'ip:test-visitor-a', 'ip:test-visitor-b'],
    );
    await pool.query('delete from public.tenants where id = $1', [tenantId]);
    await pool.query('delete from public.app_users where id = any($1::uuid[])', [[memberId, outsiderId]]);
    await pool.end();
  });

  it('classe comme membre uniquement un utilisateur rattache a un tenant', async () => {
    await expect(membership.isMember(memberId)).resolves.toBe(true);
    await expect(membership.isMember(outsiderId)).resolves.toBe(false);
  });

  it('consomme puis refuse atomiquement le quota membre', async () => {
    await pool.query(
      "update public.api_rate_limits set max_hits = 1 where scope = 'clariprint_quote_member'",
    );
    await pool.query(
      "delete from public.api_rate_limit_counters where scope = 'clariprint_quote_member' and key_hash = $1",
      [`user:${memberId}`],
    );

    await expect(budget.consume({ kind: 'member', key: `user:${memberId}` }))
      .resolves.toEqual({ allowed: true });
    await expect(budget.consume({ kind: 'member', key: `user:${memberId}` }))
      .resolves.toEqual({ allowed: false, refusedScope: 'member' });
  });

  it('applique le plafond public partage aux visiteurs', async () => {
    await pool.query(
      "update public.api_rate_limits set max_hits = 1 where scope = 'clariprint_quote_public_daily'",
    );
    await pool.query(
      "delete from public.api_rate_limit_counters where scope = 'clariprint_quote_public_daily'",
    );

    await expect(budget.consume({ kind: 'visitor', key: 'ip:test-visitor-a' }))
      .resolves.toEqual({ allowed: true });
    await expect(budget.consume({ kind: 'visitor', key: 'ip:test-visitor-b' }))
      .resolves.toEqual({ allowed: false, refusedScope: 'public' });
  });
});
