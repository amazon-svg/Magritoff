import type { SurfaceDefinition } from '@/surfaces/registry';
import { customerPortalSurface } from '@/surfaces/customer-portal';
import { storefrontSurface } from '@/surfaces/storefront';

export const portalRuntimePaths = Object.freeze({
  shopRoot: requiredHostPath(storefrontSurface, 'shops.storefront.root'),
  activation: requiredHostPath(storefrontSurface, 'shop-customers.storefront.activate'),
  passwordReset: requiredHostPath(storefrontSurface, 'shop-customers.storefront.reset-password'),
  checkout: requiredHostPath(storefrontSurface, 'orders.storefront.checkout'),
  orderConfirmation: requiredHostPath(storefrontSurface, 'orders.storefront.confirmation'),
  catalog: requiredHostPath(storefrontSurface, 'catalog.storefront.list'),
  gamme: requiredHostPath(storefrontSurface, 'catalog.storefront.gamme'),
  product: requiredHostPath(storefrontSurface, 'catalog.storefront.product'),
  accountOrders: requiredHostPath(customerPortalSurface, 'orders.customer-portal.list'),
  // `accountQuotes` retire au chantier d unification des devis (post Sprint 5 :
  // docs/api/CONVENTIONS.md §8.10) — la contribution de surface
  // `quotes.customer-portal.list` (ancien module, backend disparu) est
  // supprimee. Le point d entree boutique reste a concevoir sur
  // `commercial_quotes` par une story future.
  accountProfile: requiredHostPath(customerPortalSurface, 'account.customer-portal.profile'),
});

export function shopRootPath(slug: string): string {
  return `/${portalRuntimePaths.shopRoot.replace(':slug', slug)}`;
}

function requiredHostPath(surface: SurfaceDefinition, routeId: string): string {
  const route = surface.routes.find(({ id }) => id === routeId);
  if (!route || route.mount !== 'host') {
    throw new Error(`Route host ${routeId} absente de la surface ${surface.id}.`);
  }
  return route.path;
}
