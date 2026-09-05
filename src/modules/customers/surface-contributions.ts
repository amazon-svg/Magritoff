import { defineSurfaceContribution } from '../../surfaces/registry';

export const customersWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'customers',
  surface: 'workspace',
  routes: [
    {
      id: 'customers.workspace.list',
      moduleId: 'customers',
      featureId: 'customers.workspace-list',
      surface: 'workspace',
      path: 'customers',
      mount: 'router',
      requiredCapabilities: ['customers.read'],
    },
    {
      id: 'customers.workspace.detail',
      moduleId: 'customers',
      featureId: 'customers.workspace-detail',
      surface: 'workspace',
      path: 'customers/:customerId',
      mount: 'router',
      requiredCapabilities: ['customers.read'],
    },
  ],
  navigation: [
    {
      id: 'customers.workspace.navigation',
      moduleId: 'customers',
      featureId: 'customers.workspace-list',
      surface: 'workspace',
      routeId: 'customers.workspace.list',
      groupId: 'commercial',
      label: 'Clients',
      iconId: 'building',
      order: 120,
      testId: 'nav-sidebar-customers-link',
    },
  ],
} as const);
