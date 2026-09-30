import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';

const describeIntegration = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1' ? describe : describe.skip;

describeIntegration('Socle commandes — PostgreSQL reel', () => {
  let pool: Pool;
  let transactions: PostgresTransactionRunner;
  const userA = randomUUID() as UserId;
  const userB = randomUUID() as UserId;
  const tenantA = randomUUID() as TenantId;
  const tenantB = randomUUID() as TenantId;
  const shopA = randomUUID();
  const orderA = randomUUID();
  const itemA = randomUUID();

  beforeAll(async () => {
    pool = createPostgresPool();
    transactions = new PostgresTransactionRunner(pool, 'magrit_api');
    await pool.query(
      'insert into public.app_users(id,email_normalized) values($1,$2),($3,$4)',
      [userA, `orders-a-${userA}@example.invalid`, userB, `orders-b-${userB}@example.invalid`],
    );
    await pool.query(
      "insert into public.tenants(id,slug,name) values($1,$2,'Orders A'),($3,$4,'Orders B')",
      [tenantA, `orders-a-${tenantA}`, tenantB, `orders-b-${tenantB}`],
    );
    await pool.query(
      "insert into public.tenant_members(tenant_id,user_id,role) values($1,$2,'owner'),($3,$4,'owner')",
      [tenantA, userA, tenantB, userB],
    );
    await pool.query(
      "insert into public.shops(id,tenant_id,owner_user_id,slug,name) values($1,$2,$3,$4,'Boutique commandes')",
      [shopA, tenantA, userA, `orders-shop-${shopA}`],
    );
  });

  afterAll(async () => {
    if (pool === undefined) return;
    await pool.query('delete from public.tenants where id = any($1::uuid[])', [[tenantA, tenantB]]);
    await pool.query('delete from public.app_users where id = any($1::uuid[])', [[userA, userB]]);
    await pool.end();
  });

  it('initialise les sept statuts et la matrice canonique pour chaque tenant', async () => {
    const statuses = await pool.query<{ count: string }>(
      'select count(*) from public.tenant_order_status_definitions where tenant_id = $1',
      [tenantA],
    );
    const transitions = await pool.query<{ count: string }>(
      'select count(*) from public.tenant_order_status_transitions where tenant_id = $1',
      [tenantA],
    );
    expect(Number(statuses.rows[0]?.count)).toBe(7);
    expect(Number(transitions.rows[0]?.count)).toBe(7);
  });

  it('isole les commandes par tenant avec le contexte RLS', async () => {
    await transactions.run({ tenantId: tenantA, userId: userA }, async (client) => {
      await client.query(`
        insert into public.tenant_orders(id,tenant_id,shop_id,created_by,total_ht)
        values($1,$2,$3,$4,12.50)
      `, [orderA, tenantA, shopA, userA]);
      await client.query(`
        insert into public.tenant_order_items(
          id,order_id,product_label,quantity,unit_price_ht,line_total_ht,price_origin
        ) values($1,$2,'Flyer',1,12.50,12.50,'client_unverified')
      `, [itemA, orderA]);
    });

    await expect(transactions.run({ tenantId: tenantB, userId: userB }, async (client) => (
      await client.query('select id from public.tenant_orders where id = $1', [orderA])
    ).rowCount)).resolves.toBe(0);
  });

  it('interdit une transition sans audit puis fige les lignes hors brouillon', async () => {
    await expect(pool.query(
      "update public.tenant_orders set status = 'validated' where id = $1",
      [orderA],
    )).rejects.toMatchObject({ code: '42501' });

    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query("select set_config('magrit.order_transition','on',true)");
      await client.query("update public.tenant_orders set status = 'validated' where id = $1", [orderA]);
      await client.query(`
        insert into public.tenant_order_status_events(order_id,actor_id,from_status,to_status)
        values($1,$2,'draft','validated')
      `, [orderA, userA]);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }

    await expect(pool.query(
      'update public.tenant_order_items set quantity = 2 where id = $1',
      [itemA],
    )).rejects.toMatchObject({ code: '23514' });
  });
});
