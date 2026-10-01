import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresShopSitemapRepository } from '../../src/adapters/postgres/shop-sitemap-repository.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import { createShopSitemapHandler } from '../../src/server/api/shop-sitemap-route.ts';

const describeIntegration = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1' ? describe : describe.skip;

describeIntegration('sitemap boutique PostgreSQL/Node', () => {
  const ownerId = randomUUID();
  const tenantId = randomUUID();
  const fallbackTenantId = randomUUID();
  const suffix = randomUUID().slice(0, 8);
  const publicSlug = `sitemap-public-${suffix}`;
  const fallbackSlug = `sitemap-fallback-${suffix}`;
  const privateSlug = `sitemap-private-${suffix}`;
  const subscribedGamme = `sitemap-sub-${suffix}`;
  const rootGamme = `sitemap-root-${suffix}`;
  let pool: Pool;
  let handler: (request: Request) => Promise<Response>;

  beforeAll(async () => {
    pool = createPostgresPool();
    const repository = new PostgresShopSitemapRepository(
      new PostgresTransactionRunner(pool, 'magrit_api'),
    );
    handler = createShopSitemapHandler(repository, 'https://catalogue.example.test/base-ignored');
    await pool.query(
      'insert into public.app_users(id,email_normalized) values($1,$2)',
      [ownerId, `sitemap-${ownerId}@example.invalid`],
    );
    await pool.query(
      `insert into public.tenants(id,slug,name)
       values($1,$2,'Sitemap integration'),($3,$4,'Sitemap fallback')`,
      [tenantId, `sitemap-${suffix}`, fallbackTenantId, `sitemap-fallback-${suffix}`],
    );
    await pool.query(
      `insert into public.product_gammes(slug,name,display_order)
       values($1,'Souscription sitemap',91),($2,'Racine sitemap',92)`,
      [subscribedGamme, rootGamme],
    );
    await pool.query(
      `insert into public.tenant_gamme_subscriptions(tenant_id,gamme_slug,display_order,active)
       values($1,$2,7,true)`,
      [tenantId, subscribedGamme],
    );
    await pool.query(
      `insert into public.shops(tenant_id,owner_user_id,slug,name,active,access_mode)
       values($1,$2,$3,'Publique',true,'self_signup'),
             ($6,$2,$4,'Repli',true,'self_signup'),
             ($1,$2,$5,'Privee',true,'invite_only')`,
      [tenantId, ownerId, publicSlug, fallbackSlug, privateSlug, fallbackTenantId],
    );
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('delete from public.tenants where id=any($1::uuid[])', [[tenantId, fallbackTenantId]]);
    await pool.query('delete from public.product_gammes where slug=any($1::text[])', [[subscribedGamme, rootGamme]]);
    await pool.query('delete from public.app_users where id=$1', [ownerId]);
    await pool.end();
  });

  it('publie seulement la gamme souscrite et utilise l origine configuree', async () => {
    const response = await handler(new Request(
      `http://internal.invalid/api/v1/public/shops/${publicSlug}/sitemap.xml`,
    ));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/xml; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
    expect(body).toContain(`<loc>https://catalogue.example.test/shop/${publicSlug}</loc>`);
    expect(body).toContain(`<loc>https://catalogue.example.test/shop/${publicSlug}/g/${subscribedGamme}</loc>`);
    expect(body).not.toContain(rootGamme);
  });

  it('conserve l ancien chemin mais ne fait plus confiance au parametre base', async () => {
    const response = await handler(new Request(
      `http://internal.invalid/api/v1/shop-sitemap?slug=${fallbackSlug}&base=https://attacker.invalid`,
    ));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain(`<loc>https://catalogue.example.test/shop/${fallbackSlug}</loc>`);
    expect(body).toContain(`/g/${rootGamme}</loc>`);
    expect(body).not.toContain('attacker.invalid');
  });

  it('masque les boutiques privees ou inconnues', async () => {
    const privateResponse = await handler(new Request(
      `http://internal.invalid/api/v1/public/shops/${privateSlug}/sitemap.xml`,
    ));
    const missingResponse = await handler(new Request(
      'http://internal.invalid/api/v1/public/shops/inconnue/sitemap.xml',
    ));

    expect(privateResponse.status).toBe(404);
    expect(missingResponse.status).toBe(404);
  });
});
