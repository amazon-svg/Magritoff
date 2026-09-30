import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { PostgresShopsRepository } from '../../src/adapters/postgres/shops-repository.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';
import type { ShopAssetStorage } from '../../src/modules/shops/application/shops-repository.ts';

const enabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = enabled ? describe : describe.skip;

class MemoryShopAssets implements ShopAssetStorage {
  removed: string[] = [];
  uploadBrandAsset(shopId: string) { return Promise.resolve(`s3://shop-backgrounds/${shopId}/logo.png`); }
  uploadCustomMockup(shopId: string) { return Promise.resolve(`s3://shop-product-mockups/${shopId}/flyer-front.png`); }
  removeShopAssets(shopId: string) { this.removed.push(shopId); return Promise.resolve(); }
  publicUrl(value: string) { return value.startsWith('s3://') ? `https://assets.example/${value.slice(5)}` : value; }
  reference(value: string) { return value.startsWith('https://assets.example/') ? `s3://${value.slice(23)}` : value; }
}

describeIntegration('PostgresShopsRepository — PostgreSQL reel', () => {
  let pool: Pool;
  let repository: PostgresShopsRepository;
  const assets = new MemoryShopAssets();
  const tenantId = randomUUID() as TenantId;
  const ownerId = randomUUID() as UserId;
  const managerId = randomUUID() as UserId;
  const readerId = randomUUID() as UserId;
  const outsiderId = randomUUID() as UserId;

  beforeAll(async () => {
    pool = createPostgresPool();
    repository = new PostgresShopsRepository(new PostgresTransactionRunner(pool, 'magrit_api'), assets);
    await pool.query(`insert into public.app_users(id,email_normalized) values
      ($1,$2),($3,$4),($5,$6),($7,$8)`, [
      ownerId, `shop-owner-${ownerId}@example.invalid`, managerId, `shop-manager-${managerId}@example.invalid`,
      readerId, `shop-reader-${readerId}@example.invalid`, outsiderId, `shop-outsider-${outsiderId}@example.invalid`,
    ]);
    await pool.query(`insert into public.tenants(id,slug,name) values($1,$2,'Shop integration')`, [tenantId, `shop-${tenantId}`]);
    await pool.query(`insert into public.tenant_members(tenant_id,user_id,role) values
      ($1,$2,'owner'),($1,$3,'member'),($1,$4,'member')`, [tenantId, ownerId, managerId, readerId]);
    await pool.query(`insert into public.tenant_role_assignments(role_definition_id,user_id,assigned_by)
      select id,$2,$3 from public.tenant_role_definitions where tenant_id=$1 and system_key='option_shops'`, [tenantId, managerId, ownerId]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('delete from public.tenants where id=$1', [tenantId]);
    await pool.query('delete from public.app_users where id=any($1::uuid[])', [[ownerId, managerId, readerId, outsiderId]]);
    await pool.end();
  });

  it('applique la capacite can_manage_shops sans bloquer la lecture du tenant', async () => {
    await expect(repository.create(readerId, tenantId, { name: 'Interdite' })).rejects.toMatchObject({ code: 'permission_denied' });
    expect(await repository.list(outsiderId, tenantId)).toEqual([]);
    const created = await repository.create(managerId, tenantId, { name: 'Boutique Alpha', tagline: 'Sur mesure' });
    expect(created).toMatchObject({ tenantId, ownerUserId: managerId, name: 'Boutique Alpha', accessMode: 'invite_only' });
    expect(await repository.list(readerId, tenantId)).toHaveLength(1);
  });

  it('gere produits, prix, visuels et deduplication des produits IA', async () => {
    const shop = (await repository.list(ownerId, tenantId))[0]!;
    const product = await repository.addProduct(ownerId, tenantId, shop.id, {
      productId: null, name: 'Flyer', category: 'Impression', description: '', priceHt: 12.5,
      imageUrl: '', config: { format: 'A5' }, displayOrder: 2, gammeSlug: 'flyers',
    });
    await repository.updateProduct(ownerId, tenantId, shop.id, product.id, { priceHt: 13, displayOrder: 1 });
    expect(await repository.products(readerId, tenantId, shop.id)).toEqual([
      expect.objectContaining({ id: product.id, priceHt: 13, displayOrder: 1 }),
    ]);
    const libraryProductId = randomUUID();
    await pool.query(`insert into public.product_library
      (id,tenant_id,user_id,name,category,description,price_ht,image_url,config)
      values($1,$2,$3,'Produit tarifé','Impression','',12,'','{}')`, [libraryProductId, tenantId, ownerId]);
    await repository.setPricing(ownerId, tenantId, shop.id, libraryProductId, { priceHtOverride: 9.9 });
    expect(await repository.pricing(readerId, tenantId, shop.id)).toEqual([{ libraryProductId, priceHtOverride: 9.9 }]);
    await repository.uploadCustomMockup(ownerId, tenantId, shop.id, {
      templateType: 'flyer', view: 'front', fileName: 'flyer.png', contentType: 'image/png', bytes: new ArrayBuffer(1),
    });
    expect(await repository.customMockups(readerId, tenantId, shop.id)).toEqual([
      expect.objectContaining({ mockupImageUrl: `https://assets.example/shop-product-mockups/${shop.id}/flyer-front.png` }),
    ]);
    const ai = { configHash: 'same-config', name: 'Produit IA', category: 'IA', description: '', priceHt: 20, imageUrl: '', config: { x: 1 }, gammeSlug: null };
    await repository.persistAiProduct(ownerId, tenantId, shop.id, ai);
    await repository.persistAiProduct(ownerId, tenantId, shop.id, { ...ai, priceHt: 25 });
    expect((await repository.products(readerId, tenantId, shop.id)).filter((entry) => entry.name === 'Produit IA')).toEqual([
      expect.objectContaining({ priceHt: 25 }),
    ]);
  });

  it('sert le catalogue public avec controle boutique et produits de bibliotheque', async () => {
    const shop = (await repository.list(ownerId, tenantId))[0]!;
    expect(await repository.publicProbe(shop.slug)).toEqual({ id: shop.id, tenantId, accessMode: 'invite_only' });
    await expect(repository.publicCatalog({ storefront: null }, shop.slug)).rejects.toMatchObject({ code: 'authentication_required' });
    await expect(repository.publicCatalog({ storefront: { kind: 'shop_customer', shopId: randomUUID(), shopCustomerAccountId: randomUUID() } }, shop.slug)).rejects.toMatchObject({ code: 'permission_denied' });
    const libraryId = randomUUID();
    const libraryProductId = randomUUID();
    await pool.query(`insert into public.libraries(id,tenant_id,user_id,name) values($1,$2,$3,'Catalogue public')`, [libraryId, tenantId, ownerId]);
    await pool.query(`insert into public.product_library
      (id,tenant_id,user_id,library_id,name,category,description,price_ht,image_url,config)
      values($1,$2,$3,$4,'Brochure','Impression','Brochure publique',20,'', '{}')`, [libraryProductId, tenantId, ownerId, libraryId]);
    await pool.query('update public.shops set library_ids=array[$2::uuid] where id=$1', [shop.id, libraryId]);
    await repository.setPricing(ownerId, tenantId, shop.id, libraryProductId, { priceHtOverride: 18 });
    const catalog = await repository.publicCatalog({ storefront: { kind: 'shop_customer', shopId: shop.id, shopCustomerAccountId: randomUUID() } }, shop.slug);
    expect(catalog).toMatchObject({ shop: { id: shop.id, slug: shop.slug }, taxRegime: 'metropole_fr' });
    expect(catalog.products).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Flyer', priceHt: 13 }),
      expect.objectContaining({ id: `lib-${libraryProductId}`, name: 'Brochure', priceHt: 18 }),
    ]));
    await pool.query(`update public.shops set access_mode='self_signup' where id=$1`, [shop.id]);
    await expect(repository.publicCatalog({ storefront: null }, shop.slug)).resolves.toMatchObject({ shop: { id: shop.id } });
  });

  it('supprime logiquement la boutique et nettoie ses objets', async () => {
    const shop = (await repository.list(ownerId, tenantId))[0]!;
    const scopedRole = await pool.query<{id:string}>(`insert into public.tenant_role_definitions
      (tenant_id,name,description,capabilities,scope,scope_shop_id,created_by)
      values($1,'Gestion boutique test','','{}','shop',$2,$3) returning id`, [tenantId, shop.id, ownerId]);
    await pool.query(`insert into public.tenant_role_assignments(role_definition_id,user_id,assigned_by)
      values($1,$2,$3)`, [scopedRole.rows[0]!.id, readerId, ownerId]);
    await repository.remove(managerId, tenantId, shop.id);
    expect(await repository.list(ownerId, tenantId)).toEqual([]);
    expect(assets.removed).toContain(shop.id);
    expect((await pool.query('select 1 from public.tenant_role_definitions where id=$1', [scopedRole.rows[0]!.id])).rowCount).toBe(0);
  });
});
