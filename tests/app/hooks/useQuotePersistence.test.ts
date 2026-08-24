import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('useQuotePersistence', () => {
  const hook = readFileSync(
    resolve(process.cwd(), 'src/modules/quotes/ui/hooks/useQuotePersistence.ts'),
    'utf8',
  );

  it('compose la façade Quotes dans un hook workspace', () => {
    expect(hook).toContain('useWorkspaceApi(QuotesApiClient)');
    expect(hook).toContain('persistQuote(quotesApi, tenantId, input)');
    expect(hook).not.toContain('utils/supabase');
    expect(hook).not.toMatch(/\bsupabase\s*\./);
  });
});
