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

  it('orders → alias legacy vers account/orders (S7.10, query préservée par PublicShop)', () => {
    expect(parsePortalPath('orders')).toEqual({
      view: 'account',
      accountSection: 'orders',
      redirected: true,
    });
  });

  it('account/orders|quotes|profile → sections du hub (S7.10)', () => {
    expect(parsePortalPath('account/orders')).toEqual({
      view: 'account',
      accountSection: 'orders',
      redirected: false,
    });
    expect(parsePortalPath('account/quotes')).toEqual({
      view: 'account',
      accountSection: 'quotes',
      redirected: false,
    });
    expect(parsePortalPath('account/profile')).toEqual({
      view: 'account',
      accountSection: 'profile',
      redirected: false,
    });
  });

  it('thank-you → thankYou', () => {
    expect(parsePortalPath('thank-you')).toEqual({ view: 'thankYou', redirected: false });
  });

  it('account nu ou section inconnue → account/orders canonique (redirected)', () => {
    expect(parsePortalPath('account')).toEqual({
      view: 'account',
      accountSection: 'orders',
      redirected: true,
    });
    expect(parsePortalPath('account/nimporte')).toEqual({
      view: 'account',
      accountSection: 'orders',
      redirected: true,
    });
  });

  it('g/:gamme → vue gamme (S7.3, page gamme-configurateur)', () => {
    expect(parsePortalPath('g/flyer')).toEqual({
      view: 'gamme',
      gammeSlug: 'flyer',
      redirected: false,
    });
  });

  it('g sans slug ou trop profond → repli catalog (redirected)', () => {
    expect(parsePortalPath('g')).toEqual({ view: 'catalog', redirected: true });
    expect(parsePortalPath('g/flyer/x')).toEqual({ view: 'catalog', redirected: true });
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
    ['gamme', 'flyer'],
    ['account', 'quotes'],
    ['thankYou', undefined],
  ];

  it.each(cases)('round-trip %s', (view, param) => {
    const path = portalPathForView(view, param);
    const match = parsePortalPath(path);
    expect(match.view).toBe(view);
    expect(match.redirected).toBe(false);
    if (view === 'product') expect(match.productId).toBe(param);
    if (view === 'gamme') expect(match.gammeSlug).toBe(param);
    if (view === 'account') expect(match.accountSection).toBe(param);
  });

  it('orders (alias S7.10) → chemin canonique account/orders', () => {
    expect(portalPathForView('orders')).toBe('account/orders');
    const match = parsePortalPath(portalPathForView('orders'));
    expect(match.view).toBe('account');
    expect(match.accountSection).toBe('orders');
    expect(match.redirected).toBe(false);
  });

  it('product sans id → catalog (pas d URL inadressable)', () => {
    expect(portalPathForView('product')).toBe('catalog');
  });

  it('gamme sans slug → catalog (S7.3)', () => {
    expect(portalPathForView('gamme')).toBe('catalog');
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
    // S7.10 : les commandes vivent sous Mon compte.
    expect(shopUrl('boutique-1', 'orders')).toBe('/shop/boutique-1/account/orders');
    expect(shopUrl('boutique-1', 'product', 'lib-1')).toBe('/shop/boutique-1/p/lib-1');
  });
});
