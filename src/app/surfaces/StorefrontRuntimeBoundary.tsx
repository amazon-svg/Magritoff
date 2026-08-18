import { Outlet } from 'react-router';
import { storefrontBrowserRuntime } from '../../platform/runtime/storefront-browser-runtime';
import { StorefrontApiRuntimeProvider } from '../contexts/StorefrontApiRuntimeContext';
import { StorefrontBrowserServicesProvider } from '../contexts/StorefrontBrowserServicesContext';
import { StorefrontModuleClientsProvider } from '../contexts/StorefrontModuleClientsContext';

/** Composition exécutée uniquement pour les routes boutique. */
export function StorefrontRuntimeBoundary() {
  return (
    <StorefrontApiRuntimeProvider>
      <StorefrontBrowserServicesProvider runtime={storefrontBrowserRuntime}>
        <StorefrontModuleClientsProvider>
          <Outlet />
        </StorefrontModuleClientsProvider>
      </StorefrontBrowserServicesProvider>
    </StorefrontApiRuntimeProvider>
  );
}
