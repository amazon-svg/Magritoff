import { type ReactNode, useCallback, useMemo } from 'react';
import {
  WorkspaceUiRuntimeProvider,
  type WorkspaceUiRuntime,
} from '../../platform/runtime/workspace-ui-runtime';
import { useApiRuntime } from '../contexts/ApiRuntimeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';

/** Compose les ports neutres consommés par les UX appartenant aux modules. */
export function WorkspaceModuleUiBridge({ children }: { children: ReactNode }) {
  const apiRuntime = useApiRuntime();
  const { user, refreshSession } = useAuth();
  const { currentTenant, currentRole, isSuperAdmin } = useTenant();

  const refreshAccessToken = useCallback(async () => {
    const { session, error } = await refreshSession();
    return error ? null : session?.access_token ?? null;
  }, [refreshSession]);

  const value = useMemo<WorkspaceUiRuntime>(() => ({
    actor: user ? { userId: user.id } : null,
    tenant: currentTenant && currentRole
      ? { id: currentTenant.id, name: currentTenant.name, role: currentRole }
      : null,
    isSuperAdmin,
    apiClient: apiRuntime.client,
    apiForAccessToken: apiRuntime.forAccessToken,
    refreshAccessToken,
  }), [
    apiRuntime.client,
    apiRuntime.forAccessToken,
    currentRole,
    currentTenant?.id,
    currentTenant?.name,
    isSuperAdmin,
    refreshAccessToken,
    user?.id,
  ]);

  return <WorkspaceUiRuntimeProvider value={value}>{children}</WorkspaceUiRuntimeProvider>;
}
