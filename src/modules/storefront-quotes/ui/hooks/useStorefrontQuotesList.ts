import { useCallback, useEffect, useState } from 'react';
import { useStorefrontApi } from '@/platform/runtime/storefront-ui-runtime';
import { StorefrontQuotesApiClient } from '@/modules/storefront-quotes';
import type { StorefrontQuoteDetailDto, StorefrontQuoteDto } from '@/modules/storefront-quotes';

/**
 * Lecture des devis du portail client (story E10.10b-1). Meme discipline que
 * `useStorefrontOrderList` : aucun calcul ici, la reponse de l API fait deja
 * foi (statuts, totaux, filtrage `show_discounts`).
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

  const getDetail = useCallback(
    (quoteId: string): Promise<StorefrontQuoteDetailDto> => quotesApi.get(quoteId),
    [quotesApi],
  );

  return { quotes, loading, error, reload, getDetail } as const;
}
