import type { PostgresShopSitemapRepository } from '../../adapters/postgres/shop-sitemap-repository.ts';

const LEGACY_PATH = '/api/v1/shop-sitemap';
const CANONICAL_PATH = /^\/api\/v1\/public\/shops\/([^/]+)\/sitemap\.xml$/;
const XML_HEADERS = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=3600',
};

export function isShopSitemapRequest(pathname: string): boolean {
  return pathname === LEGACY_PATH || CANONICAL_PATH.test(pathname);
}

export function createShopSitemapHandler(
  repository: Pick<PostgresShopSitemapRepository, 'findPublicShop'>,
  configuredOrigin?: string,
): (request: Request) => Promise<Response> {
  const publicOrigin = configuredOrigin === undefined ? null : normalizedOrigin(configuredOrigin);
  return async (request) => {
    if (request.method !== 'GET') return text('method_not_allowed', 405);
    const url = new URL(request.url);
    const slug = sitemapSlug(url);
    if (slug === null) return text('missing_slug', 400);

    const shop = await repository.findPublicShop(slug);
    if (shop === null) return text('not_found', 404);

    const origin = publicOrigin ?? url.origin;
    const shopBase = `${origin}/shop/${encodeURIComponent(shop.shopSlug)}`;
    const locations = [
      shopBase,
      ...shop.gammeSlugs.map((gamme) => `${shopBase}/g/${encodeURIComponent(gamme)}`),
    ];
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n`
      + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
      + locations.map((location) => `  <url><loc>${xmlEscape(location)}</loc></url>`).join('\n')
      + '\n</urlset>\n';
    return new Response(body, { status: 200, headers: XML_HEADERS });
  };
}

function sitemapSlug(url: URL): string | null {
  const match = CANONICAL_PATH.exec(url.pathname);
  let value: string;
  try {
    value = match === null ? (url.searchParams.get('slug') ?? '') : decodeURIComponent(match[1] ?? '');
  } catch {
    return null;
  }
  const slug = value.trim();
  return slug.length > 0 && slug.length <= 200 ? slug : null;
}

function normalizedOrigin(value: string): string {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('APP_BASE_URL invalide pour le sitemap public.');
  }
  return url.origin;
}

function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function text(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
