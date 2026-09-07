import { describe, expect, it } from 'vitest';
import { portalRuntimePaths, shopRootPath } from '@/app/surfaces/portalRuntimePaths';

describe('chemins runtime du portail', () => {
  it('résout les routes host depuis les contributions de surfaces', () => {
    expect(portalRuntimePaths).toEqual({
      shopRoot: 'shop/:slug',
      activation: 'activate',
      passwordReset: 'reset-password',
      checkout: 'checkout',
      orderConfirmation: 'thank-you',
      catalog: 'catalog',
      gamme: 'g/:gammeSlug',
      product: 'p/:productId',
      accountOrders: 'account/orders',
      accountQuotes: 'account/quotes',
      accountProfile: 'account/profile',
    });
  });

  it('injecte le slug dans la racine storefront déclarée', () => {
    expect(shopRootPath('boutique-1')).toBe('/shop/boutique-1');
  });
});
