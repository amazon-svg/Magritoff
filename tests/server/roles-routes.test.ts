import { describe, expect, it } from 'vitest';
import { parseId } from '../../src/kernel/ids';
import { RolesService } from '../../src/modules/roles/application/roles-service';
import { RoleRejectedError, type RolesRepository } from '../../src/modules/roles/application/roles-repository';
import { createApiV1Application } from '../../src/server/api/composition';
import { createRolesRoutes } from '../../src/server/api/roles-routes';

const actor = parseId<'UserId'>('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
if (!actor.ok) throw new Error('acteur invalide');
const tenantId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const roleId = '33333333-3333-4333-8333-333333333333';
function repository(overrides: Partial<RolesRepository>): RolesRepository {
  return { async overview() { return { roles: [], members: [], assignments: [] }; }, async userDetail() { return { roles: [], assignments: [], shops: [], accessScope: 'magrit_full', allowedShopIds: [] }; }, async setAssignment() { return { active: false, assignmentId: null }; }, ...overrides };
}
function handler(repo: RolesRepository) { return createApiV1Application({ routes: createRolesRoutes(new RolesService(repo)), actorResolver: { async resolve() { return { kind: 'user', userId: actor.value }; } }, requestIdFactory: () => 'roles-test' }); }

describe('routes API Roles', () => {
  it('dérive l’auteur de la session et ignore un auteur forgé', async () => {
    let receivedActor = '';
    const response = await handler(repository({ async setAssignment(operator) { receivedActor = operator; return { active: true, assignmentId: '44444444-4444-4444-8444-444444444444' }; } }))(new Request(`http://localhost/api/v1/tenants/${tenantId}/members/${userId}/roles/${roleId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: true, assignedBy: 'forged' }) }));
    expect(response.status).toBe(200);
    expect(receivedActor).toBe(actor.value);
  });
  it('traduit un rôle hors tenant en 404', async () => {
    const response = await handler(repository({ async setAssignment() { throw new RoleRejectedError('role_not_found', 'Rôle introuvable.'); } }))(new Request(`http://localhost/api/v1/tenants/${tenantId}/members/${userId}/roles/${roleId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: true }) }));
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe('roles.role_not_found');
  });
});
