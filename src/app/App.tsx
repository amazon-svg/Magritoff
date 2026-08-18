import { RouterProvider } from 'react-router';
import { router } from './routes';

/**
 * App.tsx v3
 * ──────────
 * La composition des providers a legerement bouge : le TenantProvider depend
 * du router (useParams, useNavigate), donc il ne peut pas wrapper le
 * RouterProvider. On le place dans `AppShell` qui est le premier element
 * rendu PAR le router (cf routes.tsx, element: <AppShell />).
 *
 * Les providers "router-agnostiques" (Auth, Preferences, PIM…) restent
 * autour de RouterProvider pour eviter de les ressusciter a chaque
 * navigation.
 */
import { AuthProvider } from './contexts/AuthContext';
import { PreferencesProvider } from './contexts/PreferencesContext';
import { PIMProvider } from './contexts/PIMContext';
import { SessionBootstrapProvider } from './contexts/SessionBootstrapContext';
import { ApiRuntimeProvider } from './contexts/ApiRuntimeContext';
import { browserRuntime } from '../platform/runtime';
import { BrowserServicesProvider } from './contexts/BrowserServicesContext';
import { StorefrontBrowserServicesProvider } from './contexts/StorefrontBrowserServicesContext';
import { ModuleClientsProvider } from './contexts/ModuleClientsContext';
import { StorefrontModuleClientsProvider } from './contexts/StorefrontModuleClientsContext';

export default function App() {
  return (
    <AuthProvider gateway={browserRuntime.authentication}>
      <ApiRuntimeProvider>
        <BrowserServicesProvider runtime={browserRuntime}>
          <StorefrontBrowserServicesProvider runtime={browserRuntime}>
            <ModuleClientsProvider>
              <StorefrontModuleClientsProvider>
                <SessionBootstrapProvider>
                  <PreferencesProvider>
                    <PIMProvider>
                      <RouterProvider router={router} />
                    </PIMProvider>
                  </PreferencesProvider>
                </SessionBootstrapProvider>
              </StorefrontModuleClientsProvider>
            </ModuleClientsProvider>
          </StorefrontBrowserServicesProvider>
        </BrowserServicesProvider>
      </ApiRuntimeProvider>
    </AuthProvider>
  );
}
