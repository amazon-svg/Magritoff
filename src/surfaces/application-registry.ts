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
import { catalogModuleManifest, catalogWorkspaceContribution } from '../modules/catalog';
import { commercialModuleManifest, commercialWorkspaceContribution } from '../modules/commercial';
import { membersModuleManifest, membersWorkspaceContribution } from '../modules/members';
import { tenantsModuleManifest, tenantsWorkspaceContribution } from '../modules/tenants';
import { rolesModuleManifest, rolesWorkspaceContribution } from '../modules/roles';

export const applicationContributionRegistry = createContributionRegistry({
  manifests: [accountModuleManifest, ordersModuleManifest, shopsModuleManifest, quotesModuleManifest, quoteTemplatesModuleManifest, librariesModuleManifest, catalogModuleManifest, commercialModuleManifest, membersModuleManifest, tenantsModuleManifest, rolesModuleManifest],
  contributions: [accountWorkspaceContribution, accountCustomerPortalContribution, ordersStorefrontContribution, ordersCustomerPortalContribution, ordersWorkspaceContribution, ordersBackofficeContribution, shopsStorefrontContribution, shopsWorkspaceContribution, shopsBackofficeContribution, quotesStorefrontContribution, quotesCustomerPortalContribution, quotesWorkspaceContribution, quotesBackofficeContribution, quoteTemplatesWorkspaceContribution, librariesWorkspaceContribution, catalogWorkspaceContribution, commercialWorkspaceContribution, membersWorkspaceContribution, tenantsWorkspaceContribution, rolesWorkspaceContribution],
});
