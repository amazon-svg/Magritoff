import type { Page } from '@playwright/test';
import type { ShopDto } from '../../../src/modules/shops';

const tenantId = '20000000-0000-4000-8000-000000000001';
const libraryId = '51000000-0000-4000-8000-000000000002';
const shopId = '51000000-0000-4000-8000-000000000001';
const prefix = `/api/v1/tenants/${tenantId}`;
const path = '/t/magrit-development/dashboard/shops';
const original: ShopDto = { id: shopId, tenantId, ownerUserId: '10000000-0000-4000-8000-000000000001',
  slug: 'boutique-recette-ux', name: 'Boutique de recette', description: 'Produits et accès clients',
  theme: { primaryColor: '#0f172a', accentColor: '#16a34a', mode: 'light' }, logoUrl: '',
  address: '', contactEmail: '', active: true, libraryIds: [], excludedProductIds: [],
  heroImageUrl: null, tagline: null, pimCatalogMode: false, pimGammeSlugs: [], accessMode: 'invite_only',
  createdAt: '2026-10-09T08:00:00Z' };

// Session et mutations métier simulées ; aucune donnée métier ni session réelle créée.
export async function fixture(page: Page, failList = false) {
  let shop = { ...original };
  let listFailures = failList ? 1 : 0;
  let creationFails = true;
  let saveFails = true;
  const writes: string[] = [];
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const method = request.method();
    if (pathname === '/api/v1/auth/get-session') return route.fulfill({ json: { user: { id: original.ownerUserId, email: 'recette@example.invalid', name: 'Recette UX' } } });
    if (pathname === '/api/v1/session') return route.fulfill({ json: { user: { id: original.ownerUserId }, isSuperAdmin: true,
      tenants: [{ id: tenantId, slug: 'magrit-development', name: 'Espace de recette', parent_tenant_id: null, plan: 'pro', is_system_tenant: false, settings: {}, created_at: original.createdAt, myRole: 'admin', accessScope: 'magrit_full', allowedShopIds: [], permissions: { can_quote: true, can_order: true, can_invite: true }, inheritedFromParent: false }],
      preferences: { theme: 'light', language: 'fr', default_delivery_zone: '', notifications_email: false, plan: 'pro', is_admin: true, last_tenant_id: tenantId } } });
    if (pathname === `${prefix}/access-profile`) return route.fulfill({ json: { tenantId, userId: original.ownerUserId, membership: 'admin', isAdmin: true, surfaces: ['workspace', 'backoffice'], capabilities: ['shops.manage', 'libraries.manage', 'libraries.read', 'shop-customers.manage'] } });
    if (pathname === '/api/v1/session/current-tenant') return route.fulfill({ json: { updated: true } });
    const problem = () => route.fulfill({ status: 503, json: { type: 'about:blank', title: 'Service temporairement indisponible. Réessayez.', status: 503, code: 'recipe.unavailable', requestId: 'ux' } });
    if (pathname === `${prefix}/shops` && method === 'GET') {
      if (listFailures-- > 0) return problem();
      return route.fulfill({ json: [shop] });
    }
    if (pathname === `${prefix}/shops` && method === 'POST') {
      writes.push('create');
      if (creationFails) { creationFails = false; return problem(); }
      const command = request.postDataJSON();
      shop = { ...shop, ...command, theme: { ...shop.theme, ...command.theme } };
      return route.fulfill({ status: 201, json: shop });
    }
    if (pathname === `${prefix}/shops/${shopId}` && method === 'PATCH') {
      writes.push('save');
      if (saveFails) { saveFails = false; return problem(); }
      const patch = request.postDataJSON();
      shop = { ...shop, ...patch, theme: { ...shop.theme, ...patch.theme } };
      return route.fulfill({ json: shop });
    }
    if (pathname === `${prefix}/shops/${shopId}` && method === 'DELETE') {
      writes.push('delete');
      return problem();
    }
    if (pathname === `${prefix}/libraries`) return route.fulfill({ json: [{ id: libraryId, tenant_id: tenantId, user_id: original.ownerUserId, name: 'Produits de recette', description: '' }] });
    if (pathname === `${prefix}/library-products`) return route.fulfill({ json: [1, 2].map(number => ({ id: `51000000-0000-4000-8000-00000000000${number + 2}`, library_id: libraryId, name: `Article fixe ${number}`, category: 'Articles', description: '', price_ht: 100, image_url: '', config: { pricing_mode: 'fixed_unit' }, active: true, gamme_slug: null })) });
    if (pathname === '/api/v1/catalog/pim') return route.fulfill({ json: { gammes: [], definitions: [] } });
    if (pathname === `${prefix}/shops/${shopId}/customers/page`) return route.fulfill({ json: { items: [], nextCursor: null } });
    if ([ `${prefix}/shops/${shopId}/products`, `${prefix}/shops/${shopId}/pricing`, `${prefix}/shops/${shopId}/customers`].includes(pathname)) return route.fulfill({ json: [] });
    if (method === 'GET' || pathname.startsWith('/api/v1/auth/')) return route.continue();
    return problem();
  });
  return { writes };
}

