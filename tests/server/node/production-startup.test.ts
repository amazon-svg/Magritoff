import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readHttpConfiguration, validateProductionEnvironment } from '../../../src/server/node/http-configuration.ts';
import { createStaticWebHandler } from '../../../src/server/node/static-web-handler.ts';

describe('production startup', () => {
  it('keeps the local listener and exposes the production listener', () => {
    expect(readHttpConfiguration({})).toEqual({ host: '127.0.0.1', port: 8787 });
    expect(readHttpConfiguration({ NODE_ENV: 'production' })).toEqual({ host: '0.0.0.0', port: 8080 });
    expect(readHttpConfiguration({ PORT: '9090', MAGRIT_API_PORT: '8787' })).toEqual({ host: '0.0.0.0', port: 9090 });
    expect(() => readHttpConfiguration({ PORT: '0' })).toThrow(/PORT/);
    expect(() => readHttpConfiguration({ PORT: 'invalid' })).toThrow(/PORT/);
  });
  it('rejects missing production services without printing secret values', () => {
    expect(() => validateProductionEnvironment({})).toThrow(/DATABASE_URL, APP_BASE_URL, MAGRIT_AUTH_SECRET/);
    expect(() => validateProductionEnvironment({ DATABASE_URL: 'postgres://test', APP_BASE_URL: 'https://example.com', MAGRIT_AUTH_SECRET: 'secret' })).not.toThrow();
  });
});

describe('production frontend', () => {
  const directories: string[] = [];
  afterEach(async () => { await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });
  async function fixture() {
    const root = await mkdtemp(join(tmpdir(), 'magrit-web-'));
    directories.push(root);
    const web = join(root, 'dist');
    await mkdir(join(web, 'assets'), { recursive: true });
    await writeFile(join(web, 'index.html'), '<html>Magrit</html>');
    await writeFile(join(web, 'assets', 'app-hash.js'), 'console.log("Magrit")');
    await writeFile(join(web, 'assets', 'pdf-worker.mjs'), 'export {};');
    await writeFile(join(root, 'secret.txt'), 'private');
    const handler = await createStaticWebHandler(() => new Response('API', { status: 401 }), web);
    return { root, web, handler };
  }
  it('serves SPA deep links and HEAD, with fresh HTML and cached assets', async () => {
    const { handler } = await fixture();
    const response = await handler(new Request('http://localhost/tenants/example/projects'));
    expect(await response.text()).toBe('<html>Magrit</html>');
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(await (await handler(new Request('http://localhost/'))).text()).toBe('<html>Magrit</html>');
    const asset = await handler(new Request('http://localhost/assets/app-hash.js'));
    expect(asset.headers.get('content-type')).toContain('javascript');
    expect(asset.headers.get('cache-control')).toContain('immutable');
    expect((await handler(new Request('http://localhost/assets/pdf-worker.mjs'))).headers.get('content-type')).toContain('javascript');
    expect((await handler(new Request('http://localhost/tenants', { method: 'HEAD' }))).body).toBeNull();
  });
  it('preserves API errors and sitemap routing; missing assets remain 404', async () => {
    const { handler } = await fixture();
    for (const path of ['/api/v1/health', '/api/v1/missing', '/shop/example/sitemap.xml']) {
      expect((await handler(new Request(`http://localhost${path}`))).status).toBe(401);
    }
    expect((await handler(new Request('http://localhost/assets/missing.js'))).status).toBe(404);
  });
  it('blocks encoded traversal, hidden files and symlinks outside the public build', async () => {
    const { root, web, handler } = await fixture();
    await symlink(join(root, 'secret.txt'), join(web, 'leak.txt'));
    for (const path of ['/%2e%2e%2fsecret.txt', '/.env', '/leak.txt', '/%5csecret.txt']) {
      expect((await handler(new Request(`http://localhost${path}`))).status).toBe(404);
    }
    expect((await handler(new Request('http://localhost/%invalid'))).status).toBe(400);
  });
  it('fails at startup when index.html is absent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'magrit-web-'));
    directories.push(root);
    await expect(createStaticWebHandler(() => new Response(), root)).rejects.toThrow();
  });
});
