import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresCatalogAutomationGateway } from '../../src/adapters/postgres/catalog-automation-gateway.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import type { UserId } from '../../src/kernel/ids/index.ts';
import { AiPimDefinitionGenerator } from '../../src/modules/catalog/application/ai-pim-definition-generator.ts';

const describeIntegration = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1' ? describe : describe.skip;

describeIntegration('automatisation PIM PostgreSQL', () => {
  const actorId = randomUUID() as UserId;
  const tenantId = randomUUID();
  const shopId = randomUUID();
  const orderId = randomUUID();
  const suffix = randomUUID().slice(0, 8);
  const gammeSlug = `pim-auto-${suffix}`;
  let pool: Pool;
  let gateway: PostgresCatalogAutomationGateway;

  beforeAll(async () => {
    pool = createPostgresPool();
    const generator = new AiPimDefinitionGenerator({
      async complete() {
        return {
          model: 'fixture',
          text: JSON.stringify({
            name: 'Flyer enrichi', keywords: ['flyer'], title_template: 'Flyer {{format}}',
            short_description_template: 'Flyer professionnel', description_template: 'Description',
            h1_template: 'Flyer {{format}}', seo_title: 'Impression flyer',
            seo_description: 'Une description de flyer professionnel pour les entreprises.',
            usage_examples: [], faq: [], benefits: ['Rapide'], use_cases: [],
          }),
        };
      },
    });
    gateway = new PostgresCatalogAutomationGateway(
      new PostgresTransactionRunner(pool, 'magrit_api'),
      generator,
    );
    await pool.query('insert into public.app_users(id,email_normalized) values($1,$2)', [
      actorId, `pim-automation-${actorId}@example.invalid`,
    ]);
    await pool.query("insert into public.tenants(id,slug,name) values($1,$2,'PIM automation')", [
      tenantId, `pim-automation-${suffix}`,
    ]);
    await pool.query(
      'insert into public.user_preferences(user_id,is_admin,last_tenant_id) values($1,true,$2)',
      [actorId, tenantId],
    );
    await pool.query(
      `insert into public.product_gammes(slug,name,matching_rules)
       values($1,'Flyers automatises','{"kind":"leaflet"}'::jsonb)`,
      [gammeSlug],
    );
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('delete from public.pim_candidates where source_tenant_id=$1', [tenantId]);
    await pool.query('delete from public.tenants where id=$1', [tenantId]);
    await pool.query('delete from public.product_gammes where slug=$1', [gammeSlug]);
    await pool.query('delete from public.app_users where id=$1', [actorId]);
    await pool.end();
  });

  it('enrichit un candidat puis deduplique la meme configuration', async () => {
    const raw = { kind: 'leaflet', width: 210, height: 297, quantity: 500 };
    await pool.query(
      'insert into public.pim_candidates(source_tenant_id,source_user_id,raw_config) values($1,$2,$3)',
      [tenantId, actorId, raw],
    );
    const first = await gateway.runIngest(actorId, { dryRun: false });
    expect(first.errors).toEqual([]);
    expect(first.enriched).toHaveLength(1);

    await pool.query(
      'insert into public.pim_candidates(source_tenant_id,source_user_id,raw_config) values($1,$2,$3)',
      [tenantId, actorId, raw],
    );
    const second = await gateway.runIngest(actorId, { dryRun: false });
    expect(second.matched).toEqual([expect.objectContaining({ matchedTo: first.enriched[0]?.definitionId })]);
    const definition = await pool.query<{ order_count: number }>(
      'select order_count from public.product_definitions where id=$1',
      [first.enriched[0]?.definitionId],
    );
    expect(definition.rows[0]?.order_count).toBe(2);
  });

  it('rejette les candidats trop pauvres sans appeler silencieusement l IA', async () => {
    await pool.query(
      'insert into public.pim_candidates(source_tenant_id,source_user_id,raw_config) values($1,$2,$3)',
      [tenantId, actorId, { name: 'x' }],
    );
    const report = await gateway.runIngest(actorId, { dryRun: false });
    expect(report.rejected).toHaveLength(1);
    expect(await gateway.pendingCandidates(actorId)).toBe(0);
  });

  it('alimente la file lors de la creation d une ligne de commande boutique', async () => {
    await pool.query(
      `insert into public.shops(id,tenant_id,owner_user_id,slug,name)
       values($1,$2,$3,$4,'Boutique PIM')`,
      [shopId, tenantId, actorId, `pim-shop-${suffix}`],
    );
    await pool.query(
      `insert into public.tenant_orders(id,tenant_id,shop_id,created_by,total_ht)
       values($1,$2,$3,$4,12)`,
      [orderId, tenantId, shopId, actorId],
    );
    await pool.query(
      `insert into public.tenant_order_items(
         order_id,product_label,clariprint_options,quantity,unit_price_ht,line_total_ht,price_origin
       ) values($1,'Flyer commande',$2,100,0.12,12,'quoted')`,
      [orderId, { kind: 'leaflet', width: 210, height: 297 }],
    );

    expect(await gateway.pendingCandidates(actorId)).toBe(1);
    const candidate = await pool.query<{ raw_config: Record<string, unknown> }>(
      "select raw_config from public.pim_candidates where source_tenant_id=$1 and status='pending'",
      [tenantId],
    );
    expect(candidate.rows[0]?.raw_config).toMatchObject({ name: 'Flyer commande', quantity: 100, kind: 'leaflet' });
  });
});
