import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { FetchApiClient } from '../../platform/api';

type StorefrontApiRuntime = Readonly<{
  client: FetchApiClient;
}>;

const StorefrontApiRuntimeContext = createContext<StorefrontApiRuntime | null>(null);

/** Transport storefront autonome : cookies same-origin, aucun token Magrit. */
export function StorefrontApiRuntimeProvider({ children }: { children: ReactNode }) {
  const runtime = useMemo<StorefrontApiRuntime>(
    () => ({ client: new FetchApiClient('', globalThis.fetch) }),
    [],
  );

  return (
    <StorefrontApiRuntimeContext.Provider value={runtime}>
      {children}
    </StorefrontApiRuntimeContext.Provider>
  );
}

export function useStorefrontApiRuntime(): StorefrontApiRuntime {
  const runtime = useContext(StorefrontApiRuntimeContext);
  if (!runtime) {
    throw new Error('Storefront runtime requires StorefrontApiRuntimeProvider');
  }
  return runtime;
}
