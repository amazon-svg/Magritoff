import type { PoolClient } from 'pg';
import { resolveFixedStorefrontPrice } from './storefront-fixed-pricing.ts';
import { isFixedPriceProduct } from '../../modules/libraries/index.ts';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import type {
  CreateShopCommand, CreateShopProductCommand, MockupTemplateType, MockupView,
  PersistAiShopProductCommand, PublicShopCatalog, PublicShopProbe, SetShopPricingCommand,
  ShopBrandAssetUpload, ShopCustomMockup, ShopCustomMockupUpload, ShopDto,
  ShopPricingOverride, ShopProductDto, UpdateShopCommand, UpdateShopProductCommand,
} from '../../modules/shops/api/contracts.ts';
import { shopTaxRegimeSchema } from '../../modules/shops/api/contracts.ts';
import {
  ShopRejectedError,
  type PublicShopCatalogAccess,
  type ShopAssetStorage,
  type ShopsRepository,
} from '../../modules/shops/application/shops-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type Row = Record<string, unknown>;
const DEFAULT_THEME = { primaryColor: '#1e3a8a', accentColor: '#f59e0b', mode: 'dark' as const, secondaryColor: '#6b7280', textColor: '#0f172a', bgColor: '#ffffff', fontPairing: 'system' };
const SHOP_COLUMNS = 'id,tenant_id,owner_user_id,slug,name,description,theme,logo_url,address,contact_email,active,library_ids,excluded_product_ids,hero_image_url,tagline,pim_catalog_mode,pim_gamme_slugs,access_mode,created_at';
const PRODUCT_COLUMNS = 'id,shop_id,product_id,name,category,description,price_ht,image_url,config,display_order,created_at,tenant_id,gamme_slug';

export class PostgresShopsRepository implements ShopsRepository {
  constructor(private readonly tx: PostgresTransactionRunner, private readonly storage: ShopAssetStorage) {}

  list(actor: UserId, tenantId: string): Promise<ShopDto[]> {
    return this.read(actor, tenantId, async (client) => (await client.query<Row>(
      `select ${SHOP_COLUMNS} from public.shops where tenant_id=$1 and deleted_at is null order by created_at desc,id`, [tenantId],
    )).rows.map((row) => mapShop(row, this.storage)));
  }

  create(actor: UserId, tenantId: string, command: CreateShopCommand): Promise<ShopDto> {
    return this.write(actor, tenantId, async (client) => {
      const result = await client.query<Row>(`insert into public.shops
        (tenant_id,owner_user_id,slug,name,description,theme,logo_url,address,contact_email,hero_image_url,tagline)
        values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11) returning ${SHOP_COLUMNS}`, [
        tenantId, actor, slug(), command.name, command.description ?? '',
        JSON.stringify({ ...DEFAULT_THEME, ...(command.theme ?? {}) }),
        this.storage.reference(command.logoUrl ?? ''), command.address ?? '', command.contactEmail ?? '',
        command.heroImageUrl === null || command.heroImageUrl === undefined ? null : this.storage.reference(command.heroImageUrl),
        command.tagline ?? null,
      ]);
      return mapShop(result.rows[0]!, this.storage);
    });
  }

  update(actor: UserId, tenantId: string, shopId: string, command: UpdateShopCommand): Promise<ShopDto> {
    return this.write(actor, tenantId, async (client) => {
      await requireShop(client, tenantId, shopId);
      const patch = shopPatch(command, this.storage);
      const names = Object.keys(patch);
      const values = Object.values(patch);
      const assignments = names.map((name, index) => `${name}=$${index + 3}`).join(',');
      const result = await client.query<Row>(
        `update public.shops set ${assignments} where tenant_id=$1 and id=$2 and deleted_at is null returning ${SHOP_COLUMNS}`,
        [tenantId, shopId, ...values],
      );
      if (!result.rows[0]) throw reject('shop_not_found', 'Boutique introuvable.');
      return mapShop(result.rows[0], this.storage);
    });
  }

  async remove(actor: UserId, tenantId: string, shopId: string): Promise<void> {
    await this.write(actor, tenantId, async (client) => {
      await requireShop(client, tenantId, shopId);
      await client.query('select magrit.remove_shop_scoped_roles($1,$2)', [tenantId, shopId]);
      await client.query('delete from public.shop_products where tenant_id=$1 and shop_id=$2', [tenantId, shopId]);
      await client.query('delete from public.shop_product_pricing where tenant_id=$1 and shop_id=$2', [tenantId, shopId]);
      await client.query('delete from public.shop_template_mockups where tenant_id=$1 and shop_id=$2', [tenantId, shopId]);
      await client.query('delete from public.shop_customer_accounts where tenant_id=$1 and shop_id=$2', [tenantId, shopId]);
      await client.query(`update public.shops set active=false,deleted_at=clock_timestamp(),name='[Boutique supprimée]',
        description='',logo_url='',address='',contact_email='',hero_image_url=null,tagline=null,library_ids='{}',
        excluded_product_ids='{}',pim_catalog_mode=false,pim_gamme_slugs='{}' where tenant_id=$1 and id=$2`, [tenantId, shopId]);
    });
    try { await this.storage.removeShopAssets(shopId); }
    catch (error) { console.warn(`[Shops] nettoyage S3 incomplet pour ${shopId}: ${message(error)}`); }
  }

  products(actor: UserId, tenantId: string, shopId: string): Promise<ShopProductDto[]> {
    return this.read(actor, tenantId, async (client) => {
      await requireShop(client, tenantId, shopId);
      return (await client.query<Row>(`select ${PRODUCT_COLUMNS} from public.shop_products
        where tenant_id=$1 and shop_id=$2 order by display_order,id`, [tenantId, shopId])).rows.map(mapProduct);
    });
  }

  addProduct(actor: UserId, tenantId: string, shopId: string, command: CreateShopProductCommand): Promise<ShopProductDto> {
    return this.write(actor, tenantId, async (client) => {
      await requireShop(client, tenantId, shopId);
      const result = await client.query<Row>(`insert into public.shop_products
        (tenant_id,shop_id,product_id,name,category,description,price_ht,image_url,config,display_order,gamme_slug)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11) returning ${PRODUCT_COLUMNS}`, [
        tenantId, shopId, command.productId, command.name, command.category, command.description,
        command.priceHt, command.imageUrl, JSON.stringify(command.config), command.displayOrder, command.gammeSlug,
      ]);
      return mapProduct(result.rows[0]!);
    });
  }

  updateProduct(actor: UserId, tenantId: string, shopId: string, productId: string, command: UpdateShopProductCommand): Promise<void> {
    return this.write(actor, tenantId, async (client) => {
      await requireShop(client, tenantId, shopId);
      const patch = productPatch(command); const names = Object.keys(patch); const values = Object.values(patch);
      const result = await client.query(`update public.shop_products set ${names.map((name, i) => `${name}=$${i + 4}`).join(',')}
        where tenant_id=$1 and shop_id=$2 and id=$3`, [tenantId, shopId, productId, ...values]);
      if (result.rowCount !== 1) throw reject('product_not_found', 'Produit de boutique introuvable.');
    });
  }

  removeProduct(actor: UserId, tenantId: string, shopId: string, productId: string): Promise<void> {
    return this.write(actor, tenantId, async (client) => {
      await requireShop(client, tenantId, shopId);
      const result = await client.query('delete from public.shop_products where tenant_id=$1 and shop_id=$2 and id=$3', [tenantId, shopId, productId]);
      if (result.rowCount !== 1) throw reject('product_not_found', 'Produit de boutique introuvable.');
    });
  }

  pricing(actor: UserId, tenantId: string, shopId: string): Promise<ShopPricingOverride[]> {
    return this.read(actor, tenantId, async (client) => {
      await requireShop(client, tenantId, shopId);
      const rows = (await client.query<{library_product_id:string;price_ht_override:string}>(
        'select library_product_id,price_ht_override from public.shop_product_pricing where tenant_id=$1 and shop_id=$2 order by library_product_id', [tenantId, shopId],
      )).rows;
      return rows.map((row) => ({ libraryProductId: row.library_product_id, priceHtOverride: Number(row.price_ht_override) }));
    });
  }

  setPricing(actor: UserId, tenantId: string, shopId: string, libraryProductId: string, command: SetShopPricingCommand): Promise<void> {
    return this.write(actor, tenantId, async (client) => {
      await requireShop(client, tenantId, shopId);
      if (command.priceHtOverride === null) {
        await client.query('delete from public.shop_product_pricing where tenant_id=$1 and shop_id=$2 and library_product_id=$3', [tenantId, shopId, libraryProductId]);
      } else {
        await client.query(`insert into public.shop_product_pricing(tenant_id,shop_id,library_product_id,price_ht_override)
          values($1,$2,$3,$4) on conflict(shop_id,library_product_id) do update
          set price_ht_override=excluded.price_ht_override,updated_at=clock_timestamp()`, [tenantId, shopId, libraryProductId, command.priceHtOverride]);
      }
    });
  }

  async uploadBrandAsset(actor: UserId, tenantId: string, shopId: string, upload: ShopBrandAssetUpload): Promise<string> {
    await this.write(actor, tenantId, (client) => requireShop(client, tenantId, shopId));
    return this.storage.publicUrl(await this.storage.uploadBrandAsset(shopId, upload));
  }

  customMockups(actor: UserId, tenantId: string, shopId: string): Promise<ShopCustomMockup[]> {
    return this.read(actor, tenantId, async (client) => {
      await requireShop(client, tenantId, shopId);
      return (await client.query<Row>(`select shop_id,template_type,view,mockup_image_url from public.shop_template_mockups
        where tenant_id=$1 and shop_id=$2 order by template_type,view`, [tenantId, shopId])).rows.map((row) => mapMockup(row, this.storage));
    });
  }

  async uploadCustomMockup(actor: UserId, tenantId: string, shopId: string, upload: ShopCustomMockupUpload): Promise<void> {
    await this.write(actor, tenantId, (client) => requireShop(client, tenantId, shopId));
    const reference = await this.storage.uploadCustomMockup(shopId, upload);
    await this.write(actor, tenantId, async (client) => {
      await requireShop(client, tenantId, shopId);
      await client.query(`insert into public.shop_template_mockups(tenant_id,shop_id,template_type,view,mockup_image_url)
        values($1,$2,$3,$4,$5) on conflict(shop_id,template_type,view) do update
        set mockup_image_url=excluded.mockup_image_url,updated_at=clock_timestamp()`, [tenantId, shopId, upload.templateType, upload.view, reference]);
    });
  }

  restoreCustomMockup(actor: UserId, tenantId: string, shopId: string, templateType: MockupTemplateType, view: MockupView): Promise<void> {
    return this.write(actor, tenantId, async (client) => {
      await requireShop(client, tenantId, shopId);
      await client.query('delete from public.shop_template_mockups where tenant_id=$1 and shop_id=$2 and template_type=$3 and view=$4', [tenantId, shopId, templateType, view]);
    });
  }

  persistAiProduct(actor: UserId, tenantId: string, shopId: string, command: PersistAiShopProductCommand): Promise<void> {
    return this.write(actor, tenantId, async (client) => {
      await requireShop(client, tenantId, shopId);
      await client.query(`insert into public.shop_products
        (tenant_id,shop_id,name,category,description,price_ht,image_url,config,gamme_slug,origin,config_hash)
        values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,'ai',$10)
        on conflict(shop_id,config_hash) where config_hash is not null do update set
        name=excluded.name,category=excluded.category,description=excluded.description,price_ht=excluded.price_ht,
        image_url=excluded.image_url,config=excluded.config,gamme_slug=excluded.gamme_slug`, [tenantId, shopId, command.name, command.category, command.description, command.priceHt, command.imageUrl, JSON.stringify(command.config), command.gammeSlug, command.configHash.trim()]);
    });
  }

  publicProbe(slug: string): Promise<PublicShopProbe> { return this.tx.run({}, async (client) => {
    const row = (await client.query<{id:string;tenant_id:string;access_mode:string}>('select * from magrit.public_shop_probe($1)', [slug])).rows[0];
    if (!row) throw reject('shop_not_found', 'Boutique introuvable.');
    return { id:row.id,tenantId:row.tenant_id,accessMode:row.access_mode==='self_signup'?'self_signup':'invite_only' };
  }); }
  async publicCatalog(access: PublicShopCatalogAccess, slug: string): Promise<PublicShopCatalog> {
    const probe=await this.publicProbe(slug);
    if(probe.accessMode!=='self_signup'&&access.storefront?.shopId!==probe.id){
      const code=access.storefront?'permission_denied':'authentication_required';
      throw reject(code,code==='permission_denied'?'La session appartient à une autre boutique.':'Authentification boutique requise.');
    }
    return this.tx.run({},async client=>{
      const payload=(await client.query<{catalog:CatalogPayload|null}>('select magrit.public_shop_catalog_data($1) catalog',[slug])).rows[0]?.catalog;
      if(!payload)throw reject('shop_not_found','Boutique introuvable.');
      const manual=payload.products.map(mapProduct);
      const linkedIds=new Set(manual.map(product=>product.productId).filter((id):id is string=>id!==null));
      const pricing=new Map(payload.pricing.map(row=>[String(row['library_product_id']),Number(row['price_ht_override'])]));
      const library=payload.libraryProducts.filter(row=>!linkedIds.has(String(row['id']))).map(row=>({
        id:`lib-${String(row['id'])}`,shopId:probe.id,productId:String(row['id']),name:String(row['name']),
        category:String(row['category']??'Autres'),description:String(row['description']??''),
        priceHt:pricing.get(String(row['id']))??Number(row['price_ht']),imageUrl:String(row['image_url']??''),
        config:record(row['config']),displayOrder:0,createdAt:iso(row['created_at']),tenantId:String(row['tenant_id']),
        gammeSlug:row['gamme_slug']===null?null:String(row['gamme_slug']),
      }));
      const pricedManual=manual.map(product=>product.productId&&pricing.has(product.productId)?{...product,priceHt:pricing.get(product.productId)!}:product);
      const products = [...pricedManual, ...library];
      for (const product of products) {
        if (!isFixedPriceProduct(product) || !product.productId) continue;
        const fixed = await resolveFixedStorefrontPrice(client, probe.id, product.productId,
          access.storefront?.shopId === probe.id ? access.storefront.shopCustomerAccountId : null);
        if (fixed) product.priceHt = Number(fixed.price);
      }
      return {shop:mapPublicShop(payload.shop,this.storage),taxRegime:shopTaxRegimeSchema.parse(payload.taxRegime),products,gammes:payload.gammes as PublicShopCatalog['gammes'],definitions:payload.definitions,subscribedSlugs:payload.subscribedSlugs,customMockups:payload.customMockups.map(row=>mapMockup(row,this.storage))};
    });
  }

  private read<T>(actor: UserId, tenantId: string, operation: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.run(actor, tenantId, operation);
  }
  private write<T>(actor: UserId, tenantId: string, operation: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.run(actor, tenantId, async (client) => {
      if (!(await client.query<{allowed:boolean}>('select magrit.actor_has_capability($1,$2) allowed', [tenantId, 'can_manage_shops'])).rows[0]?.allowed) {
        throw reject('permission_denied', 'La capacité can_manage_shops est requise.');
      }
      return operation(client);
    });
  }
  private async run<T>(actor: UserId, tenantId: string, operation: (client: PoolClient) => Promise<T>): Promise<T> {
    try { return await this.tx.run({ tenantId: tenantId as TenantId, userId: actor }, operation); }
    catch (error) { if (error instanceof ShopRejectedError) throw error; throw classified(error); }
  }
}

async function requireShop(client: PoolClient, tenantId: string, shopId: string): Promise<void> {
  if (!(await client.query('select 1 from public.shops where tenant_id=$1 and id=$2 and deleted_at is null', [tenantId, shopId])).rowCount) {
    throw reject('shop_not_found', 'Boutique introuvable.');
  }
}
function mapShop(row: Row, storage: ShopAssetStorage): ShopDto {
  const theme = record(row['theme']);
  return { id: String(row['id']), tenantId: String(row['tenant_id']), ownerUserId: String(row['owner_user_id']), slug: String(row['slug']), name: String(row['name']), description: String(row['description']), theme: { ...DEFAULT_THEME, ...theme }, logoUrl: storage.publicUrl(String(row['logo_url'])), address: String(row['address']), contactEmail: String(row['contact_email']), active: row['active'] === true, libraryIds: strings(row['library_ids']), excludedProductIds: strings(row['excluded_product_ids']), heroImageUrl: row['hero_image_url'] === null ? null : storage.publicUrl(String(row['hero_image_url'])), tagline: row['tagline'] === null ? null : String(row['tagline']), pimCatalogMode: row['pim_catalog_mode'] === true, pimGammeSlugs: strings(row['pim_gamme_slugs']), accessMode: row['access_mode'] === 'self_signup' ? 'self_signup' : 'invite_only', createdAt: iso(row['created_at']) };
}
function mapPublicShop(row:Row,storage:ShopAssetStorage):PublicShopCatalog['shop']{const{ownerUserId:_,libraryIds:__,excludedProductIds:___,pimCatalogMode:____,pimGammeSlugs:_____,...shop}=mapShop(row,storage);return shop;}
function mapProduct(row: Row): ShopProductDto { return { id:String(row['id']),shopId:String(row['shop_id']),productId:row['product_id']===null?null:String(row['product_id']),name:String(row['name']),category:String(row['category']),description:String(row['description']),priceHt:Number(row['price_ht']),imageUrl:String(row['image_url']),config:record(row['config']),displayOrder:Number(row['display_order']),createdAt:iso(row['created_at']),tenantId:row['tenant_id']===null?null:String(row['tenant_id']),gammeSlug:row['gamme_slug']===null?null:String(row['gamme_slug']) }; }
function mapMockup(row: Row, storage: ShopAssetStorage): ShopCustomMockup { return { shopId:String(row['shop_id']),templateType:row['template_type'] as MockupTemplateType,view:row['view'] as MockupView,mockupImageUrl:storage.publicUrl(String(row['mockup_image_url'])) }; }
function shopPatch(command: UpdateShopCommand, storage: ShopAssetStorage): Record<string, unknown> { const patch:Record<string,unknown>={}; const mapping:Record<string,string>={logoUrl:'logo_url',contactEmail:'contact_email',libraryIds:'library_ids',excludedProductIds:'excluded_product_ids',heroImageUrl:'hero_image_url',pimCatalogMode:'pim_catalog_mode',pimGammeSlugs:'pim_gamme_slugs',accessMode:'access_mode'}; for(const [key,value] of Object.entries(command)){const column=mapping[key]??key.replace(/[A-Z]/g,(letter)=>`_${letter.toLowerCase()}`);patch[column]=key==='theme'?JSON.stringify(value):key==='logoUrl'||key==='heroImageUrl'?(value===null?null:storage.reference(String(value))):value;} return patch; }
function productPatch(command: UpdateShopProductCommand): Record<string, unknown> { const mapping:Record<string,string>={productId:'product_id',priceHt:'price_ht',imageUrl:'image_url',displayOrder:'display_order',gammeSlug:'gamme_slug'}; return Object.fromEntries(Object.entries(command).map(([key,value])=>[mapping[key]??key,key==='config'?JSON.stringify(value):value])); }
function record(value: unknown): Record<string, unknown> { return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}; }
function strings(value: unknown): string[] { return Array.isArray(value)?value.map(String):[]; }
function iso(value: unknown): string { return value instanceof Date?value.toISOString():new Date(String(value)).toISOString(); }
function slug(): string { return `shop-${crypto.randomUUID().replaceAll('-','').slice(0,20)}`; }
function classified(error: unknown): ShopRejectedError { const value=error as {code?:string;message?:string}; if(value.code==='23505')return reject('conflict',value.message??'Conflit boutique.'); if(value.code==='23503'||value.code==='23514'||value.code==='22P02')return reject('invalid_request',value.message??'Modification boutique invalide.'); return reject('permission_denied',value.message??String(error)); }
function reject(code: ConstructorParameters<typeof ShopRejectedError>[0], detail: string): ShopRejectedError { return new ShopRejectedError(code, detail); }
function message(error: unknown): string { return error instanceof Error?error.message:String(error); }
type CatalogPayload={shop:Row;taxRegime:unknown;products:Row[];libraryProducts:Row[];pricing:Row[];gammes:Row[];definitions:Row[];subscribedSlugs:string[];customMockups:Row[]};
