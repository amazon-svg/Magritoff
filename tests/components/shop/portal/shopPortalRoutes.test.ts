import { describe, expect, it } from 'vitest';
import {
  parsePortalPath,
  portalPathForView,
  shopUrl,
} from '../../../../src/app/components/shop/portal/shopPortalRoutes';
import type { PortalView } from '../../../../src/app/components/shop/portal/types';

describe('parsePortalPath (S7.1 AC1/AC3)', () => {
  it('splat vide ou undefined → home', () => {
    expect(parsePortalPath(undefined)).toEqual({ view: 'home', redirected: false });
    expect(parsePortalPath('')).toEqual({ view: 'home', redirected: false });
    expect(parsePortalPath('/')).toEqual({ view: 'home', redirected: false });
  });

  it('catalog → catalog', () => {
    expect(parsePortalPath('catalog')).toEqual({ view: 'catalog', redirected: false });
  });

  it('p/:id → product avec productId (ids library lib-<uuid> inclus)', () => {
    expect(parsePortalPath('p/abc-123')).toEqual({
      view: 'product',
      productId: 'abc-123',
      redirected: false,
    });
    expect(parsePortalPath('p/lib-92fbedaa-8297-4a5d-8418-0918f6ebf1be').productId).toBe(
      'lib-92fbedaa-8297-4a5d-8418-0918f6ebf1be',
    );
  });

  it('p sans id → repli catalog (redirected)', () => {
    expect(parsePortalPath('p')).toEqual({ view: 'catalog', redirected: true });
    expect(parsePortalPath('p/x/y')).toEqual({ view: 'catalog', redirected: true });
  });

  it('orders → orders (le ?tab= est hors splat, géré par PortalOrders)', () => {
    expect(parsePortalPath('orders')).toEqual({ view: 'orders', redirected: false });
  });

  it('thank-you → thankYou', () => {
    expect(parsePortalPath('thank-you')).toEqual({ view: 'thankYou', redirected: false });
  });

  it('account/* → orders en placeholder S7.10 (redirected)', () => {
    expect(parsePortalPath('account')).toEqual({ view: 'orders', redirected: true });
    expect(parsePortalPath('account/orders')).toEqual({ view: 'orders', redirected: true });
    expect(parsePortalPath('account/profile')).toEqual({ view: 'orders', redirected: true });
  });

  it('g/:gamme → catalog avec gammeSlug conservé (réservé S7.3)', () => {
    expect(parsePortalPath('g/flyer')).toEqual({
      view: 'catalog',
      gammeSlug: 'flyer',
      redirected: true,
    });
  });

  it('chemin inconnu → home (jamais de 404 interne, AC3)', () => {
    expect(parsePortalPath('nimporte-quoi')).toEqual({ view: 'home', redirected: true });
    expect(parsePortalPath('portal/deep/x')).toEqual({ view: 'home', redirected: true });
  });

  it('tolère les slashes multiples', () => {
    expect(parsePortalPath('//catalog//')).toEqual({ view: 'catalog', redirected: false });
  });
});

describe('portalPathForView round-trip (S7.1 AC5)', () => {
  const cases: Array<[PortalView, string | undefined]> = [
    ['home', undefined],
    ['catalog', undefined],
    ['product', 'prod-1'],
    ['orders', undefined],
    ['thankYou', undefined],
  ];

  it.each(cases)('round-trip %s', (view, productId) => {
    const path = portalPathForView(view, productId);
    const match = parsePortalPath(path);
    expect(match.view).toBe(view);
    expect(match.redirected).toBe(false);
    if (productId) expect(match.productId).toBe(productId);
  });

  it('product sans id → catalog (pas d URL inadressable)', () => {
    expect(portalPathForView('product')).toBe('catalog');
  });

  it('cart (drawer, pas une page) → catalog', () => {
    expect(portalPathForView('cart')).toBe('catalog');
  });
});

describe('shopUrl', () => {
  it('home sans trailing slash', () => {
    expect(shopUrl('boutique-1', 'home')).toBe('/shop/boutique-1');
  });
  it('vues profondes', () => {
    expect(shopUrl('boutique-1', 'orders')).toBe('/shop/boutique-1/orders');
    expect(shopUrl('boutique-1', 'product', 'lib-1')).toBe('/shop/boutique-1/p/lib-1');
  });
});
