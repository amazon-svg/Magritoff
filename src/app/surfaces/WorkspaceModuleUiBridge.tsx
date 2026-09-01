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

  /**
   * Transport porteur de l espace de travail courant.
   *
   * La facade E10 resout le tenant depuis le jeton, mais un compte Magrit
   * appartient souvent a plusieurs espaces et le JWT ne dit pas lequel est
   * consulte — c est l URL `/t/:slug` qui le decide, donc le front. Cet
   * en-tete transmet CE choix ; il ne peut rien elargir, le serveur verifie
   * que l espace demande fait bien partie de ceux du jeton
   * (docs/api/CONVENTIONS.md §3.4).
   *
   * Attache ici plutot que dans chaque client de module : `CustomersApiClient`
   * et les suivants n ont pas a connaitre la notion d espace courant.
   */
  const apiClient = useMemo(
    () =>
      currentTenant
        ? apiRuntime.client.withHeaders({ 'X-Magrit-Tenant': currentTenant.id })
        : apiRuntime.client,
    [apiRuntime.client, currentTenant?.id],
  );

  const value = useMemo<WorkspaceUiRuntime>(() => ({
    actor: user ? { userId: user.id } : null,
    tenant: currentTenant && currentRole
      ? { id: currentTenant.id, name: currentTenant.name, role: currentRole }
      : null,
    isSuperAdmin,
    apiClient,
    apiForAccessToken: apiRuntime.forAccessToken,
    refreshAccessToken,
    assistant: runtime.assistant,
    clariprint: runtime.createClariprint(apiRuntime.client),
    mockups: runtime.mockups,
  }), [
    apiClient,
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
