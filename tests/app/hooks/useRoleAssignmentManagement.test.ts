import { describe, expect, it } from 'vitest';
import type { RolesOverview, UserRolesDetail } from '../../../src/modules/roles';
import {
  mapRolesOverview,
  mapUserRolesDetail,
  roleAssignmentError,
} from '../../../src/app/hooks/useRoleAssignmentManagement';

describe('useRoleAssignmentManagement helpers', () => {
  it('adapte la vue globale à la matrice historique', () => {
    const overview = {
      roles: [{ id: 'role-1', name: 'Admin', description: '', capabilities: { can_invite: true }, orderingIndex: 1 }],
      members: [{ userId: 'user-1', email: 'x@example.test', legacyRole: 'admin' }],
      assignments: [{ id: 'assignment-1', roleId: 'role-1', userId: 'user-1' }],
    } as RolesOverview;

    expect(mapRolesOverview('tenant-1', overview)).toMatchObject({
      roles: [{ tenant_id: 'tenant-1', ordering_index: 1 }],
      members: [{ user_id: 'user-1', role: 'admin' }],
      assignments: [{ role_definition_id: 'role-1', user_id: 'user-1' }],
    });
  });

  it('ignore le scope legacy dans la vue des options', () => {
    const detail = {
      roles: [], assignments: [], shops: [], accessScope: 'shop_only', allowedShopIds: [],
    } as UserRolesDetail;
    expect(mapUserRolesDetail(detail).roles).toHaveLength(0);
  });

  it('normalise les erreurs d assignation', () => {
    expect(roleAssignmentError(new Error('Refusé'), 'Impossible')).toBe('Refusé');
    expect(roleAssignmentError(null, 'Impossible')).toBe('Impossible');
  });
});
