import { describe, expect, it } from 'vitest';
import {
  diagnosticRequestError,
  emptyDiagnosticResult,
} from '@/modules/diagnostics/ui/hooks/usePlatformDiagnostics';
import { ApiClientError } from '@/platform/api';

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

  it('BCP-0c (docs/api/CONVENTIONS.md §8.25, point 2.3ter) — remplace le 403 identity.role_required par un message clair, jamais l erreur brute', () => {
    const forbidden = new ApiClientError({
      type: 'about:blank',
      title: 'Habilitation insuffisante',
      status: 403,
      code: 'identity.role_required',
      requestId: 'req-1',
      detail: 'Ce diagnostic est réservé à l’administrateur de la plateforme (is_super_admin()).',
    });
    expect(diagnosticRequestError(forbidden)).toBe('Réservé à l’administrateur de la plateforme.');
  });

  it('ne masque PAS un autre 403 ni une autre erreur ApiClientError — seul identity.role_required est reecrit', () => {
    const otherForbidden = new ApiClientError({
      type: 'about:blank',
      title: 'Autre refus',
      status: 403,
      code: 'auth.scope_forbidden',
      requestId: 'req-2',
    });
    expect(diagnosticRequestError(otherForbidden)).toBe(String(otherForbidden));
  });
});
