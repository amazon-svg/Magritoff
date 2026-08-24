import { type ReactNode, useCallback, useMemo } from 'react';
import {
  WorkspaceUiRuntimeProvider,
  type WorkspaceUiRuntime,
} from '@/platform/runtime/workspace-ui-runtime';
import type { BrowserRuntime } from '@/platform/runtime';
import { useApiRuntime } from '@/app/contexts/ApiRuntimeContext';
import { useAuth } from '@/modules/account/ui/runtime';
import { useTenant } from '@/modules/tenants/ui/runtime';

/** Compose les ports neutres consommés par les UX appartenant aux modules. */
export function WorkspaceModuleUiBridge({
  children,
  runtime,
}: {
  children: ReactNode;
  runtime: BrowserRuntime;
}) {
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
    assistant: runtime.assistant,
    clariprint: runtime.createClariprint(apiRuntime.client),
    mockups: runtime.mockups,
  }), [
    apiRuntime.client,
    apiRuntime.forAccessToken,
    currentRole,
    currentTenant?.id,
    currentTenant?.name,
    isSuperAdmin,
    refreshAccessToken,
    runtime,
    user?.id,
  ]);

  return <WorkspaceUiRuntimeProvider value={value}>{children}</WorkspaceUiRuntimeProvider>;
}
