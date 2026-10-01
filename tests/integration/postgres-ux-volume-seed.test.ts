import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { databaseConfiguration } from '../../scripts/db/migrate.mjs';
import {
  developmentSeedConfiguration,
} from '../../scripts/db/seed-development.mjs';
import { seedUxVolume } from '../../scripts/db/seed-ux-volume.mjs';

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
  }, 20_000);
});
