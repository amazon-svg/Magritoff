import type { SurfaceDefinition } from '../../surfaces/registry';
import { customerPortalSurface } from '../../surfaces/customer-portal';
import { storefrontSurface } from '../../surfaces/storefront';

export const portalRuntimePaths = Object.freeze({
  shopRoot: requiredHostPath(storefrontSurface, 'shops.storefront.root'),
  checkout: requiredHostPath(storefrontSurface, 'orders.storefront.checkout'),
  accountOrders: requiredHostPath(customerPortalSurface, 'orders.customer-portal.list'),
  accountQuotes: requiredHostPath(customerPortalSurface, 'quotes.customer-portal.list'),
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
