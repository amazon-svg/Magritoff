import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import type { CreateShopCommand, CreateShopProductCommand, ShopDto, ShopProductDto, UpdateShopCommand, UpdateShopProductCommand } from '../../modules/shops/api/contracts.ts';
import { ShopRejectedError, type ShopsRepository } from '../../modules/shops/application/shops-repository.ts';
import type { Database, Json } from '../../types/database.types.ts';

const DEFAULT_THEME = { primaryColor: '#1e3a8a', accentColor: '#f59e0b', mode: 'light' as const, secondaryColor: '#6b7280', textColor: '#0f172a', bgColor: '#ffffff', fontPairing: 'system' };
const SHOP_COLUMNS = 'id, tenant_id, owner_user_id, slug, name, description, theme, logo_url, address, contact_email, active, library_ids, excluded_product_ids, hero_image_url, tagline, pim_catalog_mode, pim_gamme_slugs, access_mode, created_at' as const;
const PRODUCT_COLUMNS = 'id, shop_id, product_id, name, category, description, price_ht, image_url, config, display_order, created_at, tenant_id, gamme_slug' as const;

export class SupabaseShopsRepository implements ShopsRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async list(_actor: UserId, tenantId: string): Promise<ShopDto[]> {
    const { data, error } = await this.client.from('shops').select(SHOP_COLUMNS).eq('tenant_id', tenantId).order('created_at', { ascending: false });
    if (error) throw classified(error, 'Chargement des boutiques impossible.');
    return (data ?? []).map(mapShop);
  }
  async create(actor: UserId, tenantId: string, command: CreateShopCommand): Promise<ShopDto> {
    const parsed = { ...DEFAULT_THEME, ...(command.theme ?? {}) };
    const { data, error } = await this.client.from('shops').insert({
      owner_user_id: actor, tenant_id: tenantId, slug: randomSlug(), name: command.name,
      description: command.description ?? '', logo_url: command.logoUrl ?? '', address: command.address ?? '',
      contact_email: command.contactEmail ?? '', theme: parsed, active: true, library_ids: [], excluded_product_ids: [],
      hero_image_url: command.heroImageUrl ?? null, tagline: command.tagline ?? null,
    }).select(SHOP_COLUMNS).single();
    if (error || !data) throw classified(error, 'Création de la boutique impossible.');
    return mapShop(data);
  }
  async update(actor: UserId, tenantId: string, shopId: string, command: UpdateShopCommand): Promise<ShopDto> {
    const { data, error } = await this.client.from('shops').update(shopPatch(command)).eq('tenant_id', tenantId).eq('id', shopId).eq('owner_user_id', actor).select(SHOP_COLUMNS).maybeSingle();
    if (error) throw classified(error, 'Modification de la boutique impossible.');
    if (!data) throw new ShopRejectedError('shop_not_found', 'Boutique introuvable.');
    return mapShop(data);
  }
  async remove(actor: UserId, tenantId: string, shopId: string): Promise<void> {
    const { data, error } = await this.client.from('shops').delete().eq('tenant_id', tenantId).eq('id', shopId).eq('owner_user_id', actor).select('id').maybeSingle();
    if (error) throw classified(error, 'Suppression de la boutique impossible.');
    if (!data) throw new ShopRejectedError('shop_not_found', 'Boutique introuvable.');
  }
  async products(_actor: UserId, tenantId: string, shopId: string): Promise<ShopProductDto[]> {
    await this.requireShop(tenantId, shopId);
    const { data, error } = await this.client.from('shop_products').select(PRODUCT_COLUMNS).eq('tenant_id', tenantId).eq('shop_id', shopId).order('display_order');
    if (error) throw classified(error, 'Chargement des produits impossible.');
    return (data ?? []).map(mapProduct);
  }
  async addProduct(_actor: UserId, tenantId: string, shopId: string, command: CreateShopProductCommand): Promise<ShopProductDto> {
    await this.requireShop(tenantId, shopId);
    const { data, error } = await this.client.from('shop_products').insert({ shop_id: shopId, tenant_id: tenantId, ...productPatch(command), name: command.name }).select(PRODUCT_COLUMNS).single();
    if (error || !data) throw classified(error, 'Ajout du produit impossible.');
    return mapProduct(data);
  }
  async updateProduct(_actor: UserId, tenantId: string, shopId: string, productId: string, command: UpdateShopProductCommand): Promise<void> {
    const { data, error } = await this.client.from('shop_products').update(productPatch(command)).eq('tenant_id', tenantId).eq('shop_id', shopId).eq('id', productId).select('id').maybeSingle();
    if (error) throw classified(error, 'Modification du produit impossible.');
    if (!data) throw new ShopRejectedError('product_not_found', 'Produit de boutique introuvable.');
  }
  async removeProduct(_actor: UserId, tenantId: string, shopId: string, productId: string): Promise<void> {
    const { data, error } = await this.client.from('shop_products').delete().eq('tenant_id', tenantId).eq('shop_id', shopId).eq('id', productId).select('id').maybeSingle();
    if (error) throw classified(error, 'Suppression du produit impossible.');
    if (!data) throw new ShopRejectedError('product_not_found', 'Produit de boutique introuvable.');
  }
  private async requireShop(tenantId: string, shopId: string) {
    const { data, error } = await this.client.from('shops').select('id').eq('tenant_id', tenantId).eq('id', shopId).maybeSingle();
    if (error) throw classified(error, 'Lecture de la boutique impossible.');
    if (!data) throw new ShopRejectedError('shop_not_found', 'Boutique introuvable.');
  }
}

type ShopRow = Database['public']['Tables']['shops']['Row'];
type ProductRow = Database['public']['Tables']['shop_products']['Row'];
function mapShop(row: Pick<ShopRow, 'id' | 'tenant_id' | 'owner_user_id' | 'slug' | 'name' | 'description' | 'theme' | 'logo_url' | 'address' | 'contact_email' | 'active' | 'library_ids' | 'excluded_product_ids' | 'hero_image_url' | 'tagline' | 'pim_catalog_mode' | 'pim_gamme_slugs' | 'access_mode' | 'created_at'>): ShopDto {
  if (!row.tenant_id) throw new ShopRejectedError('invalid_request', 'Boutique sans espace propriétaire.');
  const theme = row.theme && typeof row.theme === 'object' && !Array.isArray(row.theme) ? row.theme : {};
  return { id: row.id, tenantId: row.tenant_id, ownerUserId: row.owner_user_id, slug: row.slug, name: row.name, description: row.description ?? '', theme: { ...DEFAULT_THEME, ...theme }, logoUrl: row.logo_url ?? '', address: row.address ?? '', contactEmail: row.contact_email ?? '', active: row.active, libraryIds: row.library_ids ?? [], excludedProductIds: row.excluded_product_ids ?? [], heroImageUrl: row.hero_image_url, tagline: row.tagline, pimCatalogMode: row.pim_catalog_mode === true, pimGammeSlugs: row.pim_gamme_slugs ?? [], accessMode: row.access_mode === 'self_signup' ? 'self_signup' : 'invite_only', createdAt: row.created_at };
}
function mapProduct(row: Pick<ProductRow, 'id' | 'shop_id' | 'product_id' | 'name' | 'category' | 'description' | 'price_ht' | 'image_url' | 'config' | 'display_order' | 'created_at' | 'tenant_id' | 'gamme_slug'>): ShopProductDto { return { id: row.id, shopId: row.shop_id, productId: row.product_id, name: row.name, category: row.category, description: row.description ?? '', priceHt: Number(row.price_ht), imageUrl: row.image_url ?? '', config: toRecord(row.config), displayOrder: row.display_order, createdAt: row.created_at, tenantId: row.tenant_id, gammeSlug: row.gamme_slug }; }
function shopPatch(command: UpdateShopCommand): Database['public']['Tables']['shops']['Update'] {
  const patch: Database['public']['Tables']['shops']['Update'] = {};
  if (command.name !== undefined) patch.name = command.name; if (command.description !== undefined) patch.description = command.description;
  if (command.logoUrl !== undefined) patch.logo_url = command.logoUrl; if (command.address !== undefined) patch.address = command.address;
  if (command.contactEmail !== undefined) patch.contact_email = command.contactEmail; if (command.theme !== undefined) patch.theme = command.theme as Json;
  if (command.active !== undefined) patch.active = command.active; if (command.libraryIds !== undefined) patch.library_ids = command.libraryIds;
  if (command.excludedProductIds !== undefined) patch.excluded_product_ids = command.excludedProductIds; if (command.heroImageUrl !== undefined) patch.hero_image_url = command.heroImageUrl;
  if (command.tagline !== undefined) patch.tagline = command.tagline;
  Object.assign(patch, command.pimCatalogMode !== undefined ? { pim_catalog_mode: command.pimCatalogMode } : {}, command.pimGammeSlugs !== undefined ? { pim_gamme_slugs: command.pimGammeSlugs } : {}, command.accessMode !== undefined ? { access_mode: command.accessMode } : {});
  return patch;
}
function productPatch(command: CreateShopProductCommand | UpdateShopProductCommand): Database['public']['Tables']['shop_products']['Update'] {
  const map: Record<string, string> = { productId: 'product_id', priceHt: 'price_ht', imageUrl: 'image_url', displayOrder: 'display_order', gammeSlug: 'gamme_slug' };
  return Object.fromEntries(Object.entries(command).map(([key, value]) => [map[key] ?? key, key === 'config' ? value as Json : value])) as Database['public']['Tables']['shop_products']['Update'];
}
function toRecord(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function randomSlug() { const part = () => Math.random().toString(36).slice(2, 8); return `${part()}-${part()}`; }
function classified(error: { code?: string; message?: string } | null, fallback: string) { if (error?.code === '23505') return new ShopRejectedError('conflict', error.message ?? fallback); if (error?.code === '23503' || error?.code === '23514') return new ShopRejectedError('invalid_request', error.message ?? fallback); return new ShopRejectedError('permission_denied', error?.message ?? fallback); }
