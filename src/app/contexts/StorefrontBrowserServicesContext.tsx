import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { ClariprintPricingGateway } from '../../modules/clariprint';
import type { AssistantGateway } from '../../modules/diagnostics';
import type { StorefrontBrowserRuntime } from '../../platform/runtime/storefront-browser-runtime';
import { useStorefrontApiRuntime } from './StorefrontApiRuntimeContext';

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
  runtime: StorefrontBrowserRuntime;
}) {
  const apiRuntime = useStorefrontApiRuntime();
  const services = useMemo<StorefrontBrowserServices>(
    () => ({
      assistant: runtime.assistant,
      clariprint: runtime.createClariprint(apiRuntime.client),
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
