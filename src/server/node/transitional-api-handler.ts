import type { FetchHandler } from './http-server.ts';

export type TransitionalApiHandlerOptions = Readonly<{
  localHandler: FetchHandler;
  legacyApiUrl?: string;
  fetch?: typeof globalThis.fetch;
  localPaths?: ReadonlySet<string>;
}>;

const DEFAULT_LOCAL_PATHS: ReadonlySet<string> = new Set(['/api/v1/health']);

/**
 * Facade d'etranglement : les routes deja extraites sont traitees par Node,
 * les autres restent temporairement deleguees a l'API historique. L'URL de
 * cette derniere est une configuration de deploiement, jamais exposee au
 * navigateur.
 */
export function createTransitionalApiHandler(options: TransitionalApiHandlerOptions): FetchHandler {
  const localPaths = options.localPaths ?? DEFAULT_LOCAL_PATHS;
  const legacyApiUrl = options.legacyApiUrl === undefined
    ? null
    : normalizeLegacyApiUrl(options.legacyApiUrl);
  const fetchImplementation = options.fetch ?? globalThis.fetch;

  return async (request) => {
    const sourceUrl = new URL(request.url);
    if (localPaths.has(sourceUrl.pathname)) return options.localHandler(request);

    if (legacyApiUrl === null) {
      return problem(503, 'API en cours de migration', 'api.route_not_migrated');
    }

    const targetUrl = new URL(legacyApiUrl);
    targetUrl.pathname = `${targetUrl.pathname.replace(/\/$/, '')}${sourceUrl.pathname}`;
    targetUrl.search = sourceUrl.search;

    const headers = new Headers(request.headers);
    headers.delete('connection');
    headers.delete('content-length');
    headers.delete('host');

    const init: RequestInit & { duplex?: 'half' } = {
      method: request.method,
      headers,
      redirect: 'manual',
      signal: request.signal,
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body;
      init.duplex = 'half';
    }

    try {
      return await fetchImplementation(new Request(targetUrl, init));
    } catch {
      return problem(502, 'API historique indisponible', 'api.legacy_unavailable');
    }
  };
}

function normalizeLegacyApiUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('MAGRIT_LEGACY_API_URL doit utiliser HTTP ou HTTPS.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('MAGRIT_LEGACY_API_URL ne doit contenir ni identifiants, ni query, ni fragment.');
  }
  return url;
}

function problem(status: number, title: string, code: string): Response {
  return Response.json(
    { type: 'about:blank', title, status, code },
    { status, headers: { 'content-type': 'application/problem+json; charset=utf-8' } },
  );
}
