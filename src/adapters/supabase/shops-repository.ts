import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import { shopTaxRegimeSchema, type CreateShopCommand, type CreateShopProductCommand, type MockupTemplateType, type MockupView, type PersistAiShopProductCommand, type PublicShopCatalog, type PublicShopProbe, type SetShopPricingCommand, type ShopBrandAssetUpload, type ShopCustomMockup, type ShopCustomMockupUpload, type ShopDto, type ShopPricingOverride, type ShopProductDto, type UpdateShopCommand, type UpdateShopProductCommand } from '../../modules/shops/api/contracts.ts';
import { ShopRejectedError, type PublicShopCatalogAccess, type ShopsRepository } from '../../modules/shops/application/shops-repository.ts';
import type { Database, Json } from '../../types/database.types.ts';

const DEFAULT_THEME = { primaryColor: '#1e3a8a', accentColor: '#f59e0b', mode: 'light' as const, secondaryColor: '#6b7280', textColor: '#0f172a', bgColor: '#ffffff', fontPairing: 'system' };
const SHOP_COLUMNS = 'id, tenant_id, owner_user_id, slug, name, description, theme, logo_url, address, contact_email, active, library_ids, excluded_product_ids, hero_image_url, tagline, pim_catalog_mode, pim_gamme_slugs, access_mode, created_at' as const;
const PRODUCT_COLUMNS = 'id, shop_id, product_id, name, category, description, price_ht, image_url, config, display_order, created_at, tenant_id, gamme_slug' as const;

export class SupabaseShopsRepository implements ShopsRepository {
  constructor(private readonly client: SupabaseClient<Database>, private readonly publicBaseUrl?: string) {}

  async list(_actor: UserId, tenantId: string): Promise<ShopDto[]> {
    const { data, error } = await this.client.from('shops').select(SHOP_COLUMNS).eq('tenant_id', tenantId).is('deleted_at', null).order('created_at', { ascending: false });
    if (error) throw classified(error, 'Chargement des boutiques impossible.');
    return (data ?? []).map((row) => mapShop(row, this.publicBaseUrl));
  }
  async create(actor: UserId, tenantId: string, command: CreateShopCommand): Promise<ShopDto> {
    const parsed = { ...DEFAULT_THEME, ...(command.theme ?? {}) };
    const { data, error } = await this.client.from('shops').insert({
      owner_user_id: actor, tenant_id: tenantId, slug: randomSlug(), name: command.name,
      description: command.description ?? '', logo_url: storedAssetReference(command.logoUrl ?? ''), address: command.address ?? '',
      contact_email: command.contactEmail ?? '', theme: parsed, active: true, library_ids: [], excluded_product_ids: [],
      hero_image_url: command.heroImageUrl === null || command.heroImageUrl === undefined
        ? null : storedAssetReference(command.heroImageUrl), tagline: command.tagline ?? null,
    }).select(SHOP_COLUMNS).single();
    if (error || !data) throw classified(error, 'Création de la boutique impossible.');
    return mapShop(data, this.publicBaseUrl);
  }
  async update(actor: UserId, tenantId: string, shopId: string, command: UpdateShopCommand): Promise<ShopDto> {
    const { data, error } = await this.client.from('shops').update(shopPatch(command)).eq('tenant_id', tenantId).eq('id', shopId).select(SHOP_COLUMNS).maybeSingle();
    if (error) throw classified(error, 'Modification de la boutique impossible.');
    if (!data) throw new ShopRejectedError('shop_not_found', 'Boutique introuvable.');
    return mapShop(data, this.publicBaseUrl);
  }
  async remove(actor: UserId, tenantId: string, shopId: string): Promise<void> {
    const { data, error } = await this.client.rpc('api_delete_shop', { p_tenant_id: tenantId, p_shop_id: shopId });
    if (error) throw classified(error, 'Suppression de la boutique impossible.');
    if (!data) throw new ShopRejectedError('shop_not_found', 'Boutique introuvable.');
    await this.cleanupShopStorage(shopId);
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
  async publicProbe(slug: string): Promise<PublicShopProbe> {
    const row = await this.loadActiveShopBySlug(slug, 'id, tenant_id, access_mode');
    if (!row.tenant_id) throw new ShopRejectedError('invalid_request', 'Boutique sans espace propriétaire.');
    return { id: row.id, tenantId: row.tenant_id, accessMode: row.access_mode === 'self_signup' ? 'self_signup' : 'invite_only' };
  }
  async publicCatalog(access: PublicShopCatalogAccess, slug: string): Promise<PublicShopCatalog> {
    const gate = await this.loadActiveShopBySlug(slug, 'id, tenant_id, access_mode');
    if (!gate.tenant_id) throw new ShopRejectedError('invalid_request', 'Boutique sans espace propriétaire.');
    if (gate.access_mode !== 'self_signup') {
      if (access.storefront?.shopId !== gate.id) {
        const code = access.storefront ? 'permission_denied' : 'authentication_required';
        throw new ShopRejectedError(code, code === 'permission_denied' ? 'La session appartient à une autre boutique.' : 'Authentification boutique requise.');
      }
    }
    const shopRow = await this.loadActiveShopBySlug(slug, SHOP_COLUMNS);
    if (!shopRow.tenant_id) throw new ShopRejectedError('invalid_request', 'Boutique sans espace propriétaire.');

    const [manualResult, pricingResult, gammesResult, definitionsResult, subscriptionsResult, mockupsResult, taxResult] = await Promise.all([
      this.client.from('shop_products').select(PRODUCT_COLUMNS).eq('shop_id', shopRow.id).order('display_order'),
      this.client.from('shop_product_pricing').select('library_product_id, price_ht_override').eq('shop_id', shopRow.id),
      this.client.from('product_gammes').select('*').order('display_order'),
      this.client.from('product_definitions').select('*'),
      this.client.from('tenant_gamme_subscriptions').select('gamme_slug').eq('tenant_id', shopRow.tenant_id).eq('active', true),
      this.client.from('shop_template_mockups').select('shop_id, template_type, view, mockup_image_url').eq('shop_id', shopRow.id),
      this.client.rpc('api_get_public_shop_tax_regime', { p_shop_slug: slug }),
    ]);
    const failed = [manualResult.error, pricingResult.error, gammesResult.error, definitionsResult.error, mockupsResult.error, taxResult.error].find(Boolean);
    if (failed) throw classified(failed, 'Chargement du catalogue impossible.');

    const libraryRows = await this.loadPublicLibraryRows(shopRow);
    const excluded = new Set(shopRow.excluded_product_ids ?? []);
    const libraryIds = new Set(shopRow.library_ids ?? []);
    const gammeSlugs = new Set(shopRow.pim_gamme_slugs ?? []);
    const seen = new Set<string>();
    const scopedLibrary = libraryRows.filter((row) => {
      if (!row.active || excluded.has(row.id) || seen.has(row.id)) return false;
      const included = Boolean(row.library_id && libraryIds.has(row.library_id)) || Boolean(shopRow.pim_catalog_mode && row.gamme_slug && gammeSlugs.has(row.gamme_slug));
      if (included) seen.add(row.id);
      return included;
    });
    const priceByLibraryId = new Map((pricingResult.data ?? []).map((row) => [row.library_product_id, Number(row.price_ht_override)]));
    const manual = (manualResult.data ?? []).map(mapProduct);
    const manualProductIds = new Set(manual.map((product) => product.productId).filter(Boolean));
    const linked = scopedLibrary.filter((row) => !manualProductIds.has(row.id)).map((row) => ({
      id: `lib-${row.id}`, shopId: shopRow.id, productId: row.id, name: row.name,
      category: row.category || 'Autres', description: row.description ?? '',
      priceHt: priceByLibraryId.get(row.id) ?? Number(row.price_ht), imageUrl: row.image_url ?? '',
      config: toRecord(row.config), displayOrder: 0, createdAt: row.created_at,
      tenantId: row.tenant_id, gammeSlug: row.gamme_slug,
    }));
    const pricedManual = manual.map((product) => product.productId && priceByLibraryId.has(product.productId)
      ? { ...product, priceHt: priceByLibraryId.get(product.productId)! } : product);
    return {
      shop: mapPublicShop(shopRow, this.publicBaseUrl), products: [...pricedManual, ...linked],
      taxRegime: shopTaxRegimeSchema.parse(taxResult.data),
      gammes: (gammesResult.data ?? []).map((row) => ({ ...row, matching_rules: toRecord(row.matching_rules) })),
      definitions: (definitionsResult.data ?? []).map((row) => ({ ...row })),
      subscribedSlugs: subscriptionsResult.error ? [] : (subscriptionsResult.data ?? []).map((row) => row.gamme_slug),
      customMockups: (mockupsResult.data ?? []).map((row) => mapCustomMockup(row, this.publicBaseUrl)),
    };
  }
  async pricing(_actor: UserId, tenantId: string, shopId: string): Promise<ShopPricingOverride[]> {
    await this.requireShop(tenantId, shopId);
    const { data, error } = await this.client.from('shop_product_pricing')
      .select('library_product_id, price_ht_override').eq('tenant_id', tenantId).eq('shop_id', shopId);
    if (error) throw classified(error, 'Lecture des prix négociés impossible.');
    return (data ?? []).map((row) => ({ libraryProductId: row.library_product_id, priceHtOverride: Number(row.price_ht_override) }));
  }
  async setPricing(_actor: UserId, tenantId: string, shopId: string, libraryProductId: string, command: SetShopPricingCommand): Promise<void> {
    await this.requireShop(tenantId, shopId);
    if (command.priceHtOverride === null) {
      const { error } = await this.client.from('shop_product_pricing').delete()
        .eq('tenant_id', tenantId).eq('shop_id', shopId).eq('library_product_id', libraryProductId);
      if (error) throw classified(error, 'Suppression du prix négocié impossible.');
      return;
    }
    const { error } = await this.client.from('shop_product_pricing').upsert({
      tenant_id: tenantId, shop_id: shopId, library_product_id: libraryProductId,
      price_ht_override: command.priceHtOverride, updated_at: new Date().toISOString(),
    }, { onConflict: 'shop_id,library_product_id' });
    if (error) throw classified(error, 'Enregistrement du prix négocié impossible.');
  }
  async uploadBrandAsset(_actor: UserId, tenantId: string, shopId: string, upload: ShopBrandAssetUpload): Promise<string> {
    await this.requireShop(tenantId, shopId);
    const extension = upload.contentType === 'image/jpeg' ? 'jpg' : upload.contentType === 'image/webp' ? 'webp' : 'png';
    const path = `${shopId}/${upload.kind}-${crypto.randomUUID()}.${extension}`;
    const { error } = await this.client.storage.from('shop_backgrounds').upload(path, new Uint8Array(upload.bytes), {
      upsert: false, contentType: upload.contentType, cacheControl: '3600',
    });
    if (error) throw classified(error, 'Upload du visuel de boutique impossible.');
    const reference = storedAssetReference(
      this.client.storage.from('shop_backgrounds').getPublicUrl(path).data.publicUrl,
    );
    return publicAssetUrl(reference, this.publicBaseUrl);
  }
  async customMockups(_actor: UserId, tenantId: string, shopId: string): Promise<ShopCustomMockup[]> {
    await this.requireShop(tenantId, shopId);
    const { data, error } = await this.client.from('shop_template_mockups').select('shop_id, template_type, view, mockup_image_url').eq('tenant_id', tenantId).eq('shop_id', shopId);
    if (error) throw classified(error, 'Lecture des mockups personnalisés impossible.');
    return (data ?? []).map((row) => mapCustomMockup(row, this.publicBaseUrl));
  }
  async uploadCustomMockup(_actor: UserId, tenantId: string, shopId: string, upload: ShopCustomMockupUpload): Promise<void> {
    await this.requireShop(tenantId, shopId);
    const extension = upload.contentType === 'image/jpeg' ? 'jpg' : upload.contentType === 'image/webp' ? 'webp' : upload.contentType === 'image/svg+xml' ? 'svg' : 'png';
    const path = `${shopId}/${upload.templateType}-${upload.view}.${extension}`;
    const { error: storageError } = await this.client.storage.from('shop_product_mockups').upload(path, new Uint8Array(upload.bytes), { upsert: true, contentType: upload.contentType, cacheControl: '60' });
    if (storageError) throw classified(storageError, 'Upload du mockup personnalisé impossible.');
    const reference = storedAssetReference(
      this.client.storage.from('shop_product_mockups').getPublicUrl(path).data.publicUrl,
    );
    const { error } = await this.client.from('shop_template_mockups').upsert({ shop_id: shopId, tenant_id: tenantId, template_type: upload.templateType, view: upload.view, mockup_image_url: `${reference}?v=${Date.now()}`, updated_at: new Date().toISOString() }, { onConflict: 'shop_id,template_type,view' });
    if (error) throw classified(error, 'Enregistrement du mockup personnalisé impossible.');
  }
  async restoreCustomMockup(_actor: UserId, tenantId: string, shopId: string, templateType: MockupTemplateType, view: MockupView): Promise<void> {
    await this.requireShop(tenantId, shopId);
    const { error } = await this.client.from('shop_template_mockups').delete().eq('tenant_id', tenantId).eq('shop_id', shopId).eq('template_type', templateType).eq('view', view);
    if (error) throw classified(error, 'Restauration du mockup Magrit impossible.');
  }
  async persistAiProduct(_actor: UserId, tenantId: string, shopId: string, command: PersistAiShopProductCommand): Promise<void> {
    await this.requireShop(tenantId, shopId);
    const { error } = await this.client.rpc('persist_shop_ai_product', {
      p_shop_id: shopId, p_config_hash: command.configHash, p_name: command.name,
      p_category: command.category, p_description: command.description,
      p_price_ht: command.priceHt, p_image_url: command.imageUrl,
      p_config: command.config as Json, p_gamme_slug: command.gammeSlug ?? '',
    });
    if (error) throw classified(error, 'Persistance du produit IA impossible.');
  }
  private async requireShop(tenantId: string, shopId: string) {
    const { data, error } = await this.client.from('shops').select('id').eq('tenant_id', tenantId).eq('id', shopId).maybeSingle();
    if (error) throw classified(error, 'Lecture de la boutique impossible.');
    if (!data) throw new ShopRejectedError('shop_not_found', 'Boutique introuvable.');
  }
  private async cleanupShopStorage(shopId: string): Promise<void> {
    for (const bucket of ['shop_backgrounds', 'shop_product_mockups']) {
      const storage = this.client.storage.from(bucket);
      const { data, error } = await storage.list(shopId, { limit: 1000 });
      if (error) {
        console.warn(`[Shops] nettoyage du bucket ${bucket} ignoré: ${error.message}`);
        continue;
      }
      const paths = (data ?? []).filter((entry) => entry.name).map((entry) => `${shopId}/${entry.name}`);
      if (paths.length === 0) continue;
      const removed = await storage.remove(paths);
      if (removed.error) console.warn(`[Shops] nettoyage du bucket ${bucket} incomplet: ${removed.error.message}`);
    }
  }
  private async loadActiveShopBySlug<TColumns extends string>(slug: string, columns: TColumns) {
    const { data, error } = await this.client.from('shops').select(columns).eq('slug', slug).eq('active', true).is('deleted_at', null).maybeSingle();
    if (error) throw classified(error, 'Lecture de la boutique impossible.');
    if (!data) throw new ShopRejectedError('shop_not_found', 'Boutique introuvable.');
    return data;
  }
  private async loadPublicLibraryRows(shop: Pick<ShopRow, 'tenant_id' | 'library_ids' | 'pim_catalog_mode' | 'pim_gamme_slugs'>) {
    const rows: ProductLibraryRow[] = [];
    if (shop.library_ids.length > 0) {
      const { data, error } = await this.client.from('product_library').select('*').in('library_id', shop.library_ids).eq('active', true).order('created_at', { ascending: false });
      if (error) throw classified(error, 'Lecture des bibliothèques impossible.');
      rows.push(...(data ?? []));
    }
    if (shop.pim_catalog_mode && shop.pim_gamme_slugs.length > 0 && shop.tenant_id) {
      const { data, error } = await this.client.from('product_library').select('*').eq('tenant_id', shop.tenant_id).in('gamme_slug', shop.pim_gamme_slugs).eq('active', true).order('created_at', { ascending: false });
      if (error) throw classified(error, 'Lecture du catalogue PIM impossible.');
      rows.push(...(data ?? []));
    }
    return rows;
  }
}

type ShopRow = Database['public']['Tables']['shops']['Row'];
type ProductRow = Database['public']['Tables']['shop_products']['Row'];
type ProductLibraryRow = Database['public']['Tables']['product_library']['Row'];
type CustomMockupRow = Database['public']['Tables']['shop_template_mockups']['Row'];
function mapShop(row: Pick<ShopRow, 'id' | 'tenant_id' | 'owner_user_id' | 'slug' | 'name' | 'description' | 'theme' | 'logo_url' | 'address' | 'contact_email' | 'active' | 'library_ids' | 'excluded_product_ids' | 'hero_image_url' | 'tagline' | 'pim_catalog_mode' | 'pim_gamme_slugs' | 'access_mode' | 'created_at'>, publicBaseUrl?: string): ShopDto {
  if (!row.tenant_id) throw new ShopRejectedError('invalid_request', 'Boutique sans espace propriétaire.');
  const theme = row.theme && typeof row.theme === 'object' && !Array.isArray(row.theme) ? row.theme : {};
  return { id: row.id, tenantId: row.tenant_id, ownerUserId: row.owner_user_id, slug: row.slug, name: row.name, description: row.description ?? '', theme: { ...DEFAULT_THEME, ...theme }, logoUrl: publicAssetUrl(row.logo_url ?? '', publicBaseUrl), address: row.address ?? '', contactEmail: row.contact_email ?? '', active: row.active, libraryIds: row.library_ids ?? [], excludedProductIds: row.excluded_product_ids ?? [], heroImageUrl: row.hero_image_url ? publicAssetUrl(row.hero_image_url, publicBaseUrl) : null, tagline: row.tagline, pimCatalogMode: row.pim_catalog_mode === true, pimGammeSlugs: row.pim_gamme_slugs ?? [], accessMode: row.access_mode === 'self_signup' ? 'self_signup' : 'invite_only', createdAt: row.created_at };
}
function mapProduct(row: Pick<ProductRow, 'id' | 'shop_id' | 'product_id' | 'name' | 'category' | 'description' | 'price_ht' | 'image_url' | 'config' | 'display_order' | 'created_at' | 'tenant_id' | 'gamme_slug'>): ShopProductDto { return { id: row.id, shopId: row.shop_id, productId: row.product_id, name: row.name, category: row.category, description: row.description ?? '', priceHt: Number(row.price_ht), imageUrl: row.image_url ?? '', config: toRecord(row.config), displayOrder: row.display_order, createdAt: row.created_at, tenantId: row.tenant_id, gammeSlug: row.gamme_slug }; }
function mapCustomMockup(row: Pick<CustomMockupRow, 'shop_id' | 'template_type' | 'view' | 'mockup_image_url'>, publicBaseUrl?: string): ShopCustomMockup { return { shopId: row.shop_id, templateType: row.template_type as MockupTemplateType, view: row.view as MockupView, mockupImageUrl: publicAssetUrl(row.mockup_image_url, publicBaseUrl) }; }
function mapPublicShop(row: Pick<ShopRow, 'id' | 'tenant_id' | 'slug' | 'name' | 'description' | 'theme' | 'logo_url' | 'address' | 'contact_email' | 'active' | 'hero_image_url' | 'tagline' | 'access_mode' | 'created_at'>, publicBaseUrl?: string) {
  if (!row.tenant_id) throw new ShopRejectedError('invalid_request', 'Boutique sans espace propriétaire.');
  const theme = row.theme && typeof row.theme === 'object' && !Array.isArray(row.theme) ? row.theme : {};
  return { id: row.id, tenantId: row.tenant_id, slug: row.slug, name: row.name, description: row.description ?? '', theme: { ...DEFAULT_THEME, ...theme }, logoUrl: publicAssetUrl(row.logo_url ?? '', publicBaseUrl), address: row.address ?? '', contactEmail: row.contact_email ?? '', active: row.active, heroImageUrl: row.hero_image_url ? publicAssetUrl(row.hero_image_url, publicBaseUrl) : null, tagline: row.tagline, accessMode: row.access_mode === 'self_signup' ? 'self_signup' as const : 'invite_only' as const, createdAt: row.created_at };
}
function shopPatch(command: UpdateShopCommand): Database['public']['Tables']['shops']['Update'] {
  const patch: Database['public']['Tables']['shops']['Update'] = {};
  if (command.name !== undefined) patch.name = command.name; if (command.description !== undefined) patch.description = command.description;
  if (command.logoUrl !== undefined) patch.logo_url = storedAssetReference(command.logoUrl); if (command.address !== undefined) patch.address = command.address;
  if (command.contactEmail !== undefined) patch.contact_email = command.contactEmail; if (command.theme !== undefined) patch.theme = command.theme as Json;
  if (command.active !== undefined) patch.active = command.active; if (command.libraryIds !== undefined) patch.library_ids = command.libraryIds;
  if (command.excludedProductIds !== undefined) patch.excluded_product_ids = command.excludedProductIds; if (command.heroImageUrl !== undefined) patch.hero_image_url = command.heroImageUrl === null ? null : storedAssetReference(command.heroImageUrl);
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
export function publicAssetUrl(value: string, publicBaseUrl?: string): string {
  if (!value || !publicBaseUrl) return value;
  try {
    if (value.startsWith('/storage/v1/object/')) {
      return new URL(value, publicBaseUrl.endsWith('/') ? publicBaseUrl : `${publicBaseUrl}/`).toString();
    }
    const url = new URL(value);
    const publicOrigin = new URL(publicBaseUrl);
    const isStorageAsset = url.pathname.startsWith('/storage/v1/object/');
    const isIncompleteLocalUrl = isStorageAsset && isLoopback(url.hostname) && isLoopback(publicOrigin.hostname)
      && url.origin !== publicOrigin.origin;
    if (url.hostname !== 'kong' && !isIncompleteLocalUrl) return value;
    url.protocol = publicOrigin.protocol; url.hostname = publicOrigin.hostname; url.port = publicOrigin.port;
    return url.toString();
  } catch { return value; }
}
/**
 * Persiste une référence Storage portable. Les URL externes restent intactes ;
 * seule l'origine d'un objet géré par la plateforme est retirée.
 */
export function storedAssetReference(value: string): string {
  if (!value) return value;
  if (value.startsWith('/storage/v1/object/')) return value;
  try {
    const url = new URL(value);
    return url.pathname.startsWith('/storage/v1/object/')
      ? `${url.pathname}${url.search}${url.hash}`
      : value;
  } catch {
    return value;
  }
}
function isLoopback(hostname: string): boolean { return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1' || hostname === '[::1]'; }
