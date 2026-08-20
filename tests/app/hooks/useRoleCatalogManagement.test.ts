import { describe, expect, it } from 'vitest';
import {
  roleCatalogError,
  toRoleAssignmentViews,
  toTenantRoleDefinition,
} from '../../../src/app/hooks/useRoleCatalogManagement';
import type { RoleCatalogDefinition, RolesCatalog } from '../../../src/modules/roles';

describe('useRoleCatalogManagement helpers', () => {
  it('adapte une définition de rôle au modèle historique de la vue', () => {
    const role = {
      id: 'role-1', tenantId: 'tenant-1', name: 'Validateur', description: '',
      capabilities: { can_validate: true }, notifyPolicy: 'chain_next', scope: 'tenant',
      scopeShopId: null, orderingIndex: 20, archivedAt: null,
    } as RoleCatalogDefinition;
    expect(toTenantRoleDefinition(role)).toMatchObject({
      tenant_id: 'tenant-1', notify_policy: 'chain_next', ordering_index: 20,
    });
  });

  it('joint les emails aux assignations sans exposer la composition dans la page', () => {
    const catalog = {
      roles: [],
      members: [{ userId: 'user-1', email: 'x@example.test', legacyRole: 'member' }],
      assignments: [{ id: 'assignment-1', roleId: 'role-1', userId: 'user-1' }],
    } as RolesCatalog;
    expect(toRoleAssignmentViews(catalog)).toEqual([{
      role_definition_id: 'role-1', user_id: 'user-1', user_email: 'x@example.test',
    }]);
  });

  it('normalise les erreurs du catalogue', () => {
    expect(roleCatalogError(new Error('Refusé'), 'Impossible')).toBe('Refusé');
    expect(roleCatalogError(null, 'Impossible')).toBe('Impossible');
  });
});
