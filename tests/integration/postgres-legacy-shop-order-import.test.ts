import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';

const describeIntegration = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1' ? describe : describe.skip;

describeIntegration('reprise shop_orders — PostgreSQL reel', () => {
  let pool: Pool;
  const ownerId = randomUUID();
  const tenantId = randomUUID();
  const shopId = randomUUID();
  const productId = randomUUID();
  const pendingOrderId = randomUUID();
  const approvedOrderId = randomUUID();
  const createdAt = '2026-05-01T10:20:30.000Z';

  beforeAll(async () => {
    pool = createPostgresPool();
    await pool.query('insert into public.app_users(id,email_normalized) values($1,$2)', [
      ownerId, `legacy-orders-${ownerId}@example.invalid`,
    ]);
    await pool.query("insert into public.tenants(id,slug,name) values($1,$2,'Legacy orders')", [
      tenantId, `legacy-orders-${tenantId}`,
    ]);
    await pool.query("insert into public.tenant_members(tenant_id,user_id,role) values($1,$2,'owner')", [
      tenantId, ownerId,
    ]);
    await pool.query("insert into public.shops(id,tenant_id,owner_user_id,slug,name) values($1,$2,$3,$4,'Legacy shop')", [
      shopId, tenantId, ownerId, `legacy-orders-${shopId}`,
    ]);
    await pool.query(`
      insert into public.product_library(id,tenant_id,user_id,name,price_ht)
      values($1,$2,$3,'Legacy product',8.50)
    `, [productId, tenantId, ownerId]);
  });

  afterAll(async () => {
    if (pool === undefined) return;
    await pool.query('delete from public.legacy_shop_order_imports where tenant_order_id=any($1::uuid[])', [
      [pendingOrderId, approvedOrderId],
    ]);
    await pool.query('delete from public.tenant_orders where tenant_id=$1', [tenantId]);
    await pool.query('delete from public.tenants where id=$1', [tenantId]);
    await pool.query('delete from public.app_users where id=$1', [ownerId]);
    await pool.end();
  });

  it('importe, conserve le snapshot et rejoue idempotemment une commande pending', async () => {
    const parameters = legacyOrder({
      id: pendingOrderId,
      status: 'pending',
      items: [{ name: 'Produit historique', qty: 2, price_ht: 9.95, source_id: 'lib-legacy' }],
    });
    const first = await importOrder(parameters);
    const replay = await importOrder(parameters);
    expect(first).toEqual({ tenant_order_id: pendingOrderId, replayed: false });
    expect(replay).toEqual({ tenant_order_id: pendingOrderId, replayed: true });

    const stored = await pool.query<{
      status: string;
      created_at: Date;
      total_ht: string;
      product_id: string | null;
      quantity: number;
      unit_price_ht: string;
      price_origin: string;
      normalized_email: string;
      source_payload: Record<string, unknown>;
    }>(`
      select orders.status,orders.created_at,orders.total_ht,item.product_id,item.quantity,
             item.unit_price_ht,item.price_origin,account.normalized_email,import.source_payload
        from public.tenant_orders orders
        join public.tenant_order_items item on item.order_id=orders.id
        join public.shop_customer_accounts account on account.id=orders.shop_customer_account_id
        join public.legacy_shop_order_imports import on import.tenant_order_id=orders.id
       where orders.id=$1
    `, [pendingOrderId]);
    expect(stored.rows[0]).toMatchObject({
      status: 'draft',
      total_ht: '19.90',
      product_id: null,
      quantity: 2,
      unit_price_ht: '9.95',
      price_origin: 'legacy',
      normalized_email: 'buyer@example.test',
      source_payload: expect.objectContaining({ customer_phone: '+33123456789', total_ttc: 23.88 }),
    });
    expect(stored.rows[0]!.created_at.toISOString()).toBe(createdAt);
  });

  it('traduit approved, conserve un produit du tenant et écrit un audit de reprise', async () => {
    const result = await importOrder(legacyOrder({
      id: approvedOrderId,
      status: 'approved',
      items: [{
        product_id: productId,
        name: 'Produit catalogue historique',
        qty: 1,
        price_ht: 8.5,
        options: { finish: 'matte' },
      }],
      totalHt: '8.50',
      totalTtc: '10.20',
    }));
    expect(result).toEqual({ tenant_order_id: approvedOrderId, replayed: false });
    const stored = await pool.query(`
      select orders.status,item.product_id,item.clariprint_options,event.to_status,event.metadata
        from public.tenant_orders orders
        join public.tenant_order_items item on item.order_id=orders.id
        join public.tenant_order_status_events event on event.order_id=orders.id
       where orders.id=$1
    `, [approvedOrderId]);
    expect(stored.rows[0]).toMatchObject({
      status: 'validated',
      product_id: productId,
      clariprint_options: { finish: 'matte' },
      to_status: 'validated',
      metadata: { source: 'legacy_shop_orders', source_order_id: approvedOrderId },
    });
  });

  it('refuse une source modifiée après import et un statut inconnu', async () => {
    await expect(importOrder(legacyOrder({
      id: pendingOrderId,
      status: 'pending',
      items: [{ name: 'Contenu modifié', qty: 2, price_ht: 9.95 }],
    }))).rejects.toMatchObject({ code: '23000', message: 'legacy_order_changed_after_import' });
    await expect(importOrder(legacyOrder({
      id: randomUUID(),
      status: 'mystery',
      items: [{ name: 'Inconnu', qty: 1, price_ht: 1 }],
    }))).rejects.toMatchObject({ code: '22023', message: 'legacy_order_unknown_status' });
  });

  it('interdit la fonction de cutover au rôle runtime de l API', async () => {
    const runtime = new PostgresTransactionRunner(pool, 'magrit_api');
    await expect(runtime.run({}, async (client) => client.query(`
      select * from magrit.import_legacy_shop_order(
        $1::uuid,$2::uuid,'Buyer','buyer@example.test','',
        '[{"name":"Flyer","qty":1,"price_ht":1}]'::jsonb,
        1,1,'','pending',clock_timestamp()
      )
    `, [randomUUID(), shopId]))).rejects.toMatchObject({ code: '42501' });
  });

  function legacyOrder(options: {
    id: string;
    status: string;
    items: readonly Record<string, unknown>[];
    totalHt?: string;
    totalTtc?: string;
  }) {
    return [
      options.id,
      shopId,
      'Buyer Legacy',
      ' Buyer@Example.Test ',
      '+33123456789',
      JSON.stringify(options.items),
      options.totalHt ?? '19.90',
      options.totalTtc ?? '23.88',
      'Note historique',
      options.status,
      createdAt,
    ] as const;
  }

  async function importOrder(parameters: readonly unknown[]) {
    return (await pool.query<{
      tenant_order_id: string;
      replayed: boolean;
    }>(`
      select * from magrit.import_legacy_shop_order(
        $1::uuid,$2::uuid,$3::text,$4::text,$5::text,$6::jsonb,
        $7::numeric,$8::numeric,$9::text,$10::text,$11::timestamptz
      )
    `, [...parameters])).rows[0];
  }
});
