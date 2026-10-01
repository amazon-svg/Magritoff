import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import storageBuckets from '../../../config/storage-buckets.json';
import {
  isMockupTemplate,
  renderMockupPng,
} from '../../modules/mockups/application/rendering/png-renderer.ts';
import type { MockupTemplate } from '../../modules/mockups/application/rendering/types.ts';

const RENDER_PATH = '/api/v1/mockups/render';
const PUBLIC_PREFIX = '/api/v1/mockups/public/';
const CACHE_VERSION_SUFFIX = '_v7';
const SEGMENT = /^[a-zA-Z0-9_-]{1,200}$/;

export function isMockupRequest(pathname: string): boolean {
  return pathname === RENDER_PATH || pathname.startsWith(PUBLIC_PREFIX);
}

export function createMockupHandler(
  storage: S3Client,
  bucket = storageBuckets.product_mockups,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const url = new URL(request.url);
    if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
    if (url.pathname === RENDER_PATH) return render(url, storage, bucket);
    if (url.pathname.startsWith(PUBLIC_PREFIX)) return serve(url.pathname.slice(PUBLIC_PREFIX.length), storage, bucket);
    return json({ error: 'not_found' }, 404);
  };
}

async function render(url: URL, storage: S3Client, bucket: string): Promise<Response> {
  const parsed = parseSpecs(url.searchParams);
  if (!parsed.ok) return json({ error: parsed.error, param: parsed.param }, 400);
  const key = cacheKey(parsed.specs);
  try {
    await storage.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return new Response(null, {
      status: 302,
      headers: { Location: `${PUBLIC_PREFIX}${key}`, 'X-Mockup-Cache': 'HIT' },
    });
  } catch {
    // Une absence ou une panne de HEAD déclenche un rendu ; le dépôt reste best-effort.
  }

  let bytes: Uint8Array;
  try {
    bytes = renderMockupPng(parsed.specs.template, {
      width: parsed.specs.width,
      height: parsed.specs.height,
      productName: parsed.specs.productName,
    }, { primaryColor: parsed.specs.primaryColor, view: parsed.specs.view });
  } catch (error) {
    console.error('[mockups] rendu PNG impossible', error);
    return json({ error: 'mockup_rendering_unavailable' }, 503);
  }
  let cache = 'MISS';
  try {
    await storage.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentType: 'image/png',
      CacheControl: 'public,max-age=86400',
    }));
  } catch (error) {
    cache = 'MISS-NO-CACHE';
    console.error(`[mockups] dépôt S3 impossible pour ${key}`, error);
  }
  return new Response(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public,max-age=86400',
      'X-Mockup-Cache': cache,
    },
  });
}

async function serve(key: string, storage: S3Client, bucket: string): Promise<Response> {
  if (!canonicalCacheKey(key)) return json({ error: 'not_found' }, 404);
  try {
    const object = await storage.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (object.Body === undefined) return json({ error: 'not_found' }, 404);
    const bytes = await object.Body.transformToByteArray();
    return new Response(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': object.ContentType ?? 'image/png',
        'Cache-Control': object.CacheControl ?? 'public,max-age=86400',
      },
    });
  } catch (error) {
    const status = typeof error === 'object' && error !== null && '$metadata' in error
      && (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404 ? 404 : 502;
    return json({ error: status === 404 ? 'not_found' : 'storage_unavailable' }, status);
  }
}

type ParsedSpecs = Readonly<{
  tenant: string;
  shop: string;
  product: string;
  width: number;
  height: number;
  productName: string;
  primaryColor: string;
  template: MockupTemplate;
  view: 'front' | 'back';
}>;

function parseSpecs(params: URLSearchParams):
  | Readonly<{ ok: true; specs: ParsedSpecs }>
  | Readonly<{ ok: false; error: string; param: string }> {
  const tenant = params.get('tenant')?.trim() ?? '';
  const shop = params.get('shop')?.trim() ?? '';
  const product = params.get('product')?.trim() ?? '';
  for (const [param, value] of [['tenant', tenant], ['shop', shop], ['product', product]] as const) {
    if (!SEGMENT.test(value)) return { ok: false, error: `${param} invalide`, param };
  }
  const width = Number(params.get('width'));
  const height = Number(params.get('height'));
  if (!Number.isFinite(width) || width <= 0) return { ok: false, error: 'width invalide', param: 'width' };
  if (!Number.isFinite(height) || height <= 0) return { ok: false, error: 'height invalide', param: 'height' };
  const productName = params.get('productName')?.trim().slice(0, 200) ?? '';
  if (!productName) return { ok: false, error: 'productName requis', param: 'productName' };
  const primaryColor = params.get('primaryColor')?.trim() ?? '';
  if (!/^#[0-9a-f]{6}$/i.test(primaryColor)) {
    return { ok: false, error: 'primaryColor invalide', param: 'primaryColor' };
  }
  const templateValue = params.get('template')?.trim() || 'flyer';
  if (!isMockupTemplate(templateValue)) return { ok: false, error: 'template invalide', param: 'template' };
  const viewValue = params.get('view')?.trim().toLowerCase() || 'front';
  if (viewValue !== 'front' && viewValue !== 'back') return { ok: false, error: 'view invalide', param: 'view' };
  return { ok: true, specs: {
    tenant,
    shop,
    product,
    width,
    height,
    productName,
    primaryColor,
    template: templateValue,
    view: viewValue,
  } };
}

function cacheKey(specs: Pick<ParsedSpecs, 'tenant' | 'shop' | 'product' | 'view'>): string {
  const suffix = specs.view === 'back' ? '__back' : '';
  return `${specs.tenant}/${specs.shop}/${specs.product}${suffix}${CACHE_VERSION_SUFFIX}.png`;
}

function canonicalCacheKey(key: string): boolean {
  const match = /^([^/]+)\/([^/]+)\/([^/]+(?:__back)?_v7\.png)$/.exec(key);
  return match !== null && match.slice(1).every((segment) => SEGMENT.test(segment.replace(/(?:__back)?_v7\.png$/, '')));
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
