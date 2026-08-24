import { describe, expect, it } from 'vitest';
import { parseId } from '@/kernel/ids';
import { LibrariesApiClient } from '@/modules/libraries/api/client';
import type { LibrariesRepository } from '@/modules/libraries/application/libraries-repository';
import { LibrariesService } from '@/modules/libraries/application/libraries-service';
import { FetchApiClient } from '@/platform/api';
import { createApiV1Application } from '@/server/api/composition';
import { createLibrariesRoutes } from '@/server/api/libraries-routes';

const actor = parseId<'UserId'>('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
if (!actor.ok) throw new Error('actor');
const tenant = '11111111-1111-4111-8111-111111111111';
const libraryId = '22222222-2222-4222-8222-222222222222';
const library = { id: libraryId, tenant_id: tenant, user_id: actor.value, name: 'Papeterie', description: 'Produits papier' };

function repository(overrides: Partial<LibrariesRepository> = {}): LibrariesRepository {
  return {
    async list() { return [library]; },
    async create() { return library; },
    async update() { return { ...library, name: 'Papeterie premium' }; },
    async remove() {},
    ...overrides,
  };
}

function app(repo: LibrariesRepository) {
  return createApiV1Application({
    routes: createLibrariesRoutes(new LibrariesService(repo)),
    actorResolver: { async resolve() { return { kind: 'user', userId: actor.value }; } },
    requestIdFactory: () => 'libraries-test',
  });
}

function bridge(handler: (request: Request) => Promise<Response>): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => handler(new Request(input, init))) as typeof fetch;
}

describe('routes API Libraries', () => {
  it('partage le CRUD avec le client et dérive l acteur du bearer', async () => {
    const calls: Array<{ operation: string; actor: string; tenant: string }> = [];
    const repo = repository({
      async list(actorId, tenantId) { calls.push({ operation: 'list', actor: actorId, tenant: tenantId }); return [library]; },
      async create(actorId, tenantId) { calls.push({ operation: 'create', actor: actorId, tenant: tenantId }); return library; },
      async update(actorId, tenantId) { calls.push({ operation: 'update', actor: actorId, tenant: tenantId }); return { ...library, name: 'Papeterie premium' }; },
      async remove(actorId, tenantId) { calls.push({ operation: 'remove', actor: actorId, tenant: tenantId }); },
    });
    const client = new LibrariesApiClient(new FetchApiClient('https://magrit.test', bridge(app(repo)), () => 'token'));

    expect(await client.list(tenant)).toEqual([library]);
    expect(await client.create(tenant, { name: library.name, description: library.description })).toEqual(library);
    expect(await client.update(tenant, libraryId, { name: 'Papeterie premium' })).toMatchObject({ name: 'Papeterie premium' });
    await client.remove(tenant, libraryId);

    expect(calls.map(({ operation }) => operation)).toEqual(['list', 'create', 'update', 'remove']);
    expect(calls.every((call) => call.actor === actor.value && call.tenant === tenant)).toBe(true);
  });
});
