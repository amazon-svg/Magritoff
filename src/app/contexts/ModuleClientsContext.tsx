import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { OrdersApiClient } from '../../modules/orders';
import { QuoteTemplatesApiClient } from '../../modules/quote-templates';
import { QuotesApiClient } from '../../modules/quotes';
import { ShopsApiClient } from '../../modules/shops';
import { useApiRuntime } from './ApiRuntimeContext';

type ModuleClients = Readonly<{
  orders: OrdersApiClient;
  quoteTemplates: QuoteTemplatesApiClient;
  quotes: QuotesApiClient;
  shops: ShopsApiClient;
  shopsForAccessToken(accessToken: string): ShopsApiClient;
}>;

const ModuleClientsContext = createContext<ModuleClients | null>(null);

/** Composition root des façades `/api/v1` consommées par l'application. */
export function ModuleClientsProvider({ children }: { children: ReactNode }) {
  const apiRuntime = useApiRuntime();
  const clients = useMemo<ModuleClients>(
    () => ({
      orders: new OrdersApiClient(apiRuntime.client),
      quoteTemplates: new QuoteTemplatesApiClient(apiRuntime.client),
      quotes: new QuotesApiClient(apiRuntime.client),
      shops: new ShopsApiClient(apiRuntime.client),
      shopsForAccessToken: (accessToken) => new ShopsApiClient(
        apiRuntime.forAccessToken(accessToken),
      ),
    }),
    [apiRuntime],
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

export function useQuoteTemplatesApi(): QuoteTemplatesApiClient {
  const clients = useContext(ModuleClientsContext);
  if (!clients) throw new Error('useQuoteTemplatesApi must be used within a ModuleClientsProvider');
  return clients.quoteTemplates;
}

export function useQuotesApi(): QuotesApiClient {
  const clients = useContext(ModuleClientsContext);
  if (!clients) throw new Error('useQuotesApi must be used within a ModuleClientsProvider');
  return clients.quotes;
}

export function useShopsApi(): ShopsApiClient {
  const clients = useContext(ModuleClientsContext);
  if (!clients) throw new Error('useShopsApi must be used within a ModuleClientsProvider');
  return clients.shops;
}

export function useShopsApiFactory(): ModuleClients['shopsForAccessToken'] {
  const clients = useContext(ModuleClientsContext);
  if (!clients) throw new Error('useShopsApiFactory must be used within a ModuleClientsProvider');
  return clients.shopsForAccessToken;
}
