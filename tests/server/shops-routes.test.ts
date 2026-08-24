import { describe, expect, it } from 'vitest';
import { parseId } from '@/kernel/ids';
import { ShopsService } from '@/modules/shops/application/shops-service';
import { ShopRejectedError, type ShopsRepository } from '@/modules/shops/application/shops-repository';
import { createApiV1Application } from '@/server/api/composition';
import { createShopsRoutes } from '@/server/api/shops-routes';
import { StorefrontSessionService } from '@/modules/shop-customers';
import { storefrontSessionCookiePolicy } from '@/server/storefront/session-cookie';

const parsed = parseId<'UserId'>('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'); if (!parsed.ok) throw new Error('actor');
const tenantId = '11111111-1111-4111-8111-111111111111';
const shopId = '22222222-2222-4222-8222-222222222222';
const shop = { id: shopId, tenantId, ownerUserId: parsed.value, slug: 'demo', name: 'Démo', description: '', theme: { primaryColor: '#000', accentColor: '#fff', mode: 'light' as const }, logoUrl: '', address: '', contactEmail: '', active: true, libraryIds: [], excludedProductIds: [], heroImageUrl: null, tagline: null, pimCatalogMode: false, pimGammeSlugs: [], accessMode: 'invite_only' as const, createdAt: '2026-08-12T10:00:00Z' };
const publicCatalog = { shop: { id: shopId, tenantId, slug: 'demo', name: 'Démo', description: '', theme: { primaryColor: '#000', accentColor: '#fff', mode: 'light' as const }, logoUrl: '', address: '', contactEmail: '', active: true, heroImageUrl: null, tagline: null, accessMode: 'invite_only' as const, createdAt: '2026-08-12T10:00:00Z' }, taxRegime: 'metropole_fr' as const, products: [], gammes: [], definitions: [], subscribedSlugs: [], customMockups: [] };
function repo(overrides: Partial<ShopsRepository> = {}): ShopsRepository { return { async list() { return []; }, async create() { return shop; }, async update() { return shop; }, async remove() {}, async products() { return []; }, async addProduct() { throw new Error('unused'); }, async updateProduct() {}, async removeProduct() {}, async publicProbe() { return { id: shopId, tenantId, accessMode: 'invite_only' }; }, async publicCatalog() { throw new ShopRejectedError('authentication_required', 'Authentification requise.'); }, async pricing() { return []; }, async setPricing() {}, async uploadBrandAsset() { return 'https://assets.magrit.test/logo.png'; }, async customMockups() { return []; }, async uploadCustomMockup() {}, async restoreCustomMockup() {}, async persistAiProduct() {}, ...overrides }; }
function handler(repository: ShopsRepository) { return createApiV1Application({ routes: createShopsRoutes(new ShopsService(repository)), actorResolver: { async resolve() { return { kind: 'user', userId: parsed.value }; } }, requestIdFactory: () => 'shops-test' }); }

describe('routes API Shops', () => {
  it('dérive le propriétaire de la session lors de la création', async () => {
    let actor = '';
    const response = await handler(repo({ async create(received) { actor = received; return shop; } }))(new Request(`http://localhost/api/v1/tenants/${tenantId}/shops`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Démo', ownerUserId: 'forged' }) }));
    expect(response.status).toBe(201); expect(actor).toBe(parsed.value);
  });
  it('traduit une boutique hors tenant en 404', async () => {
    const response = await handler(repo({ async update() { throw new ShopRejectedError('shop_not_found', 'Boutique introuvable.'); } }))(new Request(`http://localhost/api/v1/tenants/${tenantId}/shops/${shopId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: false }) }));
    expect(response.status).toBe(404); expect((await response.json()).code).toBe('shops.shop_not_found');
  });
  it('ne révèle que la sonde minimale sans authentification', async () => {
    const anonymous = createApiV1Application({ routes: createShopsRoutes(new ShopsService(repo())), requestIdFactory: () => 'shops-probe-test' });
    const response = await anonymous(new Request('http://localhost/api/v1/public/shops/demo/probe'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: shopId, tenantId, accessMode: 'invite_only' });
  });
  it('refuse le catalogue privé sans acteur', async () => {
    const anonymous = createApiV1Application({ routes: createShopsRoutes(new ShopsService(repo())), requestIdFactory: () => 'shops-public-test' });
    const response = await anonymous(new Request('http://localhost/api/v1/public/shops/demo/catalog'));
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('shops.authentication_required');
  });
  it('accepte le contexte storefront opaque sans exiger une membership Magrit', async () => {
    let access: unknown = null;
    const repository = repo({ async publicCatalog(received) { access = received; return publicCatalog; } });
    const sessions = new StorefrontSessionService({
      async resolve() { return {
        identity: { kind: 'shop_customer', shopId, shopCustomerAccountId: '33333333-3333-4333-8333-333333333333' },
        customer: { id: '33333333-3333-4333-8333-333333333333', shopId, email: 'client@example.com', fullName: 'Client', status: 'active' },
        expiresAt: '2026-08-17T12:00:00.000Z',
      }; },
      async revoke() { return true; },
    });
    const anonymous = createApiV1Application({
      routes: createShopsRoutes(new ShopsService(repository), sessions, storefrontSessionCookiePolicy(false)),
      requestIdFactory: () => 'shops-storefront-test',
    });
    const response = await anonymous(new Request('http://localhost/api/v1/public/shops/demo/catalog', {
      headers: { Cookie: 'magrit-storefront=abcdefghijklmnopqrstuvwxyzABCDE_1234567890-storefront' },
    }));
    expect(response.status).toBe(200);
    expect(access).toEqual({
      storefront: {
        kind: 'shop_customer', shopId,
        shopCustomerAccountId: '33333333-3333-4333-8333-333333333333',
      },
    });
  });
  it('ne transmet pas l acteur Magrit au catalogue public', async () => {
    let access: unknown = null;
    const repository = repo({ async publicCatalog(received) {
      access = received;
      throw new ShopRejectedError('authentication_required', 'Authentification boutique requise.');
    } });
    const response = await handler(repository)(new Request('http://localhost/api/v1/public/shops/demo/catalog'));
    expect(response.status).toBe(401);
    expect(access).toEqual({ storefront: null });
  });
  it('dérive l’acteur pour enregistrer un prix négocié', async () => {
    let receivedActor = '';
    const response = await handler(repo({ async setPricing(actor) { receivedActor = actor; } }))(new Request(`http://localhost/api/v1/tenants/${tenantId}/shops/${shopId}/pricing/33333333-3333-4333-8333-333333333333`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priceHtOverride: 12 }) }));
    expect(response.status).toBe(200); expect(receivedActor).toBe(parsed.value);
  });
  it('valide et transmet un visuel multipart sans exposer le stockage', async () => {
    let received: { actor: string; kind: string; type: string; size: number } | null = null;
    const form = new FormData(); form.set('kind', 'logo'); form.set('asset', new Blob(['png'], { type: 'image/png' }), 'logo.png');
    const response = await handler(repo({ async uploadBrandAsset(actor, _tenant, _shop, upload) { received = { actor, kind: upload.kind, type: upload.contentType, size: upload.bytes.byteLength }; return 'https://assets.magrit.test/logo.png'; } }))(new Request(`http://localhost/api/v1/tenants/${tenantId}/shops/${shopId}/brand-assets`, { method: 'POST', body: form }));
    expect(response.status).toBe(201);
    expect(received).toEqual({ actor: parsed.value, kind: 'logo', type: 'image/png', size: 3 });
    expect(await response.json()).toEqual({ assetUrl: 'https://assets.magrit.test/logo.png' });
  });
  it('refuse un visuel dont le type MIME est interdit', async () => {
    const form = new FormData(); form.set('kind', 'hero'); form.set('asset', new Blob(['svg'], { type: 'image/svg+xml' }), 'hero.svg');
    const response = await handler(repo())(new Request(`http://localhost/api/v1/tenants/${tenantId}/shops/${shopId}/brand-assets`, { method: 'POST', body: form }));
    expect(response.status).toBe(422); expect((await response.json()).code).toBe('shops.invalid_asset');
  });
  it('accepte un mockup SVG et dérive son périmètre de la route', async () => {
    let received: { actor: string; tenant: string; shop: string; template: string; view: string; type: string } | null = null;
    const form = new FormData(); form.set('templateType', 'flyer'); form.set('view', 'front'); form.set('asset', new Blob(['svg'], { type: 'image/svg+xml' }), 'flyer.svg');
    const response = await handler(repo({ async uploadCustomMockup(actor, tenant, shop, upload) { received = { actor, tenant, shop, template: upload.templateType, view: upload.view, type: upload.contentType }; } }))(new Request(`http://localhost/api/v1/tenants/${tenantId}/shops/${shopId}/custom-mockups`, { method: 'POST', body: form }));
    expect(response.status).toBe(201);
    expect(received).toEqual({ actor: parsed.value, tenant: tenantId, shop: shopId, template: 'flyer', view: 'front', type: 'image/svg+xml' });
  });
  it('valide les paramètres de restauration avant le repository', async () => {
    const response = await handler(repo())(new Request(`http://localhost/api/v1/tenants/${tenantId}/shops/${shopId}/custom-mockups/inconnu/front`, { method: 'DELETE' }));
    expect(response.status).toBe(422); expect((await response.json()).code).toBe('api.validation_failed');
  });
  it('dérive acteur et périmètre pour persister un produit IA', async () => {
    let received: [string, string, string, string] | null = null;
    const response = await handler(repo({ async persistAiProduct(actor, tenant, shop, command) { received = [actor, tenant, shop, command.configHash]; } }))(new Request(`http://localhost/api/v1/tenants/${tenantId}/shops/${shopId}/ai-products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ configHash: 'flyer-a5', name: 'Flyer A5', category: 'Flyers', description: '', priceHt: 12, imageUrl: '', config: {}, gammeSlug: 'flyers' }) }));
    expect(response.status).toBe(200);
    expect(received).toEqual([parsed.value, tenantId, shopId, 'flyer-a5']);
    expect(await response.json()).toEqual({ persisted: true });
  });
});
