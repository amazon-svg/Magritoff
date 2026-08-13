import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { FetchApiClient } from '../../platform/api';
import { useAuth } from './AuthContext';

const ApiRuntimeContext = createContext<FetchApiClient | null>(null);

/**
 * Point de composition HTTP unique du navigateur.
 *
 * Les modules métier reçoivent ce transport et ne connaissent ni React, ni la
 * façon dont le jeton utilisateur est obtenu. Un changement de session recrée
 * une seule instance, partagée par tous les providers et écrans descendants.
 */
export function ApiRuntimeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const client = useMemo(
    () => new FetchApiClient('', globalThis.fetch, () => session?.access_token ?? null),
    [session?.access_token],
  );

  return <ApiRuntimeContext.Provider value={client}>{children}</ApiRuntimeContext.Provider>;
}

export function useApiRuntimeClient(): FetchApiClient {
  const client = useContext(ApiRuntimeContext);
  if (!client) throw new Error('useApiRuntimeClient must be used within an ApiRuntimeProvider');
  return client;
}
