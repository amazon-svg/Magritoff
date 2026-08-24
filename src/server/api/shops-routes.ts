import { parseId, type UserId } from '../../kernel/ids/index.ts';
import { createShopCommandSchema, createShopProductCommandSchema, mockupTemplateTypeSchema, mockupViewSchema, persistAiShopProductCommandSchema, persistAiShopProductResultSchema, publicShopCatalogSchema, publicShopProbeSchema, setShopPricingCommandSchema, shopBrandAssetKindSchema, shopBrandAssetResultSchema, shopCustomMockupMutationResultSchema, shopCustomMockupsSchema, shopMutationResultSchema, shopPricingMutationResultSchema, shopPricingOverridesSchema, shopProductSchema, shopProductsSchema, shopRemovalResultSchema, shopSchema, tenantShopsSchema, updateShopCommandSchema, updateShopProductCommandSchema } from '../../modules/shops/api/contracts.ts';
import { ShopRejectedError } from '../../modules/shops/application/shops-repository.ts';
import type { ShopsService } from '../../modules/shops/application/shops-service.ts';
import type { PublicShopCatalogAccess } from '../../modules/shops/application/shops-repository.ts';
import type { StorefrontSessionService } from '../../modules/shop-customers/application/storefront-session-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, defineMultipartRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';
import { readStorefrontSessionCookie, type StorefrontSessionCookiePolicy } from '../storefront/session-cookie.ts';

const ALLOWED_ASSET_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_MOCKUP_TYPES = new Set([...ALLOWED_ASSET_TYPES, 'image/svg+xml']);
const MAX_ASSET_BYTES = 5_242_880;

export function createShopsRoutes(
  service: ShopsService,
  storefrontSessions?: StorefrontSessionService,
  storefrontCookiePolicy?: StorefrontSessionCookiePolicy,
): readonly ApiRoute[] {
  const base = `${API_V1_BASE_PATH}/tenants/{tenantId}/shops`;
  return [
    defineJsonRoute({ method: 'GET', path: `${API_V1_BASE_PATH}/public/shops/{slug}/probe`, authentication: 'public', inputSchema: null, outputSchema: publicShopProbeSchema, async handle(context) { return execute(async () => ({ status: 200, body: await service.publicProbe(slugParam(context)) })); } }),
    defineJsonRoute({ method: 'GET', path: `${API_V1_BASE_PATH}/public/shops/{slug}/catalog`, authentication: 'public', inputSchema: null, outputSchema: publicShopCatalogSchema, async handle(context) { return execute(async () => ({ status: 200, body: await service.publicCatalog(await publicCatalogAccess(context, storefrontSessions, storefrontCookiePolicy), slugParam(context)) })); } }),
    defineJsonRoute({ method: 'GET', path: base, authentication: 'required', inputSchema: null, outputSchema: tenantShopsSchema, async handle(context) { return execute(async () => ({ status: 200, body: await service.list(actor(context), param(context, 'tenantId')) })); } }),
    defineJsonRoute({ method: 'POST', path: base, authentication: 'required', inputSchema: createShopCommandSchema, outputSchema: shopSchema, async handle(context, command) { return execute(async () => ({ status: 201, body: await service.create(actor(context), param(context, 'tenantId'), command) })); } }),
    defineJsonRoute({ method: 'PATCH', path: `${base}/{shopId}`, authentication: 'required', inputSchema: updateShopCommandSchema, outputSchema: shopSchema, async handle(context, command) { return execute(async () => ({ status: 200, body: await service.update(actor(context), param(context, 'tenantId'), param(context, 'shopId'), command) })); } }),
    defineJsonRoute({ method: 'DELETE', path: `${base}/{shopId}`, authentication: 'required', inputSchema: null, outputSchema: shopRemovalResultSchema, async handle(context) { return execute(async () => { await service.remove(actor(context), param(context, 'tenantId'), param(context, 'shopId')); return { status: 200, body: { removed: true as const } }; }); } }),
    defineJsonRoute({ method: 'GET', path: `${base}/{shopId}/pricing`, authentication: 'required', inputSchema: null, outputSchema: shopPricingOverridesSchema, async handle(context) { return execute(async () => ({ status: 200, body: await service.pricing(actor(context), param(context, 'tenantId'), param(context, 'shopId')) })); } }),
    defineJsonRoute({ method: 'PUT', path: `${base}/{shopId}/pricing/{libraryProductId}`, authentication: 'required', inputSchema: setShopPricingCommandSchema, outputSchema: shopPricingMutationResultSchema, async handle(context, command) { return execute(async () => { await service.setPricing(actor(context), param(context, 'tenantId'), param(context, 'shopId'), param(context, 'libraryProductId'), command); return { status: 200, body: { updated: true as const } }; }); } }),
    defineMultipartRoute({ method: 'POST', path: `${base}/{shopId}/brand-assets`, authentication: 'required', outputSchema: shopBrandAssetResultSchema, async handle(context, form) { return execute(async () => { const upload = await brandAsset(form); return { status: 201, body: { assetUrl: await service.uploadBrandAsset(actor(context), param(context, 'tenantId'), param(context, 'shopId'), upload) } }; }); } }),
    defineJsonRoute({ method: 'GET', path: `${base}/{shopId}/custom-mockups`, authentication: 'required', inputSchema: null, outputSchema: shopCustomMockupsSchema, async handle(context) { return execute(async () => ({ status: 200, body: await service.customMockups(actor(context), param(context, 'tenantId'), param(context, 'shopId')) })); } }),
    defineMultipartRoute({ method: 'POST', path: `${base}/{shopId}/custom-mockups`, authentication: 'required', outputSchema: shopCustomMockupMutationResultSchema, async handle(context, form) { return execute(async () => { await service.uploadCustomMockup(actor(context), param(context, 'tenantId'), param(context, 'shopId'), await customMockup(form)); return { status: 201, body: { updated: true as const } }; }); } }),
    defineJsonRoute({ method: 'DELETE', path: `${base}/{shopId}/custom-mockups/{templateType}/{view}`, authentication: 'required', inputSchema: null, outputSchema: shopCustomMockupMutationResultSchema, async handle(context) { return execute(async () => { await service.restoreCustomMockup(actor(context), param(context, 'tenantId'), param(context, 'shopId'), enumParam(context, 'templateType', mockupTemplateTypeSchema), enumParam(context, 'view', mockupViewSchema)); return { status: 200, body: { updated: true as const } }; }); } }),
    defineJsonRoute({ method: 'POST', path: `${base}/{shopId}/ai-products`, authentication: 'required', inputSchema: persistAiShopProductCommandSchema, outputSchema: persistAiShopProductResultSchema, async handle(context, command) { return execute(async () => { await service.persistAiProduct(actor(context), param(context, 'tenantId'), param(context, 'shopId'), command); return { status: 200, body: { persisted: true as const } }; }); } }),
    defineJsonRoute({ method: 'GET', path: `${base}/{shopId}/products`, authentication: 'required', inputSchema: null, outputSchema: shopProductsSchema, async handle(context) { return execute(async () => ({ status: 200, body: await service.products(actor(context), param(context, 'tenantId'), param(context, 'shopId')) })); } }),
    defineJsonRoute({ method: 'POST', path: `${base}/{shopId}/products`, authentication: 'required', inputSchema: createShopProductCommandSchema, outputSchema: shopProductSchema, async handle(context, command) { return execute(async () => ({ status: 201, body: await service.addProduct(actor(context), param(context, 'tenantId'), param(context, 'shopId'), command) })); } }),
    defineJsonRoute({ method: 'PATCH', path: `${base}/{shopId}/products/{productId}`, authentication: 'required', inputSchema: updateShopProductCommandSchema, outputSchema: shopMutationResultSchema, async handle(context, command) { return execute(async () => { await service.updateProduct(actor(context), param(context, 'tenantId'), param(context, 'shopId'), param(context, 'productId'), command); return { status: 200, body: { updated: true as const } }; }); } }),
    defineJsonRoute({ method: 'DELETE', path: `${base}/{shopId}/products/{productId}`, authentication: 'required', inputSchema: null, outputSchema: shopRemovalResultSchema, async handle(context) { return execute(async () => { await service.removeProduct(actor(context), param(context, 'tenantId'), param(context, 'shopId'), param(context, 'productId')); return { status: 200, body: { removed: true as const } }; }); } }),
  ];
}
async function execute<T>(operation: () => Promise<T>): Promise<T> { try { return await operation(); } catch (error) { if (error instanceof ShopRejectedError) throw httpError(error); throw error; } }
function httpError(error: ShopRejectedError) { const status = error.code === 'authentication_required' ? 401 : error.code === 'shop_not_found' || error.code === 'product_not_found' ? 404 : error.code === 'conflict' ? 409 : error.code === 'invalid_request' ? 422 : 403; return new ApiHttpError({ type: 'about:blank', title: status === 401 ? 'Authentification requise' : status === 404 ? 'Boutique introuvable' : status === 409 ? 'Conflit boutique' : status === 422 ? 'Modification boutique invalide' : 'Gestion boutique interdite', status, code: `shops.${error.code}`, detail: error.message }); }
function actor(context: ApiRequestContext): UserId { if (context.actor?.kind !== 'user') throw new ApiHttpError({ type: 'about:blank', title: 'Acteur utilisateur requis', status: 403, code: 'identity.user_actor_required' }); return context.actor.userId as UserId; }
function param(context: ApiRequestContext, name: string): string { const parsed = parseId(context.params[name] ?? ''); if (!parsed.ok) throw new ApiHttpError({ type: 'about:blank', title: 'Identifiant invalide', status: 422, code: 'api.validation_failed' }); return parsed.value; }
async function publicCatalogAccess(context: ApiRequestContext, sessions?: StorefrontSessionService, policy?: StorefrontSessionCookiePolicy): Promise<PublicShopCatalogAccess> {
  let storefront: PublicShopCatalogAccess['storefront'] = null;
  if (sessions && policy) {
    const token = readStorefrontSessionCookie(context.request.headers.get('cookie'), policy);
    const session = token ? await sessions.current(token) : null;
    if (session) storefront = { kind: 'shop_customer', shopId: session.identity.shopId, shopCustomerAccountId: session.identity.shopCustomerAccountId };
  }
  return { storefront };
}
function slugParam(context: ApiRequestContext): string { const value = context.params.slug?.trim(); if (!value || value.length > 160) throw new ApiHttpError({ type: 'about:blank', title: 'Slug invalide', status: 422, code: 'api.validation_failed' }); return value; }
async function brandAsset(form: FormData) {
  const kind = shopBrandAssetKindSchema.safeParse(form.get('kind'));
  if (!kind.success) throw invalidAsset('Un type de visuel est requis.');
  return { kind: kind.data, ...await imageAsset(form, ALLOWED_ASSET_TYPES, 'PNG, JPG ou WebP') };
}
async function customMockup(form: FormData) {
  const templateType = mockupTemplateTypeSchema.safeParse(form.get('templateType'));
  const view = mockupViewSchema.safeParse(form.get('view'));
  if (!templateType.success || !view.success) throw invalidAsset('Un template et une vue valides sont requis.');
  return { templateType: templateType.data, view: view.data, ...await imageAsset(form, ALLOWED_MOCKUP_TYPES, 'PNG, JPG, WebP ou SVG') };
}
async function imageAsset(form: FormData, allowed: ReadonlySet<string>, formats: string) {
  const asset = form.get('asset');
  if (!(asset instanceof Blob) || typeof (asset as File).name !== 'string') throw invalidAsset('Un fichier image est requis.');
  if (!allowed.has(asset.type)) throw invalidAsset(`Format non supporté — ${formats} attendu.`);
  if (asset.size === 0 || asset.size > MAX_ASSET_BYTES) throw invalidAsset('Le fichier doit peser entre 1 octet et 5 Mo.');
  return { fileName: (asset as File).name, contentType: asset.type, bytes: await asset.arrayBuffer() };
}
function invalidAsset(detail: string) { return new ApiHttpError({ type: 'about:blank', title: 'Visuel de boutique invalide', status: 422, code: 'shops.invalid_asset', detail }); }
function enumParam<T>(context: ApiRequestContext, name: string, schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }): T { const parsed = schema.safeParse(context.params[name]); if (!parsed.success) throw new ApiHttpError({ type: 'about:blank', title: 'Paramètre invalide', status: 422, code: 'api.validation_failed' }); return parsed.data; }
