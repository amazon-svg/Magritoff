import { describe, expect, it } from 'vitest';
import { parseId } from '../../src/kernel/ids';
import { ShopsService } from '../../src/modules/shops/application/shops-service';
import { ShopRejectedError, type ShopsRepository } from '../../src/modules/shops/application/shops-repository';
import { createApiV1Application } from '../../src/server/api/composition';
import { createShopsRoutes } from '../../src/server/api/shops-routes';

const parsed = parseId<'UserId'>('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'); if (!parsed.ok) throw new Error('actor');
const tenantId = '11111111-1111-4111-8111-111111111111';
const shopId = '22222222-2222-4222-8222-222222222222';
const shop = { id: shopId, tenantId, ownerUserId: parsed.value, slug: 'demo', name: 'Démo', description: '', theme: { primaryColor: '#000', accentColor: '#fff', mode: 'light' as const }, logoUrl: '', address: '', contactEmail: '', active: true, libraryIds: [], excludedProductIds: [], heroImageUrl: null, tagline: null, pimCatalogMode: false, pimGammeSlugs: [], accessMode: 'invite_only' as const, createdAt: '2026-08-12T10:00:00Z' };
function repo(overrides: Partial<ShopsRepository> = {}): ShopsRepository { return { async list() { return []; }, async create() { return shop; }, async update() { return shop; }, async remove() {}, async products() { return []; }, async addProduct() { throw new Error('unused'); }, async updateProduct() {}, async removeProduct() {}, async publicProbe() { return { id: shopId, tenantId, accessMode: 'invite_only' }; }, async publicCatalog() { throw new ShopRejectedError('authentication_required', 'Authentification requise.'); }, async pricing() { return []; }, async setPricing() {}, ...overrides }; }
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
  it('dérive l’acteur pour enregistrer un prix négocié', async () => {
    let receivedActor = '';
    const response = await handler(repo({ async setPricing(actor) { receivedActor = actor; } }))(new Request(`http://localhost/api/v1/tenants/${tenantId}/shops/${shopId}/pricing/33333333-3333-4333-8333-333333333333`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priceHtOverride: 12 }) }));
    expect(response.status).toBe(200); expect(receivedActor).toBe(parsed.value);
  });
});
