import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { OrdersApiClient } from '../../modules/orders';
import { useApiRuntimeClient } from './ApiRuntimeContext';

type ModuleClients = Readonly<{
  orders: OrdersApiClient;
}>;

const ModuleClientsContext = createContext<ModuleClients | null>(null);

/** Composition root des façades `/api/v1` consommées par l'application. */
export function ModuleClientsProvider({ children }: { children: ReactNode }) {
  const apiClient = useApiRuntimeClient();
  const clients = useMemo<ModuleClients>(
    () => ({ orders: new OrdersApiClient(apiClient) }),
    [apiClient],
  );

  return (
    <ModuleClientsContext.Provider value={clients}>
      {children}
    </ModuleClientsContext.Provider>
  );
}

export function useOrdersApi(): OrdersApiClient {
  const clients = useContext(ModuleClientsContext);
  if (!clients) throw new Error('useOrdersApi must be used within a ModuleClientsProvider');
  return clients.orders;
}
