import { useCallback, useEffect, useState } from 'react';
import { useStorefrontApi } from '@/platform/runtime/storefront-ui-runtime';
import { StorefrontQuotesApiClient } from '@/modules/storefront-quotes';
import type { StorefrontQuoteDecision, StorefrontQuoteDetailDto, StorefrontQuoteDto } from '@/modules/storefront-quotes';

/**
 * Lecture des devis du portail client (story E10.10b-1), plus DECISION
 * (E10.10b-2). Aucun calcul ni aucune garde metier ici : le statut, la
 * peremption et la precondition de concurrence font foi cote API — ce hook ne
 * fait que relayer l `ETag` deja lu vers `decide()`.
 */
export function useStorefrontQuotesList(enabled: boolean) {
  const quotesApi = useStorefrontApi(StorefrontQuotesApiClient);
  const [quotes, setQuotes] = useState<StorefrontQuoteDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) {
      setQuotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await quotesApi.list();
      setQuotes([...response.items]);
    } catch (cause) {
      console.warn('[StorefrontQuotesList] chargement impossible:', cause);
      setQuotes([]);
      setError(cause instanceof Error ? cause.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [enabled, quotesApi]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Rend le detail ET l `ETag` associe : c est ce dernier que `decide()` doit reprendre en `If-Match`. */
  const getDetail = useCallback(
    (quoteId: string): Promise<{ detail: StorefrontQuoteDetailDto; etag: string | null }> =>
      quotesApi.get(quoteId).then(({ data, etag }) => ({ detail: data, etag })),
    [quotesApi],
  );

  /**
   * E10.10b-2 — ACCEPTE ou REFUSE le devis `quoteId`. `ifMatch` DOIT provenir
   * d une lecture reelle (`getDetail`), jamais reconstruit ici : c est
   * exactement le controle que la precondition existe pour verifier.
   */
  const decide = useCallback(
    (
      quoteId: string,
      decision: StorefrontQuoteDecision,
      ifMatch: string,
    ): Promise<{ detail: StorefrontQuoteDetailDto; etag: string | null }> =>
      quotesApi.decide(quoteId, decision, ifMatch).then(({ data, etag }) => ({ detail: data, etag })),
    [quotesApi],
  );

  return { quotes, loading, error, reload, getDetail, decide } as const;
}
