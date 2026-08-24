import { describe, expect, it } from 'vitest';
import { parseId } from '@/kernel/ids';
import { RolesService } from '@/modules/roles/application/roles-service';
import { RoleRejectedError, type RolesRepository } from '@/modules/roles/application/roles-repository';
import { createApiV1Application } from '@/server/api/composition';
import { createRolesRoutes } from '@/server/api/roles-routes';

const actor = parseId<'UserId'>('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
if (!actor.ok) throw new Error('acteur invalide');
const tenantId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const roleId = '33333333-3333-4333-8333-333333333333';
function repository(overrides: Partial<RolesRepository>): RolesRepository {
  const role = { id: roleId, tenantId, name: 'Validateur', description: '', capabilities: { can_validate: true }, notifyPolicy: 'chain_next' as const, scope: 'tenant' as const, scopeShopId: null, orderingIndex: 40, archivedAt: null };
  return {
    async userCapability() { return false; },
    async overview() { return { roles: [], members: [], assignments: [] }; },
    async catalog() { return { roles: [], members: [], assignments: [] }; },
    async userDetail() { return { roles: [], assignments: [], shops: [], accessScope: 'magrit_full', allowedShopIds: [] }; },
    async setAssignment() { return { active: false, assignmentId: null }; },
    async createDefinition() { return role; }, async updateDefinition() { return role; },
    async archiveDefinition() {}, async reorderDefinitions() {}, ...overrides,
  };
}
function handler(repo: RolesRepository) { return createApiV1Application({ routes: createRolesRoutes(new RolesService(repo)), actorResolver: { async resolve() { return { kind: 'user', userId: actor.value }; } }, requestIdFactory: () => 'roles-test' }); }

describe('routes API Roles', () => {
  it('dérive l utilisateur et le tenant pour vérifier une capability', async () => {
    let received: [string, string, string] | null = null;
    const response = await handler(repository({ async userCapability(operator, tenant, capability) { received = [operator, tenant, capability]; return true; } }))(new Request(`http://localhost/api/v1/tenants/${tenantId}/capabilities/can_validate`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ capability: 'can_validate', granted: true });
    expect(received).toEqual([actor.value, tenantId, 'can_validate']);
  });
  it('refuse une capability hors nomenclature avant le repository', async () => {
    let called = false;
    const response = await handler(repository({ async userCapability() { called = true; return true; } }))(new Request(`http://localhost/api/v1/tenants/${tenantId}/capabilities/admin`));
    expect(response.status).toBe(422);
    expect(called).toBe(false);
  });
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
  it('dérive l’auteur lors de la création d’une définition', async () => {
    let receivedActor = '';
    const response = await handler(repository({ async createDefinition(operator, receivedTenant, command) {
      receivedActor = operator;
      return { id: roleId, tenantId: receivedTenant, ...command, archivedAt: null };
    } }))(new Request(`http://localhost/api/v1/tenants/${tenantId}/roles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Validateur', description: '', capabilities: { can_validate: true }, notifyPolicy: 'chain_next', scope: 'tenant', scopeShopId: null, orderingIndex: 40, actor: 'forged' }) }));
    expect(response.status).toBe(201);
    expect(receivedActor).toBe(actor.value);
  });
  it('refuse l’archivage d’un rôle canonique avec un conflit explicite', async () => {
    const response = await handler(repository({ async archiveDefinition() { throw new RoleRejectedError('canonical_role', 'Rôle canonique.'); } }))(new Request(`http://localhost/api/v1/tenants/${tenantId}/roles/${roleId}`, { method: 'DELETE' }));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('roles.canonical_role');
  });
});
