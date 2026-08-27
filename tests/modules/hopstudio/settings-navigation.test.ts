import { describe, expect, it } from 'vitest';
import { hopStudioWorkspaceContribution } from '@/modules/hopstudio';

describe('menu Clariprint Studio', () => {
  it('est exposé dans Paramètres et réservé aux administrateurs du tenant', () => {
    expect(hopStudioWorkspaceContribution.routes[0]).toMatchObject({
      path: 'clariprint-studio',
      requiredTenantRole: 'admin',
    });
    expect(hopStudioWorkspaceContribution.navigation[0]).toMatchObject({
      groupId: 'settings',
      label: 'Clariprint Studio',
    });
  });
});
