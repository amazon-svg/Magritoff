import { Outlet } from 'react-router';
import { browserRuntime } from '../../platform/runtime';
import { StorefrontApiRuntimeProvider } from '../contexts/StorefrontApiRuntimeContext';
import { StorefrontBrowserServicesProvider } from '../contexts/StorefrontBrowserServicesContext';
import { StorefrontModuleClientsProvider } from '../contexts/StorefrontModuleClientsContext';

/** Composition exécutée uniquement pour les routes boutique. */
export function StorefrontRuntimeBoundary() {
  return (
    <StorefrontApiRuntimeProvider>
      <StorefrontBrowserServicesProvider runtime={browserRuntime}>
        <StorefrontModuleClientsProvider>
          <Outlet />
        </StorefrontModuleClientsProvider>
      </StorefrontBrowserServicesProvider>
    </StorefrontApiRuntimeProvider>
  );
}
