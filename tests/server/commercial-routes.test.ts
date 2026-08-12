import { describe, expect, it } from 'vitest';
import { parseId } from '../../src/kernel/ids';
import { CommercialApiClient } from '../../src/modules/commercial/api/client';
import type { CommercialRepository } from '../../src/modules/commercial/application/commercial-repository';
import { CommercialService } from '../../src/modules/commercial/application/commercial-service';
import { FetchApiClient } from '../../src/platform/api';
import { createApiV1Application } from '../../src/server/api/composition';
import { createCommercialRoutes } from '../../src/server/api/commercial-routes';

const actor = parseId<'UserId'>('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
if (!actor.ok) throw new Error('actor');
const tenant = '11111111-1111-4111-8111-111111111111';
const overview = {
  available: true,
  rules: [{ id: 'rule-1', tenant_id: tenant, name: 'Fidélité', scope_type: 'tenant' as const, group_id: null, user_id: null, target_type: 'all' as const, gamme_slug: null, product_definition_id: null, adjust_mode: 'discount_pct' as const, value: 5, priority: 100, active: true, valid_from: null, valid_until: null, created_at: '2026-08-12T00:00:00Z' }],
  groups: [{ id: 'group-1', tenant_id: tenant, name: 'Grands comptes', created_at: '2026-08-12T00:00:00Z', member_count: 2 }],
  members: [{ user_id: actor.value, email: 'client@magrit.test' }],
  gammes: [{ slug: 'flyers', name: 'Flyers' }],
};

function bridge(handler: (request: Request) => Promise<Response>): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => handler(new Request(input, init))) as typeof fetch;
}

describe('routes API Commercial', () => {
  it('charge la vue commerciale tenant avec l acteur du bearer', async () => {
    const calls: string[] = [];
    const repository: CommercialRepository = { async overview(actorId, tenantId) { calls.push(`${actorId}:${tenantId}`); return overview; } };
    const handler = createApiV1Application({ routes: createCommercialRoutes(new CommercialService(repository)), actorResolver: { async resolve() { return { kind: 'user', userId: actor.value }; } }, requestIdFactory: () => 'commercial-test' });
    const client = new CommercialApiClient(new FetchApiClient('https://magrit.test', bridge(handler), () => 'token'));
    expect(await client.overview(tenant)).toEqual(overview);
    expect(calls).toEqual([`${actor.value}:${tenant}`]);
  });
});
