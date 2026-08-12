// Adaptateur fournisseur : relaie Storage et l'Edge Function historique.
const SEGMENT = /^[a-zA-Z0-9_-]{1,200}$/;
const RENDER_PARAMS = ['tenant', 'shop', 'product', 'width', 'height', 'productName', 'primaryColor', 'template', 'view'] as const;

export function isMockupBinaryRequest(request: Request): boolean {
  const path = apiPath(request);
  return request.method === 'GET' && (path.startsWith('/api/v1/mockups/public/') || path === '/api/v1/mockups/render');
}

export async function proxyMockupBinary(request: Request, supabaseUrl: string, anonKey: string, fetchImplementation: typeof fetch = globalThis.fetch): Promise<Response> {
  const url = new URL(request.url);
  const path = apiPath(request);
  let upstream: string;
  if (path.startsWith('/api/v1/mockups/public/')) {
    const segments = path.slice('/api/v1/mockups/public/'.length).split('/');
    if (segments.length !== 3 || !segments.every((segment) => SEGMENT.test(segment.replace(/\.png$/, '')))) return Response.json({ error: 'invalid_mockup_path' }, { status: 422 });
    upstream = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/product_mockups/${segments.join('/')}`;
  } else {
    const forwarded = new URLSearchParams();
    for (const name of RENDER_PARAMS) { const value = url.searchParams.get(name); if (value !== null) forwarded.set(name, value); }
    if (!validRender(forwarded)) return Response.json({ error: 'invalid_mockup_specs' }, { status: 422 });
    upstream = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/mockup-generator?${forwarded}`;
  }
  try {
    const response = await fetchImplementation(upstream, { headers: { Authorization: `Bearer ${anonKey}` }, signal: request.signal, redirect: 'follow' });
    const headers = new Headers();
    headers.set('Content-Type', response.headers.get('content-type') ?? 'application/octet-stream');
    headers.set('Cache-Control', response.headers.get('cache-control') ?? 'public, max-age=300');
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    return Response.json({ error: 'mockup_upstream_unavailable', detail: error instanceof Error ? error.message : 'Erreur réseau' }, { status: 502 });
  }
}

function apiPath(request: Request): string { const path = new URL(request.url).pathname; const index = path.indexOf('/api/v1/'); return index >= 0 ? path.slice(index) : path; }
function validRender(params: URLSearchParams): boolean {
  if (!['tenant', 'shop', 'product'].every((name) => SEGMENT.test(params.get(name) ?? ''))) return false;
  const width = Number(params.get('width')); const height = Number(params.get('height'));
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return false;
  const color = params.get('primaryColor') ?? ''; const name = params.get('productName') ?? '';
  return /^#[0-9a-fA-F]{6}$/.test(color) && name.length > 0 && name.length <= 200 && (!params.has('view') || params.get('view') === 'back');
}
