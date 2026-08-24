import { describe, expect, it } from 'vitest';
import { ApiClientError } from '@/platform/api';
import { isMissingStorefrontSession } from '@/modules/shop-customers/ui/hooks/useStorefrontSession';

function apiError(status: number, code: string): ApiClientError {
  return new ApiClientError({
    type: 'about:blank',
    title: 'Erreur storefront',
    status,
    code,
    requestId: 'test-request',
  });
}

describe('useStorefrontSession helpers', () => {
  it('traite uniquement un 401 comme une absence normale de session', () => {
    expect(isMissingStorefrontSession(apiError(401, 'storefront.session_required'))).toBe(true);
  });

  it('ne transforme pas une panne du BFF en visiteur déconnecté', () => {
    expect(isMissingStorefrontSession(apiError(503, 'api.unavailable'))).toBe(false);
    expect(isMissingStorefrontSession(new TypeError('network failed'))).toBe(false);
  });
});
