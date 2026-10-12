import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createPostgresPool } from '../../src/adapters/postgres/pool';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner';
import { PostgresShopsRepository } from '../../src/adapters/postgres/shops-repository';
import { PostgresLibraryProductsRepository } from '../../src/adapters/postgres/library-products-repository';
import { LibraryProductsService } from '../../src/modules/libraries/application/library-products-service';
import { PostgresOrdersRepository } from '../../src/adapters/postgres/orders-repository';
import { storefrontTokenHash } from '../../src/adapters/postgres/storefront-authentication-gateway';
import type { UserId, TenantId } from '../../src/kernel/ids';

const integration = process.env.MAGRIT_POSTGRES_INTEGRATION === '1' ? describe : describe.skip;
integration('Prix unitaire fixe — coût, marge, publication et commande PostgreSQL', () => {
  let pool: Pool;
  let products: LibraryProductsService;
  let shops: PostgresShopsRepository;
  let orders: PostgresOrdersRepository;
  let productId: string;
  const tenantId = randomUUID() as TenantId;
  const ownerId = randomUUID() as UserId;
  const libraryId = randomUUID();
  const shopId = randomUUID();
  const accountId = randomUUID();
  const ruleId = randomUUID();
  const rangeId = randomUUID();
  const slug = `fixed-${shopId}`;
  const token = `fixed-${randomUUID()}`;
  const config = { pricing_mode: 'fixed_unit' };
  const access = { storefront: { kind: 'shop_customer' as const, shopId, shopCustomerAccountId: accountId } };
  const auth = { kind: 'storefront_session' as const, opaqueToken: token };

  beforeAll(async () => {
    pool = createPostgresPool();
    const tx = new PostgresTransactionRunner(pool, 'magrit_api');
    products = new LibraryProductsService(new PostgresLibraryProductsRepository(tx));
    shops = new PostgresShopsRepository(tx, { publicUrl: (v) => v, reference: (v) => v,
      uploadBrandAsset: async () => '', uploadCustomMockup: async () => '', removeShopAssets: async () => {} });
    orders = new PostgresOrdersRepository(tx, { created: async () => {}, transition: async () => {} });
    await pool.query('insert into public.app_users(id,email_normalized) values($1,$2)', [ownerId, `fixed-${ownerId}@example.invalid`]);
    await pool.query("insert into public.tenants(id,slug,name) values($1,$2,'Prix fixe')", [tenantId, `fixed-${tenantId}`]);
    await pool.query("insert into public.tenant_members(tenant_id,user_id,role) values($1,$2,'owner')", [tenantId, ownerId]);
    await pool.query("insert into public.libraries(id,tenant_id,user_id,name) values($1,$2,$3,'Articles fixes')", [libraryId, tenantId, ownerId]);
    await pool.query("insert into public.shops(id,tenant_id,owner_user_id,slug,name,access_mode,library_ids) values($1,$2,$3,$4,'Boutique fixe','self_signup',$5)", [shopId, tenantId, ownerId, slug, [libraryId]]);
    await pool.query("insert into public.product_gammes(id,slug,name) values($1,$2,'Articles fixes')", [rangeId, `fixed-${rangeId}`]);
    await pool.query("insert into public.price_rules(id,tenant_id,name,scope,value_type,value,valid_from,created_by) values($1,$2,'Marge globale','global','margin_rate',.25,'2026-01-01',$3)", [ruleId, tenantId, ownerId]);
    await pool.query("insert into public.shop_customer_accounts(id,shop_id,tenant_id,email,normalized_email,full_name,status,activated_at) values($1,$2,$3,$4,$4,'Acheteur fixe','active',clock_timestamp())", [accountId, shopId, tenantId, `fixed-${accountId}@example.invalid`]);
    await pool.query("insert into private.shop_customer_sessions(shop_customer_account_id,shop_id,token_hash,expires_at) values($1,$2,$3,clock_timestamp()+interval '1 hour')", [accountId, shopId, storefrontTokenHash(token)]);
  });
  afterAll(async () => {
    if (!pool) return;
    await pool.query('delete from public.tenant_orders where tenant_id=$1', [tenantId]);
    await pool.query('delete from public.tenants where id=$1', [tenantId]);
    await pool.query('delete from public.app_users where id=$1', [ownerId]);
    await pool.query('delete from public.product_gammes where id=$1', [rangeId]);
    await pool.end();
  });
  const input = () => ({ library_id: libraryId, name: 'Article unitaire', category: 'Articles fixes', description: '',
    price_ht: 100, image_url: '', config, active: true, gamme_slug: `fixed-${rangeId}` });
  const command = (price = '125.00', quantity = 3) => ({ shopId, currency: 'EUR', notes: '',
    items: [{ productId, productLabel: 'Article unitaire', clariprintOptions: config, quantity, expectedUnitPriceHt: price }],
    idempotencyKey: randomUUID() });

  it('crée une fiche à coût fixe et refuse les coûts nuls ou au sous-centime', async () => {
    await expect(products.create(ownerId, tenantId, { ...input(), price_ht: 0 })).rejects.toMatchObject({ code: 'invalid_product' });
    await expect(products.create(ownerId, tenantId, { ...input(), price_ht: 1.001 })).rejects.toMatchObject({ code: 'invalid_product' });
    const product = await products.create(ownerId, tenantId, input());
    productId = product.id;
    expect(product).toMatchObject({ price_ht: 100, config, library_id: libraryId });
    await expect(products.update(ownerId, tenantId, productId, { price_ht: 0 })).rejects.toMatchObject({ code: 'invalid_product' });
  });
  it('publie le prix de vente margé, sans modifier le coût du back-office', async () => {
    const catalog = await shops.publicCatalog({ storefront: null }, slug);
    expect(catalog.products).toEqual([expect.objectContaining({ productId, priceHt: 125, config })]);
    expect((await products.list(ownerId, tenantId)).find((p) => p.id === productId)?.price_ht).toBe(100);
  });
  it('commande trois unités au prix margé et les retrouve dans le back-office', async () => {
    const request = command();
    const created = await orders.createOrder(request, auth);
    expect(created.totalHt).toBe('375.00');
    expect(await orders.createOrder(request, auth)).toMatchObject({ orderId: created.orderId, replayed: true });
    const rows = await orders.listTenantOrders(tenantId, ownerId);
    expect(rows).toContainEqual(expect.objectContaining({ id: created.orderId, totalHt: 375, hasUnverifiedPrices: false,
      items: [expect.objectContaining({ quantity: 3, unitPriceHt: 125, priceOrigin: 'catalog' })] }));
  });
  it('refuse un prix forgé même si les options envoyées sont modifiées', async () => {
    const request = command('0.01');
    request.items[0].clariprintOptions = { pricing_mode: 'configurable' };
    await expect(orders.createOrder(request, auth)).rejects.toMatchObject({ code: 'price_changed' });
  });
  it('refuse le prix périmé après changement de marge', async () => {
    await pool.query('update public.price_rules set value=.40 where id=$1', [ruleId]);
    expect((await shops.publicCatalog(access, slug)).products[0].priceHt).toBe(140);
    await expect(orders.createOrder(command(), auth)).rejects.toMatchObject({ code: 'price_changed' });
  });
  it('applique la règle de catégorie avant la règle globale', async () => {
    await pool.query("insert into public.price_rules(tenant_id,name,scope,product_range_id,value_type,value,valid_from,created_by) values($1,'Marge catégorie','range',$2,'margin_rate',.30,'2026-01-01',$3)", [tenantId, rangeId, ownerId]);
    expect((await shops.publicCatalog(access, slug)).products[0].priceHt).toBe(130);
    expect((await orders.createOrder(command('130.00', 2), auth)).totalHt).toBe('260.00');
  });
  it('applique la remise client sur la marge par défaut sans altérer le catalogue anonyme', async () => {
    const customerId = randomUUID(), contactId = randomUUID(), customerRuleId = randomUUID();
    await pool.query("insert into public.customers(id,tenant_id,type,civility,first_name,last_name,created_by) values($1,$2,'individual','mr','Client','Fixe',$3)", [customerId, tenantId, ownerId]);
    await pool.query("insert into public.customer_contacts(id,customer_id,first_name,last_name,email) values($1,$2,'Client','Fixe','fixe@example.invalid')", [contactId, customerId]);
    await pool.query('update public.shop_customer_accounts set customer_contact_id=$2 where id=$1', [accountId, contactId]);
    await pool.query('insert into public.product_range_default_margins(tenant_id,product_range_id,margin_rate,updated_by) values($1,$2,.20,$3)', [tenantId, rangeId, ownerId]);
    await pool.query("insert into public.price_rules(id,tenant_id,name,scope,customer_id,value_type,value,valid_from,created_by) values($1,$2,'Remise client','customer',$3,'discount_rate',.10,'2026-01-01',$4)", [customerRuleId, tenantId, customerId, ownerId]);
    expect((await shops.publicCatalog(access, slug)).products[0].priceHt).toBe(108);
    expect((await shops.publicCatalog({ storefront: null }, slug)).products[0].priceHt).toBe(130);
    expect((await orders.createOrder(command('108.00', 2), auth)).totalHt).toBe('216.00');
    await pool.query('delete from public.price_rules where id=$1', [customerRuleId]);
    await pool.query('update public.shop_customer_accounts set customer_contact_id=null where id=$1', [accountId]);
    await pool.query('delete from public.customers where id=$1', [customerId]);
  });
  it('ne publie pas un produit inactif et refuse sa commande', async () => {
    await products.update(ownerId, tenantId, productId, { active: false });
    expect((await shops.publicCatalog(access, slug)).products).toEqual([]);
    await expect(orders.createOrder(command('130.00'), auth)).rejects.toMatchObject({ code: 'product_not_in_shop' });
    await products.update(ownerId, tenantId, productId, { active: true });
  });
  it('conserve le prix de vente explicite d’une boutique sans lui appliquer une seconde marge', async () => {
    await shops.setPricing(ownerId, tenantId, shopId, productId, { priceHtOverride: 120.5 });
    expect((await shops.publicCatalog(access, slug)).products[0].priceHt).toBe(120.5);
    expect((await orders.createOrder(command('120.50', 2), auth)).totalHt).toBe('241.00');
    await shops.setPricing(ownerId, tenantId, shopId, productId, { priceHtOverride: null });
  });
  it('ne publie pas et ne commande pas un produit exclu de la boutique', async () => {
    await shops.update(ownerId, tenantId, shopId, { excludedProductIds: [productId] });
    expect((await shops.publicCatalog(access, slug)).products).toEqual([]);
    await expect(orders.createOrder(command('130.00'), auth)).rejects.toMatchObject({ code: 'product_not_in_shop' });
  });
});
