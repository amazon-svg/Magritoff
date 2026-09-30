import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import {
  PostgresOrdersRepository,
  type OrdersNotificationGateway,
} from '../../src/adapters/postgres/orders-repository.ts';
import { storefrontTokenHash } from '../../src/adapters/postgres/storefront-authentication-gateway.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';

const describeIntegration = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1' ? describe : describe.skip;
const notifications: OrdersNotificationGateway = {
  transition: async () => undefined,
  created: async () => undefined,
};

describeIntegration('PostgresOrdersRepository — PostgreSQL reel', () => {
  let pool: Pool;
  let repository: PostgresOrdersRepository;
  const ownerId = randomUUID() as UserId;
  const outsiderId = randomUUID() as UserId;
  const tenantId = randomUUID() as TenantId;
  const outsiderTenantId = randomUUID() as TenantId;
  const shopId = randomUUID();
  const libraryId = randomUUID();
  const productId = randomUUID();
  const configuredProductId = randomUUID();
  const accountA = randomUUID();
  const accountB = randomUUID();
  const tokenA = `orders-a-${randomUUID()}`;
  const tokenB = `orders-b-${randomUUID()}`;

  beforeAll(async () => {
    pool = createPostgresPool();
    repository = new PostgresOrdersRepository(
      new PostgresTransactionRunner(pool, 'magrit_api'),
      notifications,
    );
    await pool.query(
      'insert into public.app_users(id,email_normalized) values($1,$2),($3,$4)',
      [
        ownerId, `orders-owner-${ownerId}@example.invalid`,
        outsiderId, `orders-outsider-${outsiderId}@example.invalid`,
      ],
    );
    await pool.query(
      "insert into public.tenants(id,slug,name) values($1,$2,'Orders repository'),($3,$4,'Orders outsider')",
      [tenantId, `orders-repository-${tenantId}`, outsiderTenantId, `orders-outsider-${outsiderTenantId}`],
    );
    await pool.query(
      "insert into public.tenant_members(tenant_id,user_id,role) values($1,$2,'owner'),($3,$4,'owner')",
      [tenantId, ownerId, outsiderTenantId, outsiderId],
    );
    await pool.query(
      "insert into public.shops(id,tenant_id,owner_user_id,slug,name,access_mode,library_ids) values($1,$2,$3,$4,'Orders shop','self_signup',$5)",
      [shopId, tenantId, ownerId, `orders-repository-${shopId}`, [libraryId]],
    );
    await pool.query(
      "insert into public.libraries(id,tenant_id,user_id,name) values($1,$2,$3,'Catalogue commandes')",
      [libraryId, tenantId, ownerId],
    );
    await pool.query(`
      insert into public.product_library(id,tenant_id,user_id,library_id,name,price_ht,config)
      values($1,$3,$4,$5,'Flyer A5',12.50,'{}'::jsonb),
            ($2,$3,$4,$5,'Brochure configuree',30.00,'{"finish":"matte"}'::jsonb)
    `, [productId, configuredProductId, tenantId, ownerId, libraryId]);
    await pool.query(`
      insert into public.shop_customer_accounts(
        id,shop_id,tenant_id,email,normalized_email,full_name,status,activated_at
      ) values
        ($1,$3,$4,'buyer-a@example.test','buyer-a@example.test','Buyer A','active',clock_timestamp()),
        ($2,$3,$4,'buyer-b@example.test','buyer-b@example.test','Buyer B','active',clock_timestamp())
    `, [accountA, accountB, shopId, tenantId]);
    await pool.query(`
      insert into private.shop_customer_sessions(
        shop_customer_account_id,shop_id,token_hash,expires_at
      ) values($1,$3,$4,clock_timestamp()+interval '1 hour'),
              ($2,$3,$5,clock_timestamp()+interval '1 hour')
    `, [accountA, accountB, shopId, storefrontTokenHash(tokenA), storefrontTokenHash(tokenB)]);
  });

  afterAll(async () => {
    if (pool === undefined) return;
    await pool.query('delete from public.tenant_orders where tenant_id=any($1::uuid[])', [[tenantId, outsiderTenantId]]);
    await pool.query('delete from public.tenants where id=any($1::uuid[])', [[tenantId, outsiderTenantId]]);
    await pool.query('delete from public.app_users where id=any($1::uuid[])', [[ownerId, outsiderId]]);
    await pool.end();
  });

  it('cree une commande catalogue Magrit et rejoue le resultat idempotent', async () => {
    const command = {
      shopId,
      currency: 'EUR',
      notes: 'Commande catalogue',
      items: [{
        productId,
        productLabel: 'Flyer A5',
        clariprintOptions: null,
        quantity: 2,
        expectedUnitPriceHt: '12.50',
      }],
      idempotencyKey: `create-${randomUUID()}`,
    } as const;

    const created = await repository.createOrder(command, { kind: 'magrit_user', userId: ownerId });
    const replayed = await repository.createOrder(command, { kind: 'magrit_user', userId: ownerId });

    expect(created).toMatchObject({ tenantId, shopId, totalHt: '25.00', currency: 'EUR', replayed: false });
    expect(replayed).toEqual({ ...created, replayed: true });
    await expect(repository.listTenantOrders(tenantId, outsiderId)).resolves.toEqual([]);
    await expect(repository.listTenantOrders(tenantId, ownerId)).resolves.toEqual([
      expect.objectContaining({ id: created.orderId, totalHt: 25, hasUnverifiedPrices: false }),
    ]);
  });

  it('refuse un prix catalogue obsolete et un produit hors boutique', async () => {
    const base = {
      shopId,
      currency: 'EUR',
      notes: '',
      clariprintOptions: null,
      quantity: 1,
    } as const;
    await expect(repository.createOrder({
      shopId: base.shopId,
      currency: base.currency,
      notes: base.notes,
      items: [{
        productId,
        productLabel: 'Flyer A5',
        clariprintOptions: base.clariprintOptions,
        quantity: base.quantity,
        expectedUnitPriceHt: '11.00',
      }],
      idempotencyKey: `stale-${randomUUID()}`,
    }, { kind: 'magrit_user', userId: ownerId })).rejects.toMatchObject({
      code: 'price_changed',
      priceMismatches: [{ current: '12.50', submitted: '11.00' }],
    });
    await expect(repository.createOrder({
      shopId: base.shopId,
      currency: base.currency,
      notes: base.notes,
      items: [{
        productId: randomUUID(),
        productLabel: 'Hors catalogue',
        clariprintOptions: base.clariprintOptions,
        quantity: base.quantity,
        expectedUnitPriceHt: '10.00',
      }],
      idempotencyKey: `scope-${randomUUID()}`,
    }, { kind: 'magrit_user', userId: ownerId })).rejects.toMatchObject({ code: 'product_not_in_shop' });

    const configured = await repository.createOrder({
      shopId,
      currency: 'EUR',
      notes: '',
      items: [{
        productId: configuredProductId,
        productLabel: 'Brochure brillante',
        clariprintOptions: { finish: 'gloss' },
        quantity: 1,
        expectedUnitPriceHt: '42.00',
      }],
      idempotencyKey: `configured-${randomUUID()}`,
    }, { kind: 'magrit_user', userId: ownerId });
    await expect(repository.getDraftOrder(configured.orderId, {
      storefrontToken: null,
      magritUserId: ownerId,
    })).resolves.toMatchObject({
      totalHt: '42.00',
      hasUnverifiedPrices: true,
      items: [expect.objectContaining({ priceOrigin: 'client_unverified' })],
    });
  });

  it('isole une commande storefront, permet son edition puis son annulation', async () => {
    const created = await repository.createOrder({
      shopId,
      currency: 'EUR',
      notes: 'Commande storefront',
      items: [{
        productId: null,
        productLabel: 'Impression speciale',
        clariprintOptions: null,
        quantity: 1,
        expectedUnitPriceHt: '19.90',
      }],
      idempotencyKey: `storefront-${randomUUID()}`,
    }, { kind: 'storefront_session', opaqueToken: tokenA });
    const authorizationA = { storefrontToken: tokenA, magritUserId: null };

    await expect(repository.getDraftOrder(created.orderId, {
      storefrontToken: tokenB,
      magritUserId: null,
    })).rejects.toMatchObject({ code: 'permission_denied' });
    const draft = await repository.getDraftOrder(created.orderId, authorizationA);
    const updated = await repository.updateDraftOrder(created.orderId, {
      items: [{
        id: draft.items[0]!.id,
        productLabel: 'Impression speciale x2',
        quantity: 2,
        expectedUnitPriceHt: '19.90',
      }],
      idempotencyKey: `update-${randomUUID()}`,
    }, authorizationA);
    expect(updated).toMatchObject({ totalHt: '39.80', replayed: false });

    const portal = await repository.getStorefrontPortalOrders(shopId, tokenA);
    expect(portal.orders).toEqual([
      expect.objectContaining({
        id: created.orderId,
        customerEmail: 'buyer-a@example.test',
        hasUnverifiedPrices: true,
      }),
    ]);
    const transitioned = await repository.transitionOrder(created.orderId, {
      toStatus: 'cancelled',
      reason: 'Annulation client',
      idempotencyKey: `cancel-${randomUUID()}`,
    }, authorizationA);
    expect(transitioned).toMatchObject({ fromStatus: 'draft', toStatus: 'cancelled', replayed: false });
  });

  it('transitionne sous capacite, audite et rejoue sans second evenement', async () => {
    const created = await repository.createOrder({
      shopId,
      currency: 'EUR',
      notes: '',
      items: [{
        productId,
        productLabel: 'Flyer A5',
        clariprintOptions: null,
        quantity: 1,
        expectedUnitPriceHt: '12.50',
      }],
      idempotencyKey: `transition-order-${randomUUID()}`,
    }, { kind: 'magrit_user', userId: ownerId });
    const command = {
      toStatus: 'validated',
      reason: null,
      idempotencyKey: `transition-${randomUUID()}`,
    } as const;
    const authorization = { storefrontToken: null, magritUserId: ownerId };

    const transitioned = await repository.transitionOrder(created.orderId, command, authorization);
    const replayed = await repository.transitionOrder(created.orderId, command, authorization);
    expect(replayed).toEqual({ ...transitioned, replayed: true });
    await expect(repository.listAuditEvents(created.orderId, authorization)).resolves.toEqual([
      expect.objectContaining({
        orderId: created.orderId,
        kind: 'status',
        eventType: 'status_transition',
        actorId: ownerId,
      }),
    ]);
  });
});
