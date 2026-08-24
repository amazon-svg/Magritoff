import { Outlet } from 'react-router';
import { browserRuntime } from '@/platform/runtime';
import { AuthProvider } from '@/modules/account/ui/runtime';
import { ApiRuntimeProvider } from '@/app/contexts/ApiRuntimeContext';

/** Composition Magrit exécutée uniquement hors des routes boutique. */
export function WorkspaceRuntimeBoundary() {
  return (
    <AuthProvider gateway={browserRuntime.authentication}>
      <ApiRuntimeProvider>
        <Outlet />
      </ApiRuntimeProvider>
    </AuthProvider>
  );
}
