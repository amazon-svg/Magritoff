import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const contentTypes: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
};

/** Serve only the public build; preserve API and sitemap routing. */
export async function createStaticWebHandler(
  api: (request: Request) => Response | Promise<Response>,
  directory: string,
): Promise<(request: Request) => Promise<Response>> {
  const root = await realpath(directory);
  const index = resolve(root, 'index.html');
  await stat(index); // Fail at startup when the frontend build is absent.
  return async (request) => {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/') || url.pathname.endsWith('/sitemap.xml')) {
      return api(request);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return api(request);
    let pathname: string;
    try { pathname = decodeURIComponent(url.pathname); }
    catch { return new Response(null, { status: 400 }); }
    const candidate = resolve(root, `.${pathname}`);
    if (!candidate.startsWith(`${root}${sep}`) && candidate !== root) return new Response(null, { status: 404 });
    if (pathname.split('/').some((part) => part.startsWith('.') || part.includes('\\'))) {
      return new Response(null, { status: 404 });
    }
    let file = candidate;
    try {
      file = await realpath(candidate);
      if (file !== root && !file.startsWith(`${root}${sep}`)) return new Response(null, { status: 404 });
      if (!(await stat(file)).isFile()) {
        if (pathname.startsWith('/assets/')) return new Response(null, { status: 404 });
        file = index;
      }
    } catch (error) {
      if (!isMissingFile(error)) throw error;
      if (pathname.startsWith('/assets/') || extname(pathname)) return new Response(null, { status: 404 });
      file = index;
    }
    const headers = {
      'Content-Type': contentTypes[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': file.startsWith(resolve(root, 'assets') + sep)
        ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    };
    return new Response(request.method === 'HEAD' ? null : new Uint8Array(await readFile(file)), { headers });
  };
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR');
}
