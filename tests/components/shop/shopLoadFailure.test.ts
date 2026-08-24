import { describe, expect, it } from 'vitest';
import { ApiClientError } from '@/platform/api';
import { classifyShopLoadFailure } from '@/modules/shops/ui/storefront/shopLoadFailure';

function apiError(status: number): ApiClientError {
  return new ApiClientError({
    type: 'about:blank',
    title: 'Erreur boutique',
    status,
    code: `shop.${status}`,
    requestId: 'test-request',
  });
}

describe('classifyShopLoadFailure', () => {
  it('réserve portail introuvable aux vrais 404', () => {
    expect(classifyShopLoadFailure(apiError(404), 'probe')).toBe('not_found');
    expect(classifyShopLoadFailure(apiError(503), 'probe')).toBe('unavailable');
    expect(classifyShopLoadFailure(new TypeError('network failed'), 'probe')).toBe('unavailable');
  });

  it('interprète 401/403 comme authentification uniquement pendant le catalogue', () => {
    expect(classifyShopLoadFailure(apiError(401), 'catalog')).toBe('authentication_required');
    expect(classifyShopLoadFailure(apiError(403), 'catalog')).toBe('authentication_required');
    expect(classifyShopLoadFailure(apiError(401), 'probe')).toBe('unavailable');
  });
});
