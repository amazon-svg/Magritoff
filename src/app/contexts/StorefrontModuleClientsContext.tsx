import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { DiagnosticsApiClient } from '../../modules/diagnostics';
import { OrdersApiClient } from '../../modules/orders';
import { StorefrontIdentityApiClient } from '../../modules/shop-customers';
import { ShopsApiClient } from '../../modules/shops';
import { useStorefrontApiRuntime } from './StorefrontApiRuntimeContext';

type StorefrontModuleClients = Readonly<{
  diagnostics: DiagnosticsApiClient;
  identity: StorefrontIdentityApiClient;
  orders: OrdersApiClient;
  shops: ShopsApiClient;
}>;

const StorefrontModuleClientsContext = createContext<StorefrontModuleClients | null>(null);

/** Composition root storefront : cookie HttpOnly uniquement, aucun bearer Magrit. */
export function StorefrontModuleClientsProvider({ children }: { children: ReactNode }) {
  const apiRuntime = useStorefrontApiRuntime();
  const clients = useMemo<StorefrontModuleClients>(
    () => ({
      diagnostics: new DiagnosticsApiClient(apiRuntime.client),
      identity: new StorefrontIdentityApiClient(apiRuntime.client),
      orders: new OrdersApiClient(apiRuntime.client),
      shops: new ShopsApiClient(apiRuntime.client),
    }),
    [apiRuntime],
  );

  return (
    <StorefrontModuleClientsContext.Provider value={clients}>
      {children}
    </StorefrontModuleClientsContext.Provider>
  );
}

function useStorefrontModuleClients(): StorefrontModuleClients {
  const clients = useContext(StorefrontModuleClientsContext);
  if (!clients) throw new Error('Storefront clients require StorefrontModuleClientsProvider');
  return clients;
}

export function useStorefrontDiagnosticsApi(): DiagnosticsApiClient {
  return useStorefrontModuleClients().diagnostics;
}

export function useStorefrontIdentityApi(): StorefrontIdentityApiClient {
  return useStorefrontModuleClients().identity;
}

export function useStorefrontOrdersApi(): OrdersApiClient {
  return useStorefrontModuleClients().orders;
}

export function useStorefrontShopsApi(): ShopsApiClient {
  return useStorefrontModuleClients().shops;
}
