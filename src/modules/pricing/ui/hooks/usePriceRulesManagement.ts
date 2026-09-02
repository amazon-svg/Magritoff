import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { PriceRulesApiClient, type ListPriceRulesQuery } from '@/modules/pricing/api/client';
import type { CreatePriceRuleCommand, PriceRuleDto, PriceRuleStatusFilter } from '@/modules/pricing/api/contracts';

export function pricingManagementError(
  cause: unknown,
  fallback = 'Opération sur le référentiel de prix impossible.',
): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

/**
 * Liste + recherche + filtres (statut, client, gamme) des regles de prix du
 * tenant courant (CA5). Le tenant est resolu par la facade depuis le jeton
 * (CA4 du socle E10.0) : ce hook ne le transmet jamais dans un chemin ni une
 * query.
 *
 * Pagination par curseur explicite (`loadMore`) : au-dela de la premiere
 * page (`DEFAULT_PAGE_SIZE`), les regles suivantes n apparaissent qu au clic
 * — jamais silencieusement absentes sans que `hasMore` en informe l ecran
 * (qa-review E10.6, B1.5). Un changement de filtre ou de recherche repart
 * toujours de la premiere page : le curseur d une page precedente n a plus
 * de sens pour un autre jeu de filtres (meme regle que `sort` cote contrat).
 */
export function usePriceRulesManagement(enabled: boolean) {
  const api = useWorkspaceApi(PriceRulesApiClient);
  const requestVersion = useRef(0);
  const [items, setItems] = useState<readonly PriceRuleDto[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<PriceRuleStatusFilter | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [productRangeId, setProductRangeId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const baseQuery = useCallback(
    (): ListPriceRulesQuery => ({
      ...(q ? { q } : {}),
      ...(status ? { status } : {}),
      ...(customerId ? { customerId } : {}),
      ...(productRangeId ? { productRangeId } : {}),
    }),
    [q, status, customerId, productRangeId],
  );

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!enabled) {
      setItems([]);
      setNextCursor(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await api.list(baseQuery());
      if (version === requestVersion.current) {
        setItems(response.items);
        setNextCursor(response.nextCursor);
      }
    } catch (cause) {
      if (version === requestVersion.current) {
        setError(pricingManagementError(cause, 'Chargement des règles de prix impossible.'));
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [api, enabled, baseQuery]);

  useEffect(() => {
    void load();
    return () => {
      requestVersion.current += 1;
    };
  }, [load]);

  /**
   * Charge la page suivante en reprenant le MEME jeu de filtres et de tri —
   * un ecart serait de toute facon refuse en 422 par l API (contrat
   * `listPriceRules`).
   */
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const version = requestVersion.current;
    setLoadingMore(true);
    setError(null);
    try {
      const response = await api.list({ ...baseQuery(), pageCursor: nextCursor });
      if (version === requestVersion.current) {
        setItems((previous) => [...previous, ...response.items]);
        setNextCursor(response.nextCursor);
      }
    } catch (cause) {
      if (version === requestVersion.current) {
        setError(pricingManagementError(cause, 'Chargement de la page suivante impossible.'));
      }
    } finally {
      if (version === requestVersion.current) setLoadingMore(false);
    }
  }, [api, baseQuery, nextCursor, loadingMore]);

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
    customerId,
    setCustomerId,
    productRangeId,
    setProductRangeId,
    hasMore: nextCursor !== null,
    loadingMore,
    loadMore,
    refresh: load,
    create,
    toggleActive,
  } as const;
}
