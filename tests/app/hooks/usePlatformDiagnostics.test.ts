import { describe, expect, it } from 'vitest';
import {
  diagnosticRequestError,
  emptyDiagnosticResult,
} from '@/modules/diagnostics/ui/hooks/usePlatformDiagnostics';

describe('usePlatformDiagnostics helpers', () => {
  it('initialise un test sans résultat ni erreur', () => {
    expect(emptyDiagnosticResult()).toEqual({
      loading: false,
      data: null,
      error: null,
    });
  });

  it('conserve le format historique des erreurs réseau', () => {
    expect(diagnosticRequestError(new Error('API indisponible')))
      .toBe('Error: API indisponible');
    expect(diagnosticRequestError('timeout')).toBe('timeout');
  });
});
