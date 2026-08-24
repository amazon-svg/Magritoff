import { useWorkspaceApi, useWorkspaceUiRuntime } from '@/platform/runtime/workspace-ui-runtime';
import { QuotesApiClient } from '@/modules/quotes';
import type { QuoteRowInput } from '@/modules/quotes/ui/helpers/quote';
import { persistQuote } from '@/modules/quotes/ui/helpers/quote';

export function useQuotePersistence() {
  const quotesApi = useWorkspaceApi(QuotesApiClient);

  const persist = async (tenantId: string, input: QuoteRowInput) => {
    await persistQuote(quotesApi, tenantId, input);
  };

  return { persist } as const;
}
