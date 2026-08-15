import { describe, expect, it } from 'vitest';
import { portalRuntimePaths, shopRootPath } from '../../src/app/surfaces/portalRuntimePaths';

describe('chemins runtime du portail', () => {
  it('résout les routes host depuis les contributions de surfaces', () => {
    expect(portalRuntimePaths).toEqual({
      shopRoot: 'shop/:slug',
      checkout: 'checkout',
      accountOrders: 'account/orders',
      accountQuotes: 'account/quotes',
      accountProfile: 'account/profile',
    });
  });

  it('injecte le slug dans la racine storefront déclarée', () => {
    expect(shopRootPath('boutique-1')).toBe('/shop/boutique-1');
  });
});
