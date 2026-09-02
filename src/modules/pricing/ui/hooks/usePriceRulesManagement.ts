import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { PriceRulesApiClient } from '@/modules/pricing/api/client';
import type { CreatePriceRuleCommand, PriceRuleDto, PriceRuleStatusFilter } from '@/modules/pricing/api/contracts';

export function pricingManagementError(
  cause: unknown,
  fallback = 'Opération sur le référentiel de prix impossible.',
): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

/**
 * Liste + recherche + filtre par statut des regles de prix du tenant courant
 * (CA5). Le tenant est resolu par la facade depuis le jeton (CA4 du socle
 * E10.0) : ce hook ne le transmet jamais dans un chemin ni une query.
 */
export function usePriceRulesManagement(enabled: boolean) {
  const api = useWorkspaceApi(PriceRulesApiClient);
  const requestVersion = useRef(0);
  const [items, setItems] = useState<readonly PriceRuleDto[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<PriceRuleStatusFilter | null>(null);

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
      const response = await api.list({ ...(q ? { q } : {}), ...(status ? { status } : {}) });
      if (version === requestVersion.current) setItems(response.items);
    } catch (cause) {
      if (version === requestVersion.current) {
        setError(pricingManagementError(cause, 'Chargement des règles de prix impossible.'));
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [api, enabled, q, status]);

  useEffect(() => {
    void load();
    return () => {
      requestVersion.current += 1;
    };
  }, [load]);

  const create = useCallback(
    async (command: CreatePriceRuleCommand): Promise<PriceRuleDto> => {
      const created = await api.create(command);
      await load();
      return created;
    },
    [api, load],
  );

  /**
   * Bascule `is_active` (CA — pastille verte/grise). Relit l ETag courant
   * avant l ecriture : la liste n en emet jamais (contrat), seul
   * `getPriceRule` fait foi pour le `If-Match` (meme discipline que
   * `updateCustomer`/`updateProject`).
   */
  const toggleActive = useCallback(
    async (rule: PriceRuleDto): Promise<void> => {
      const current = await api.getForEdit(rule.id);
      if (!current.etag) throw new Error('ETag de la règle indisponible.');
      await api.toggleActive(rule.id, !rule.is_active, current.etag);
      await load();
    },
    [api, load],
  );

  return {
    items,
    loading,
    error,
    q,
    setQ,
    status,
    setStatus,
    refresh: load,
    create,
    toggleActive,
  } as const;
}
