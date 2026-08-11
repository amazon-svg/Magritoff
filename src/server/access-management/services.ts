import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';
import {
  SupabaseAccessService,
  SupabaseIdentityService,
  SupabaseTenantService,
  SupabaseTenantSettingsEntitlementService,
} from '../../platform/infrastructure/supabase';
import { AccessManagementQueries } from '../../modules/access-management/application';
import {
  accessManagementRegistration,
  LegacyMappedAccessService,
  StaticCapabilityCatalog,
  StaticModuleCatalog,
  SupabaseAccessManagementReadRepository,
  type AccessManagementHttpDependencies,
} from '../../modules/access-management/infrastructure';
import { clariprintDataModuleRegistration } from '../../modules/clariprint-data';

export function createAccessManagementServices(
  client: SupabaseClient<Database>,
): AccessManagementHttpDependencies {
  const access = new LegacyMappedAccessService(new SupabaseAccessService(client));
  const registrations = [accessManagementRegistration, clariprintDataModuleRegistration];
  const queries = new AccessManagementQueries({
    access,
    entitlements: new SupabaseTenantSettingsEntitlementService(client),
    repository: new SupabaseAccessManagementReadRepository(client),
    capabilities: new StaticCapabilityCatalog(registrations),
    modules: new StaticModuleCatalog(registrations),
  });
  return Object.freeze({
    identity: new SupabaseIdentityService(client),
    tenants: new SupabaseTenantService(client),
    queries,
  });
}
