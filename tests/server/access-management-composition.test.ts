import { describe, expect, it } from 'vitest';
import { AccessManagementQueries } from '../../src/modules/access-management/application';
import { createAccessManagementServices } from '../../src/server/access-management';
import {
  SupabaseIdentityService,
  SupabaseTenantService,
} from '../../src/platform/infrastructure/supabase';

describe('access-management server composition', () => {
  it('composes identity, tenant and query services around the Supabase adapters', () => {
    const services = createAccessManagementServices({} as never);
    expect(Object.isFrozen(services)).toBe(true);
    expect(services.identity).toBeInstanceOf(SupabaseIdentityService);
    expect(services.tenants).toBeInstanceOf(SupabaseTenantService);
    expect(services.queries).toBeInstanceOf(AccessManagementQueries);
  });
});

