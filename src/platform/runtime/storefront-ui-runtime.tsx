import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { FetchApiClient } from '../api';
import type { StorefrontBrowserRuntime } from './storefront-browser-runtime';

export type StorefrontUiRuntime = Readonly<{
  apiClient: FetchApiClient;
  assistant: StorefrontBrowserRuntime['assistant'];
  clariprint: ReturnType<StorefrontBrowserRuntime['createClariprint']>;
}>;

const StorefrontUiRuntimeContext = createContext<StorefrontUiRuntime | null>(null);

/** Port neutre de la surface boutique, sans identité workspace. */
export function StorefrontUiRuntimeProvider({
  value,
  children,
}: {
  value: StorefrontUiRuntime;
  children: ReactNode;
}) {
  return (
    <StorefrontUiRuntimeContext.Provider value={value}>
      {children}
    </StorefrontUiRuntimeContext.Provider>
  );
}

export function useStorefrontUiRuntime(): StorefrontUiRuntime {
  const runtime = useContext(StorefrontUiRuntimeContext);
  if (!runtime) {
    throw new Error('Storefront module UI requires StorefrontUiRuntimeProvider');
  }
  return runtime;
}

type ApiClientConstructor<T> = new (client: FetchApiClient) => T;

export function useStorefrontApi<T>(Client: ApiClientConstructor<T>): T {
  const { apiClient } = useStorefrontUiRuntime();
  return useMemo(() => new Client(apiClient), [Client, apiClient]);
}
