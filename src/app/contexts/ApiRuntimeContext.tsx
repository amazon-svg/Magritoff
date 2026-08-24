import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { FetchApiClient } from '@/platform/api';
import { useAuth } from '@/modules/account/ui/runtime';

type ApiRuntime = Readonly<{
  client: FetchApiClient;
  anonymousClient: FetchApiClient;
  forAccessToken(accessToken: string): FetchApiClient;
}>;

const ApiRuntimeContext = createContext<ApiRuntime | null>(null);

/**
 * Point de composition HTTP unique du navigateur.
 *
 * Les modules métier reçoivent ce transport et ne connaissent ni React, ni la
 * façon dont le jeton utilisateur est obtenu. Un changement de session recrée
 * une seule instance, partagée par tous les providers et écrans descendants.
 */
export function ApiRuntimeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const runtime = useMemo<ApiRuntime>(
    () => ({
      client: new FetchApiClient('', globalThis.fetch, () => session?.access_token ?? null),
      anonymousClient: new FetchApiClient('', globalThis.fetch),
      forAccessToken: (accessToken) => new FetchApiClient('', globalThis.fetch, () => accessToken),
    }),
    [session?.access_token],
  );

  return <ApiRuntimeContext.Provider value={runtime}>{children}</ApiRuntimeContext.Provider>;
}

export function useApiRuntime(): ApiRuntime {
  const runtime = useContext(ApiRuntimeContext);
  if (!runtime) throw new Error('useApiRuntime must be used within an ApiRuntimeProvider');
  return runtime;
}

export function useApiRuntimeClient(): FetchApiClient {
  return useApiRuntime().client;
}
