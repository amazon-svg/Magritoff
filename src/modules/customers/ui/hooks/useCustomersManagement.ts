import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { CustomersApiClient } from '@/modules/customers/api/client';
import type { CreateCustomerCommand, CustomerDto, CustomerType } from '@/modules/customers/api/contracts';

export function customersManagementError(
  cause: unknown,
  fallback = 'Opération sur le référentiel client impossible.',
): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

/**
 * Liste + recherche des clients du tenant courant (CA1). Le tenant est
 * resolu par la facade depuis le jeton (CA4 du socle E10.0) : ce hook ne le
 * transmet jamais dans un chemin ni une query, `useWorkspaceApi` porte deja
 * l authentification.
 */
export function useCustomersManagement(enabled: boolean) {
  const api = useWorkspaceApi(CustomersApiClient);
  const requestVersion = useRef(0);
  const [items, setItems] = useState<readonly CustomerDto[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [type, setType] = useState<CustomerType | null>(null);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!enabled) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await api.list({ ...(q ? { q } : {}), ...(type ? { type } : {}) });
      if (version === requestVersion.current) setItems(response.items);
    } catch (cause) {
      if (version === requestVersion.current) {
        setError(customersManagementError(cause, 'Chargement des clients impossible.'));
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [api, enabled, q, type]);

  useEffect(() => {
    void load();
    return () => {
      requestVersion.current += 1;
    };
  }, [load]);

  const create = useCallback(
    async (command: CreateCustomerCommand): Promise<CustomerDto> => {
      const created = await api.create(command);
      await load();
      return created;
    },
    [api, load],
  );

  return {
    items,
    loading,
    error,
    q,
    setQ,
    type,
    setType,
    refresh: load,
    create,
  } as const;
}
