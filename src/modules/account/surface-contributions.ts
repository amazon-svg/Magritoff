import { defineSurfaceContribution } from '../../surfaces/registry';

export const accountWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'account',
  surface: 'workspace',
  routes: [
    {
      id: 'account.workspace.settings',
      moduleId: 'account',
      featureId: 'account.preferences',
      surface: 'workspace',
      path: 'account',
      mount: 'router',
      requiredCapabilities: ['account.self.manage'],
    },
  ],
  navigation: [
    {
      id: 'account.workspace.navigation',
      moduleId: 'account',
      featureId: 'account.preferences',
      surface: 'workspace',
      routeId: 'account.workspace.settings',
      groupId: 'settings',
      label: 'Mon compte',
      iconId: 'user',
      order: 500,
      testId: 'nav-sidebar-profile-link',
    },
  ],
} as const);

export const accountCustomerPortalContribution = defineSurfaceContribution({
  moduleId: 'account',
  surface: 'customer-portal',
  routes: [
    {
      id: 'account.customer-portal.profile',
      moduleId: 'account',
      featureId: 'account.profile',
      surface: 'customer-portal',
      path: 'account/profile',
      mount: 'host',
      requiredCapabilities: ['account.self.manage'],
    },
  ],
  navigation: [],
} as const);
