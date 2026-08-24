import { describe, expect, it } from 'vitest';
import { parseId } from '../../src/kernel/ids';
import { MembersService } from '../../src/modules/members/application/members-service';
import { MemberRejectedError, type MembersRepository } from '../../src/modules/members/application/members-repository';
import { createApiV1Application } from '../../src/server/api/composition';
import { createMembersRoutes } from '../../src/server/api/members-routes';

const actor = parseId<'UserId'>('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
if (!actor.ok) throw new Error('acteur invalide');
const tenantId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';

function repository(overrides: Partial<MembersRepository>): MembersRepository {
  return { async list() { return []; }, async changeRole() {}, async updateAccess() {}, async remove() {}, ...overrides };
}
function handler(repo: MembersRepository) {
  return createApiV1Application({ routes: createMembersRoutes(new MembersService(repo)), actorResolver: { async resolve() { return { kind: 'user', userId: actor.value }; } }, requestIdFactory: () => 'members-test' });
}

describe('routes API membres', () => {
  it('refuse d attribuer le scope boutique legacy à un utilisateur Magrit', async () => {
    const response = await handler(repository({}))(new Request(`http://localhost/api/v1/tenants/${tenantId}/members/${userId}/access`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessScope: 'shop_only',
        allowedShopIds: ['33333333-3333-4333-8333-333333333333'],
        permissions: { canQuote: true, canOrder: true, canInvite: false },
      }),
    }));
    expect(response.status).toBe(422);
  });

  it('dérive l’opérateur de la session pour changer un rôle', async () => {
    let receivedActor = '';
    const response = await handler(repository({ async changeRole(operator) { receivedActor = operator; } }))(new Request(`http://localhost/api/v1/tenants/${tenantId}/members/${userId}/role`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'admin', actor: 'forged' }) }));
    expect(response.status).toBe(200);
    expect(receivedActor).toBe(actor.value);
  });
  it('traduit la protection owner en 403', async () => {
    const response = await handler(repository({ async remove() { throw new MemberRejectedError('owner_protected', 'owner protégé'); } }))(new Request(`http://localhost/api/v1/tenants/${tenantId}/members/${userId}`, { method: 'DELETE' }));
    const problem = await response.json();
    expect(response.status).toBe(403);
    expect(problem.code).toBe('members.owner_protected');
  });
});
