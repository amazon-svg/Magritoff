import {
  accountCustomerPortalContribution,
  accountModuleManifest,
  accountWorkspaceContribution,
} from '../modules/account';
import { createContributionRegistry } from './registry';
import { ordersBackofficeContribution, ordersCustomerPortalContribution, ordersModuleManifest, ordersStorefrontContribution, ordersWorkspaceContribution } from '../modules/orders';
import { shopsBackofficeContribution, shopsModuleManifest, shopsStorefrontContribution, shopsWorkspaceContribution } from '../modules/shops';
import { quoteTemplatesModuleManifest, quoteTemplatesWorkspaceContribution } from '../modules/quote-templates';
import { librariesModuleManifest, librariesWorkspaceContribution } from '../modules/libraries';
import { catalogModuleManifest, catalogStorefrontContribution, catalogWorkspaceContribution } from '../modules/catalog';
import { commercialModuleManifest, commercialWorkspaceContribution } from '../modules/commercial';
import { customersModuleManifest, customersWorkspaceContribution } from '../modules/customers';
import { projectsModuleManifest, projectsWorkspaceContribution } from '../modules/projects';
import {
  commercialQuotesModuleManifest,
  commercialQuotesWorkspaceContribution,
} from '../modules/commercial-quotes';
import { membersModuleManifest, membersWorkspaceContribution } from '../modules/members';
import { tenantsModuleManifest, tenantsWorkspaceContribution } from '../modules/tenants';
import { rolesModuleManifest, rolesWorkspaceContribution } from '../modules/roles';
import { conversationsModuleManifest, conversationsWorkspaceContribution } from '../modules/conversations';
import { machineParksModuleManifest, machineParksWorkspaceContribution } from '../modules/machine-parks';
import { mockupsModuleManifest, mockupsWorkspaceContribution } from '../modules/mockups';
import { plansModuleManifest, plansWorkspaceContribution } from '../modules/plans';
import { pricingModuleManifest, pricingWorkspaceContribution } from '../modules/pricing';
import {
  shopCustomersBackofficeContribution,
  shopCustomersCustomerPortalContribution,
  shopCustomersModuleManifest,
  shopCustomersStorefrontContribution,
  shopCustomersWorkspaceContribution,
} from '../modules/shop-customers';

export const applicationContributionRegistry = createContributionRegistry({
  manifests: [accountModuleManifest, ordersModuleManifest, shopsModuleManifest, shopCustomersModuleManifest, quoteTemplatesModuleManifest, librariesModuleManifest, catalogModuleManifest, commercialModuleManifest, customersModuleManifest, projectsModuleManifest, commercialQuotesModuleManifest, membersModuleManifest, tenantsModuleManifest, rolesModuleManifest, conversationsModuleManifest, machineParksModuleManifest, mockupsModuleManifest, plansModuleManifest, pricingModuleManifest],
  contributions: [accountWorkspaceContribution, accountCustomerPortalContribution, ordersStorefrontContribution, ordersCustomerPortalContribution, ordersWorkspaceContribution, ordersBackofficeContribution, shopsStorefrontContribution, shopsWorkspaceContribution, shopsBackofficeContribution, shopCustomersStorefrontContribution, shopCustomersCustomerPortalContribution, shopCustomersWorkspaceContribution, shopCustomersBackofficeContribution, quoteTemplatesWorkspaceContribution, librariesWorkspaceContribution, catalogStorefrontContribution, catalogWorkspaceContribution, commercialWorkspaceContribution, customersWorkspaceContribution, projectsWorkspaceContribution, commercialQuotesWorkspaceContribution, membersWorkspaceContribution, tenantsWorkspaceContribution, rolesWorkspaceContribution, conversationsWorkspaceContribution, machineParksWorkspaceContribution, mockupsWorkspaceContribution, plansWorkspaceContribution, pricingWorkspaceContribution],
});
