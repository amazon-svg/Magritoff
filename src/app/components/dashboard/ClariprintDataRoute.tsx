import { useMemo } from 'react';
import { ClariprintDataHome } from '../../../modules/clariprint-data/ui/workspace';
import { FetchAccessManagementApiClient } from '../../../modules/access-management/infrastructure/http/fetch-access-management-client';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';

export function ClariprintDataRoute() {
  const { session } = useAuth();
  const { currentTenant } = useTenant();
  const accessToken = session?.access_token ?? null;
  const accessApi = useMemo(
    () => new FetchAccessManagementApiClient(async () => accessToken),
    [accessToken],
  );

  if (!currentTenant) return null;
  return <ClariprintDataHome tenantId={currentTenant.id} accessApi={accessApi} />;
}
