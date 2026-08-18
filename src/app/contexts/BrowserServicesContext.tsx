import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { ClariprintPricingGateway } from '../../modules/clariprint';
import type { AssistantGateway } from '../../modules/diagnostics';
import type { MockupGateway } from '../../modules/shops';
import type { BrowserRuntime } from '../../platform/runtime';
import { useApiRuntime } from './ApiRuntimeContext';

type BrowserServices = Readonly<{
  assistant: AssistantGateway;
  clariprint: ClariprintPricingGateway;
  storefrontClariprint: ClariprintPricingGateway;
  mockups: MockupGateway;
}>;

const BrowserServicesContext = createContext<BrowserServices | null>(null);

export function BrowserServicesProvider({
  children,
  runtime,
}: {
  children: ReactNode;
  runtime: BrowserRuntime;
}) {
  const apiRuntime = useApiRuntime();
  const services = useMemo<BrowserServices>(
    () => ({
      assistant: runtime.assistant,
      clariprint: runtime.createClariprint(apiRuntime.client),
      storefrontClariprint: runtime.createClariprint(apiRuntime.anonymousClient),
      mockups: runtime.mockups,
    }),
    [apiRuntime, runtime],
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

/** Passerelle devis publique du storefront, sans bearer Magrit. */
export function useStorefrontClariprint(): ClariprintPricingGateway {
  return useBrowserServices().storefrontClariprint;
}
