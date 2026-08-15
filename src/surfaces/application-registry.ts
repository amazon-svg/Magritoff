import {
  accountCustomerPortalContribution,
  accountModuleManifest,
  accountWorkspaceContribution,
} from '../modules/account';
import { createContributionRegistry } from './registry';
import { ordersBackofficeContribution, ordersCustomerPortalContribution, ordersModuleManifest, ordersStorefrontContribution, ordersWorkspaceContribution } from '../modules/orders';
import { shopsBackofficeContribution, shopsModuleManifest, shopsStorefrontContribution, shopsWorkspaceContribution } from '../modules/shops';
import { quotesBackofficeContribution, quotesCustomerPortalContribution, quotesModuleManifest, quotesStorefrontContribution, quotesWorkspaceContribution } from '../modules/quotes';
import { quoteTemplatesModuleManifest, quoteTemplatesWorkspaceContribution } from '../modules/quote-templates';
import { librariesModuleManifest, librariesWorkspaceContribution } from '../modules/libraries';
import { catalogModuleManifest, catalogStorefrontContribution, catalogWorkspaceContribution } from '../modules/catalog';
import { commercialModuleManifest, commercialWorkspaceContribution } from '../modules/commercial';
import { membersModuleManifest, membersWorkspaceContribution } from '../modules/members';
import { tenantsModuleManifest, tenantsWorkspaceContribution } from '../modules/tenants';
import { rolesModuleManifest, rolesWorkspaceContribution } from '../modules/roles';
import { conversationsModuleManifest, conversationsWorkspaceContribution } from '../modules/conversations';
import { machineParksModuleManifest, machineParksWorkspaceContribution } from '../modules/machine-parks';
import { mockupsModuleManifest, mockupsWorkspaceContribution } from '../modules/mockups';
import { plansModuleManifest, plansWorkspaceContribution } from '../modules/plans';

export const applicationContributionRegistry = createContributionRegistry({
  manifests: [accountModuleManifest, ordersModuleManifest, shopsModuleManifest, quotesModuleManifest, quoteTemplatesModuleManifest, librariesModuleManifest, catalogModuleManifest, commercialModuleManifest, membersModuleManifest, tenantsModuleManifest, rolesModuleManifest, conversationsModuleManifest, machineParksModuleManifest, mockupsModuleManifest, plansModuleManifest],
  contributions: [accountWorkspaceContribution, accountCustomerPortalContribution, ordersStorefrontContribution, ordersCustomerPortalContribution, ordersWorkspaceContribution, ordersBackofficeContribution, shopsStorefrontContribution, shopsWorkspaceContribution, shopsBackofficeContribution, quotesStorefrontContribution, quotesCustomerPortalContribution, quotesWorkspaceContribution, quotesBackofficeContribution, quoteTemplatesWorkspaceContribution, librariesWorkspaceContribution, catalogStorefrontContribution, catalogWorkspaceContribution, commercialWorkspaceContribution, membersWorkspaceContribution, tenantsWorkspaceContribution, rolesWorkspaceContribution, conversationsWorkspaceContribution, machineParksWorkspaceContribution, mockupsWorkspaceContribution, plansWorkspaceContribution],
});
