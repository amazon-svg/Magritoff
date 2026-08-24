import { describe, expect, it } from 'vitest';
import { parseId } from '@/kernel/ids';
import { CommercialApiClient } from '@/modules/commercial/api/client';
import type { CommercialRepository } from '@/modules/commercial/application/commercial-repository';
import { CommercialService } from '@/modules/commercial/application/commercial-service';
import { FetchApiClient } from '@/platform/api';
import { createApiV1Application } from '@/server/api/composition';
import { createCommercialRoutes } from '@/server/api/commercial-routes';

const actor = parseId<'UserId'>('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
if (!actor.ok) throw new Error('actor');
const tenant = '11111111-1111-4111-8111-111111111111';
const groupId = '22222222-2222-4222-8222-222222222222';
const ruleId = '33333333-3333-4333-8333-333333333333';
const overview = {
  available: true,
  rules: [{ id: ruleId, tenant_id: tenant, name: 'Fidélité', scope_type: 'tenant' as const, group_id: null, user_id: null, target_type: 'all' as const, gamme_slug: null, product_definition_id: null, adjust_mode: 'discount_pct' as const, value: 5, priority: 100, active: true, valid_from: null, valid_until: null, created_at: '2026-08-12T00:00:00Z' }],
  groups: [{ id: groupId, tenant_id: tenant, name: 'Grands comptes', created_at: '2026-08-12T00:00:00Z', member_count: 2 }],
  members: [{ user_id: actor.value, email: 'client@magrit.test' }],
  gammes: [{ slug: 'flyers', name: 'Flyers' }],
};

function bridge(handler: (request: Request) => Promise<Response>): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => handler(new Request(input, init))) as typeof fetch;
}

describe('routes API Commercial', () => {
  it('charge la vue commerciale tenant avec l acteur du bearer', async () => {
    const calls: string[] = [];
    const repository: CommercialRepository = {
      async overview(actorId, tenantId) { calls.push(`${actorId}:${tenantId}`); return overview; },
      async createGroup() { calls.push('create-group'); return overview.groups[0]; },
      async removeGroup() { calls.push('remove-group'); },
      async groupMembers() { calls.push('group-members'); return [actor.value]; },
      async setGroupMember() { calls.push('set-member'); },
      async createRule() { calls.push('create-rule'); return overview.rules[0]; },
      async setRuleActive() { calls.push('active-rule'); return { ...overview.rules[0], active: false }; },
      async removeRule() { calls.push('remove-rule'); },
    };
    const handler = createApiV1Application({ routes: createCommercialRoutes(new CommercialService(repository)), actorResolver: { async resolve() { return { kind: 'user', userId: actor.value }; } }, requestIdFactory: () => 'commercial-test' });
    const client = new CommercialApiClient(new FetchApiClient('https://magrit.test', bridge(handler), () => 'token'));
    expect(await client.overview(tenant)).toEqual(overview);
    await client.createGroup(tenant, 'Grands comptes');
    expect(await client.groupMembers(tenant, groupId)).toEqual([actor.value]);
    await client.setGroupMember(tenant, groupId, actor.value, true);
    await client.createRule(tenant, { name: 'Fidélité', scope_type: 'tenant', group_id: null, user_id: null, target_type: 'all', gamme_slug: null, product_definition_id: null, adjust_mode: 'discount_pct', value: 5 });
    await client.setRuleActive(tenant, ruleId, false);
    await client.removeRule(tenant, ruleId);
    await client.removeGroup(tenant, groupId);
    expect(calls).toEqual([`${actor.value}:${tenant}`, 'create-group', 'group-members', 'set-member', 'create-rule', 'active-rule', 'remove-rule', 'remove-group']);
  });
});
