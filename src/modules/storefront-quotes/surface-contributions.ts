import { defineSurfaceContribution } from '../../surfaces/registry';

export const storefrontQuotesCustomerPortalContribution = defineSurfaceContribution({
  moduleId: 'storefront-quotes', surface: 'customer-portal',
  routes: [
    {
      id: 'storefront-quotes.customer-portal.list',
      moduleId: 'storefront-quotes',
      featureId: 'storefront-quotes.customer-history',
      surface: 'customer-portal',
      path: 'account/quotes',
      mount: 'host',
      requiredCapabilities: ['storefront-quotes.read.own'],
    },
  ],
  navigation: [],
} as const);
