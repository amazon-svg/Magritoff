import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { ClariprintPricingGateway } from '../../modules/clariprint';
import type { BrowserRuntime } from '../../platform/runtime';
import { useApiRuntimeClient } from './ApiRuntimeContext';

type BrowserServices = Readonly<{
  clariprint: ClariprintPricingGateway;
}>;

const BrowserServicesContext = createContext<BrowserServices | null>(null);

export function BrowserServicesProvider({
  children,
  runtime,
}: {
  children: ReactNode;
  runtime: BrowserRuntime;
}) {
  const apiClient = useApiRuntimeClient();
  const services = useMemo<BrowserServices>(
    () => ({ clariprint: runtime.createClariprint(apiClient) }),
    [apiClient, runtime],
  );

  return (
    <BrowserServicesContext.Provider value={services}>
      {children}
    </BrowserServicesContext.Provider>
  );
}

export function useBrowserServices(): BrowserServices {
  const services = useContext(BrowserServicesContext);
  if (!services) {
    throw new Error('useBrowserServices must be used within a BrowserServicesProvider');
  }
  return services;
}
