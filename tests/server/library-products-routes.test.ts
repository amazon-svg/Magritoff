import { describe, expect, it } from 'vitest';
import { parseId } from '@/kernel/ids';
import { LibraryProductsApiClient } from '@/modules/libraries/api/product-client';
import type { LibraryProductsRepository } from '@/modules/libraries/application/library-products-repository';
import { LibraryProductsService } from '@/modules/libraries/application/library-products-service';
import { FetchApiClient } from '@/platform/api';
import { createApiV1Application } from '@/server/api/composition';
import { createLibraryProductsRoutes } from '@/server/api/library-products-routes';

const actor = parseId<'UserId'>('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
if (!actor.ok) throw new Error('actor');
const tenant = '11111111-1111-4111-8111-111111111111';
const productId = '33333333-3333-4333-8333-333333333333';
const input = { library_id: null, name: 'Flyer', category: 'Papeterie', description: '', price_ht: 12, image_url: '', config: { source: 'manual' }, active: true, gamme_slug: null };
const product = { id: productId, tenant_id: tenant, user_id: actor.value, ...input };

function repository(overrides: Partial<LibraryProductsRepository> = {}): LibraryProductsRepository {
  return {
    async list() { return [product]; },
    async create() { return product; },
    async createMany() { return [product]; },
    async replacePimGenerated() { return 1; },
    async clearPimGenerated() { return 1; },
    async update() { return { ...product, name: 'Flyer premium' }; },
    async remove() {},
    ...overrides,
  };
}

function app(repo: LibraryProductsRepository) {
  return createApiV1Application({
    routes: createLibraryProductsRoutes(new LibraryProductsService(repo)),
    actorResolver: { async resolve() { return { kind: 'user', userId: actor.value }; } },
    requestIdFactory: () => 'library-products-test',
  });
}
function bridge(handler: (request: Request) => Promise<Response>): typeof fetch {
  return ((request: RequestInfo | URL, init?: RequestInit) => handler(new Request(request, init))) as typeof fetch;
}

describe('routes API LibraryProducts', () => {
  it('partage CRUD, bulk et commandes PIM avec le client', async () => {
    const calls: string[] = [];
    const repo = repository({
      async list() { calls.push('list'); return [product]; },
      async create() { calls.push('create'); return product; },
      async createMany() { calls.push('bulk'); return [product]; },
      async replacePimGenerated() { calls.push('replace-pim'); return 1; },
      async clearPimGenerated() { calls.push('clear-pim'); return 1; },
      async update() { calls.push('update'); return { ...product, name: 'Flyer premium' }; },
      async remove() { calls.push('remove'); },
    });
    const client = new LibraryProductsApiClient(new FetchApiClient('https://magrit.test', bridge(app(repo)), () => 'token'));

    expect(await client.list(tenant)).toEqual([product]);
    expect(await client.create(tenant, input)).toEqual(product);
    expect(await client.createMany(tenant, [input])).toEqual([product]);
    expect(await client.replacePimGenerated(tenant, [input])).toEqual({ created: 1 });
    expect(await client.clearPimGenerated(tenant)).toEqual({ removed: 1 });
    expect(await client.update(tenant, productId, { name: 'Flyer premium' })).toMatchObject({ name: 'Flyer premium' });
    await client.remove(tenant, productId);
    expect(calls).toEqual(['list', 'create', 'bulk', 'replace-pim', 'clear-pim', 'update', 'remove']);
  });
});
