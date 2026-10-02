import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { databaseConfiguration } from '../../scripts/db/migrate.mjs';
import {
  developmentSeedConfiguration,
} from '../../scripts/db/seed-development.mjs';
import { seedUxVolume } from '../../scripts/db/seed-ux-volume.mjs';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import { PostgresCommercialQuotesRepository } from '../../src/adapters/postgres/commercial-quotes-repository.ts';
import { PostgresCommercialOrdersRepository } from '../../src/adapters/postgres/commercial-orders-repository.ts';
import { quoteDetailSchema } from '../../src/modules/commercial-quotes/api/contracts.ts';
import { commercialOrderDetailSchema } from '../../src/modules/commercial-orders/api/contracts.ts';
import type { TenantId } from '../../src/kernel/ids/index.ts';

const enabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const suite = enabled ? describe : describe.skip;
const TEST_SLUG = 'ux-volume-integration';

suite('seed UX volumique PostgreSQL', () => {
  const client = new pg.Client(databaseConfiguration());

  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    try {
      await client.query('begin');
      await client.query("select set_config('magrit.order_transition','on',true)");
      await client.query(`
        update public.tenant_orders set status = 'draft'
        where tenant_id = (select id from public.tenants where slug = $1)
      `, [TEST_SLUG]);
      await client.query(`
        update public.commercial_quotes set status = 'draft'
        where tenant_id = (select id from public.tenants where slug = $1)
      `, [TEST_SLUG]);
      await client.query('delete from public.tenants where slug = $1', [TEST_SLUG]);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      await client.end();
    }
  });

  it('cree puis rejoue sans doublon les clients, devis et deux familles de commandes', async () => {
    const configuration = {
      allTenants: false,
      tenantSlug: TEST_SLUG,
      customerCount: 3,
      orderCount: 4,
      quoteCount: 5,
    } as const;
    const identity = developmentSeedConfiguration();

    await seedUxVolume(client, configuration, identity);
    // Simuler le format historique invalide dans un instantane UX existant.
    // Le rejeu doit le reparer sans supprimer la commande ni ses lignes.
    await client.query('begin');
    try {
      await client.query('lock table public.commercial_order_lines in access exclusive mode');
      await client.query('alter table public.commercial_order_lines disable trigger commercial_order_lines_immutable');
      await client.query(`
        update public.commercial_order_lines set breakdown = '[{"label":"Impression","amount":66}]'::jsonb
        where order_id in (
          select orders.id from public.commercial_orders orders
          join public.tenants tenant on tenant.id = orders.tenant_id where tenant.slug = $1
        )
      `, [TEST_SLUG]);
      await client.query('alter table public.commercial_order_lines enable trigger commercial_order_lines_immutable');
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
    await seedUxVolume(client, configuration, identity);

    const result = await client.query(`
      select
        (select count(*) from public.customers where tenant_id = tenant.id) as customers,
        (select count(*) from public.tenant_orders where tenant_id = tenant.id) as storefront_orders,
        (select count(*) from public.commercial_quotes where tenant_id = tenant.id) as quotes,
        (select count(*) from public.commercial_orders where tenant_id = tenant.id) as commercial_orders
      from public.tenants tenant where tenant.slug = $1
    `, [TEST_SLUG]);

    expect(result.rows[0]).toEqual({
      customers: '3',
      storefront_orders: '4',
      quotes: '5',
      commercial_orders: '1',
    });

    // Valider les representations detaillees, pas seulement les compteurs :
    // le JSONB accepte en base peut rester incompatible avec le contrat HTTP.
    const pool = new pg.Pool(databaseConfiguration());
    try {
      const runner = new PostgresTransactionRunner(pool, 'magrit_api');
      const quotes = new PostgresCommercialQuotesRepository(runner);
      const orders = new PostgresCommercialOrdersRepository(runner);
      const tenant = await client.query('select id from public.tenants where slug = $1', [TEST_SLUG]);
      const tenantId = tenant.rows[0].id as TenantId;
      const quoteRows = await client.query('select id from public.commercial_quotes where tenant_id = $1', [tenantId]);
      for (const row of quoteRows.rows) {
        quoteDetailSchema.parse(await quotes.findDetailById(tenantId, row.id));
      }
      const orderRows = await client.query('select id from public.commercial_orders where tenant_id = $1', [tenantId]);
      for (const row of orderRows.rows) {
        commercialOrderDetailSchema.parse(await orders.findDetailById(tenantId, row.id));
      }
    } finally {
      await pool.end();
    }
  }, 20_000);
});
