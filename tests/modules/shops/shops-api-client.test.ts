import { describe, expect, it, vi } from 'vitest';
import { ShopsApiClient } from '@/modules/shops/api/client';
import { FetchApiClient } from '@/platform/api/fetch-api-client';

const tenantId = '11111111-1111-4111-8111-111111111111';
const shopId = '22222222-2222-4222-8222-222222222222';
const productId = '33333333-3333-4333-8333-333333333333';
const shop = { id: shopId, tenantId, ownerUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', slug: 'demo', name: 'Démo', description: '', theme: { primaryColor: '#000', accentColor: '#fff', mode: 'light' }, logoUrl: '', address: '', contactEmail: '', active: true, libraryIds: [], excludedProductIds: [], heroImageUrl: null, tagline: null, pimCatalogMode: false, pimGammeSlugs: [], accessMode: 'invite_only', createdAt: '2026-08-12T10:00:00Z' };
const product = { id: productId, shopId, productId: null, name: 'Flyer', category: '', description: '', priceHt: 10, imageUrl: '', config: {}, displayOrder: 0, createdAt: '2026-08-12T10:00:00Z', tenantId, gammeSlug: null };

describe('ShopsApiClient', () => {
  it('consomme les routes CRUD contractuelles', async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input); const method = init?.method ?? 'GET'; calls.push(`${method} ${url}`);
      if (method === 'GET' && url.endsWith('/shops')) return new Response(JSON.stringify([shop]));
      if (method === 'GET' && url.endsWith('/probe')) return new Response(JSON.stringify({ id: shopId, tenantId, accessMode: 'invite_only' }));
      if (method === 'GET' && url.endsWith('/catalog')) return new Response(JSON.stringify({ shop: { ...shop, ownerUserId: undefined, libraryIds: undefined, excludedProductIds: undefined, pimCatalogMode: undefined, pimGammeSlugs: undefined }, taxRegime: 'metropole_fr', products: [], gammes: [], definitions: [], subscribedSlugs: [], customMockups: [] }));
      if (method === 'GET' && url.endsWith('/custom-mockups')) return new Response(JSON.stringify([]));
      if (method === 'GET' && url.endsWith('/pricing')) return new Response(JSON.stringify([]));
      if (method === 'GET' && url.endsWith('/products')) return new Response(JSON.stringify([product]));
      if (method === 'POST' && url.endsWith('/brand-assets')) return new Response(JSON.stringify({ assetUrl: 'https://assets.magrit.test/logo.png' }));
      if (method === 'POST' && url.endsWith('/custom-mockups')) return new Response(JSON.stringify({ updated: true }));
      if (method === 'DELETE' && url.includes('/custom-mockups/')) return new Response(JSON.stringify({ updated: true }));
      if (method === 'POST' && url.endsWith('/products')) return new Response(JSON.stringify(product));
      if (method === 'POST' || method === 'PATCH' && url.endsWith(`/shops/${shopId}`)) return new Response(JSON.stringify(shop));
      if (method === 'PATCH') return new Response(JSON.stringify({ updated: true }));
      if (method === 'PUT') return new Response(JSON.stringify({ updated: true }));
      return new Response(JSON.stringify({ removed: true }));
    });
    const client = new ShopsApiClient(new FetchApiClient('', fetchMock as typeof fetch, () => 'token'));
    await client.list(tenantId); await client.create(tenantId, { name: 'Démo' });
    await client.update(tenantId, shopId, { active: false }); await client.products(tenantId, shopId);
    await client.addProduct(tenantId, shopId, { productId: null, name: 'Flyer', category: '', description: '', priceHt: 10, imageUrl: '', config: {}, displayOrder: 0, gammeSlug: null });
    await client.updateProduct(tenantId, shopId, productId, { priceHt: 12 });
    await client.removeProduct(tenantId, shopId, productId); await client.remove(tenantId, shopId);
    await client.publicProbe('demo');
    await expect(client.publicCatalog('demo')).resolves.toMatchObject({ taxRegime: 'metropole_fr' });
    await client.pricing(tenantId, shopId); await client.setPricing(tenantId, shopId, productId, 12);
    await expect(client.uploadBrandAsset(tenantId, shopId, 'logo', new File(['png'], 'logo.png', { type: 'image/png' }))).resolves.toBe('https://assets.magrit.test/logo.png');
    await client.customMockups(tenantId, shopId);
    await client.uploadCustomMockup(tenantId, shopId, 'flyer', 'front', new File(['svg'], 'flyer.svg', { type: 'image/svg+xml' }));
    await client.restoreCustomMockup(tenantId, shopId, 'flyer', 'front');
    expect(calls).toHaveLength(16);
    expect(calls[0]).toBe(`GET /api/v1/tenants/${tenantId}/shops`);
    expect(calls[5]).toContain(`/shops/${shopId}/products/${productId}`);
    expect(calls[9]).toBe('GET /api/v1/public/shops/demo/catalog');
    expect(calls[11]).toContain(`/pricing/${productId}`);
    expect(calls[12]).toBe(`POST /api/v1/tenants/${tenantId}/shops/${shopId}/brand-assets`);
    expect(calls[13]).toContain('/custom-mockups');
    expect(calls[15]).toBe(`DELETE /api/v1/tenants/${tenantId}/shops/${shopId}/custom-mockups/flyer/front`);
  });
});
