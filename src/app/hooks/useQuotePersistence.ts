import type { QuoteRowInput } from '../utils/quote';
import { persistQuote } from '../utils/quote';
import { useQuotesApi } from '../contexts/ModuleClientsContext';

export function useQuotePersistence() {
  const quotesApi = useQuotesApi();

  const persist = async (tenantId: string, input: QuoteRowInput) => {
    await persistQuote(quotesApi, tenantId, input);
  };

  return { persist } as const;
}
