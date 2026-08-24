import { createContext, type ReactNode, useContext } from 'react';
import type { FetchApiClient } from '../api';

export type WorkspaceUiActor = Readonly<{
  userId: string;
}>;

export type WorkspaceUiTenant = Readonly<{
  id: string;
  name: string;
  role: 'admin' | 'member';
}>;

export type WorkspaceUiRuntime = Readonly<{
  actor: WorkspaceUiActor | null;
  tenant: WorkspaceUiTenant | null;
  isSuperAdmin: boolean;
  apiClient: FetchApiClient;
  apiForAccessToken(accessToken: string): FetchApiClient;
  refreshAccessToken(): Promise<string | null>;
}>;

const WorkspaceUiRuntimeContext = createContext<WorkspaceUiRuntime | null>(null);

/**
 * Port React neutre entre la composition applicative et les UX de module.
 * Il ne connaît aucun module métier ni aucun fournisseur technique.
 */
export function WorkspaceUiRuntimeProvider({
  value,
  children,
}: {
  value: WorkspaceUiRuntime;
  children: ReactNode;
}) {
  return (
    <WorkspaceUiRuntimeContext.Provider value={value}>
      {children}
    </WorkspaceUiRuntimeContext.Provider>
  );
}
export function useWorkspaceUiRuntime(): WorkspaceUiRuntime {
  const runtime = useContext(WorkspaceUiRuntimeContext);
  if (!runtime) {
    throw new Error('Module workspace UI requires WorkspaceUiRuntimeProvider');
  }
  return runtime;
}
