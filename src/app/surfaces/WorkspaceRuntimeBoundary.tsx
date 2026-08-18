import { Outlet } from 'react-router';
import { browserRuntime } from '../../platform/runtime';
import { AuthProvider } from '../contexts/AuthContext';
import { ApiRuntimeProvider } from '../contexts/ApiRuntimeContext';
import { BrowserServicesProvider } from '../contexts/BrowserServicesContext';
import { ModuleClientsProvider } from '../contexts/ModuleClientsContext';
import { PIMProvider } from '../contexts/PIMContext';
import { PreferencesProvider } from '../contexts/PreferencesContext';
import { SessionBootstrapProvider } from '../contexts/SessionBootstrapContext';

/** Composition Magrit exécutée uniquement hors des routes boutique. */
export function WorkspaceRuntimeBoundary() {
  return (
    <AuthProvider gateway={browserRuntime.authentication}>
      <ApiRuntimeProvider>
        <BrowserServicesProvider runtime={browserRuntime}>
          <ModuleClientsProvider>
            <SessionBootstrapProvider>
              <PreferencesProvider>
                <PIMProvider>
                  <Outlet />
                </PIMProvider>
              </PreferencesProvider>
            </SessionBootstrapProvider>
          </ModuleClientsProvider>
        </BrowserServicesProvider>
      </ApiRuntimeProvider>
    </AuthProvider>
  );
}
