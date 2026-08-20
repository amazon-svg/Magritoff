import { defineSurfaceContribution } from '../../surfaces/registry';

export const shopCustomersStorefrontContribution = defineSurfaceContribution({
  moduleId: 'shop-customers',
  surface: 'storefront',
  routes: [
    {
      id: 'shop-customers.storefront.activate',
      moduleId: 'shop-customers',
      featureId: 'shop-customers.storefront-session',
      surface: 'storefront',
      path: 'activate',
      mount: 'host',
    },
    {
      id: 'shop-customers.storefront.reset-password',
      moduleId: 'shop-customers',
      featureId: 'shop-customers.storefront-session',
      surface: 'storefront',
      path: 'reset-password',
      mount: 'host',
    },
  ],
  navigation: [],
} as const);

/**
 * Le compte portail est aujourd'hui rendu dans le host `PublicShop`. Cette
 * contribution sans route matérialise sa propriété sans dupliquer la route
 * `account/profile`, détenue par le module Account.
 */
export const shopCustomersCustomerPortalContribution = defineSurfaceContribution({
  moduleId: 'shop-customers',
  surface: 'customer-portal',
  routes: [],
  navigation: [],
} as const);

/** La gestion des clients est intégrée à l'éditeur de boutique workspace. */
export const shopCustomersWorkspaceContribution = defineSurfaceContribution({
  moduleId: 'shop-customers',
  surface: 'workspace',
  routes: [],
  navigation: [],
} as const);

export const shopCustomersBackofficeContribution = defineSurfaceContribution({
  moduleId: 'shop-customers',
  surface: 'backoffice',
  routes: [{
    id: 'shop-customers.backoffice.accounts',
    moduleId: 'shop-customers',
    featureId: 'shop-customers.workspace-management',
    surface: 'backoffice',
    path: 'shop-customers',
    mount: 'router',
    availability: 'planned',
    requiredCapabilities: ['shop-customers.manage'],
  }],
  navigation: [{
    id: 'shop-customers.backoffice.navigation',
    moduleId: 'shop-customers',
    featureId: 'shop-customers.workspace-management',
    surface: 'backoffice',
    routeId: 'shop-customers.backoffice.accounts',
    groupId: 'governance',
    label: 'Comptes boutique',
    iconId: 'users',
    order: 130,
  }],
} as const);
