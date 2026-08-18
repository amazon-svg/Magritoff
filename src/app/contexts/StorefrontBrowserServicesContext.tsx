import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { ClariprintPricingGateway } from '../../modules/clariprint';
import type { AssistantGateway } from '../../modules/diagnostics';
import type { BrowserRuntime } from '../../platform/runtime';
import { useApiRuntime } from './ApiRuntimeContext';

type StorefrontBrowserServices = Readonly<{
  assistant: AssistantGateway;
  clariprint: ClariprintPricingGateway;
}>;

const StorefrontBrowserServicesContext = createContext<StorefrontBrowserServices | null>(null);

/** Gateways storefront : cookie HttpOnly uniquement, bearer Magrit interdit. */
export function StorefrontBrowserServicesProvider({
  children,
  runtime,
}: {
  children: ReactNode;
  runtime: BrowserRuntime;
}) {
  const apiRuntime = useApiRuntime();
  const services = useMemo<StorefrontBrowserServices>(
    () => ({
      assistant: runtime.storefrontAssistant,
      clariprint: runtime.createClariprint(apiRuntime.anonymousClient),
    }),
    [apiRuntime, runtime],
  );

  return (
    <StorefrontBrowserServicesContext.Provider value={services}>
      {children}
    </StorefrontBrowserServicesContext.Provider>
  );
}

function useStorefrontBrowserServices(): StorefrontBrowserServices {
  const services = useContext(StorefrontBrowserServicesContext);
  if (!services) {
    throw new Error('Storefront services require StorefrontBrowserServicesProvider');
  }
  return services;
}

export function useStorefrontClariprint(): ClariprintPricingGateway {
  return useStorefrontBrowserServices().clariprint;
}

export function useStorefrontAssistant(): AssistantGateway {
  return useStorefrontBrowserServices().assistant;
}
