import { PostgresOrdersRepository } from '../../src/adapters/postgres/orders-repository.ts';
import { unifiedOrderDetailSchema } from '../../src/modules/orders/api/contracts.ts';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresCommercialOrdersRepository } from '../../src/adapters/postgres/commercial-orders-repository.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';

const enabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';

(enabled ? describe : describe.skip)('conversion portable devis vers commande', () => {
  let pool: Pool;
  const tenant = randomUUID() as TenantId;
  const actor = randomUUID() as UserId;
  const customer = randomUUID();
  const project = randomUUID();
  const quote = randomUUID();
  const line = randomUUID();
  let stepOne: string;
  let stepTwo: string;

  beforeAll(async () => {
    pool = createPostgresPool();
    await pool.query(
      "insert into public.app_users(id, email_normalized, display_name) values ($1, $2, 'Conversion User')",
      [actor, `conversion-${actor}@example.invalid`],
    );
    await pool.query(
      "insert into public.tenants(id, slug, name, tax_regime) values ($1, $2, 'Conversion', 'metropole_fr')",
      [tenant, `conversion-${tenant}`],
    );
    await pool.query("insert into public.tenant_members(tenant_id, user_id, role) values ($1, $2, 'owner')", [
      tenant,
      actor,
    ]);

    const steps = await pool.query(
      'select id from public.production_steps where tenant_id = $1 order by position limit 2',
      [tenant],
    );
    stepOne = steps.rows[0].id;
    stepTwo = steps.rows[1].id;

    await pool.query(
      "insert into public.customers(id, tenant_id, type, civility, first_name, last_name) values ($1, $2, 'individual', 'mr', 'Jean', 'Conversion')",
      [customer, tenant],
    );
    await pool.query(
      "insert into public.projects(id, tenant_id, customer_id, name) values ($1, $2, $3, 'Projet conversion')",
      [project, tenant, customer],
    );
    await pool.query(
      `insert into public.commercial_quotes(
         id, tenant_id, customer_id, project_id, number, status, global_discount_rate, created_by
       ) values ($1, $2, $3, $4, 'DEV-2026-00999', 'draft', .1000, $5)`,
      [quote, tenant, customer, project, actor],
    );
    await pool.query(
      `insert into public.commercial_quote_lines(
         id, quote_id, origin, label, product_config, quantity, position, production_price,
         public_price, customer_price, applied_margin_rate, sale_price, breakdown
       ) values (
         $1, $2, 'free', 'Impression', '{}', 1, 0, 50, 120, 100, .5000, 100,
         '[{"post":"printing","cost":"50.00","margin_rate":"0.5000","price":"100.00","source":"prix_marche"}]'
       )`,
      [line, quote],
    );
    await pool.query("update public.commercial_quotes set status = 'sent', sent_at = clock_timestamp() where id = $1", [
      quote,
    ]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('delete from public.tenants where id = $1', [tenant]);
    await pool.query('delete from public.app_users where id = $1', [actor]);
    await pool.end();
  });

  it('convertit, relit et fait progresser une commande via le repository', async () => {
    const transactions = new PostgresTransactionRunner(pool, 'magrit_api');
    const repository = new PostgresCommercialOrdersRepository(transactions);

    const converted = await repository.convertQuote(tenant, actor, quote);
    const orderId = converted.id;
    expect(converted).toMatchObject({
      source_quote_status: 'sent',
      current_production_step_id: stepOne,
      lines: [{ label: 'Impression', sale_price: '100.00' }],
      totals: {
        lines_subtotal: '100.00',
        global_discount: '10.00',
        net_total: '90.00',
        vat_amount: '18.00',
        total_incl_tax: '108.00',
      },
    });
    expect((await pool.query('select status from public.commercial_quotes where id = $1', [quote])).rows[0].status)
      .toBe('converted');
    await expect(repository.convertQuote(tenant, actor, quote)).rejects.toMatchObject({
      name: 'QuoteConversionForbiddenStatusError',
    });

    const listed = await repository.list(tenant, {
      customerId: customer,
      quoteId: null,
      status: null,
      currentProductionStepId: null,
      createdAtFrom: null,
      createdAtTo: null,
      sort: '-created_at',
      size: 10,
      cursor: null,
    });
    expect(listed.rows.map((row) => row.id)).toContain(orderId);
    expect(await repository.findById(tenant, orderId)).toMatchObject({ id: orderId, quote_id: quote });
    expect(await repository.findDetailById(tenant, orderId)).toMatchObject({
      id: orderId,
      customer_contact_id: null,
      expected_delivery_date: null,
      lines: [{ source_quote_line_id: line }],
    });

    const unifiedRepository = new PostgresOrdersRepository(transactions, {
      transition: async () => undefined, created: async () => undefined,
    });
    const unified = await unifiedRepository.getUnifiedOrderDetail(tenant, orderId, actor);
    expect(unifiedOrderDetailSchema.safeParse(unified).success).toBe(true);
    expect(unified).toMatchObject({ origin: 'quote', quote_id: quote, customer_id: customer,
      total_ht: '90.00', total_ttc: '108.00', detail: converted });
    expect(unified?.detail).toEqual(await repository.findDetailById(tenant, orderId));

    const document = await repository.findForDocumentGeneration(tenant, orderId);
    expect(document).toMatchObject({
      id: orderId,
      quoteNumber: 'DEV-2026-00999',
      showDiscounts: false,
      lines: [{ label: 'Impression', customerPrice: '100.00', salePrice: '100.00' }],
    });

    const moved = await repository.changeProductionStep(
      tenant,
      orderId,
      actor,
      { step_id: stepTwo, note: 'Prête' },
      null,
    );
    expect(moved).toMatchObject({
      from_step_id: stepOne,
      to_step_id: stepTwo,
      actor_id: actor,
      actor_label: 'Conversion User',
    });
    expect((await repository.listStepChanges(tenant, orderId, { size: 10, cursor: null }, actor)).rows).toEqual([moved]);
    expect(
      (await pool.query('select current_production_step_id from public.tenant_orders where id = $1', [orderId]))
        .rows[0].current_production_step_id,
    ).toBe(stepTwo);

    const byStep = await repository.list(tenant, {
      customerId: null,
      quoteId: null,
      status: null,
      currentProductionStepId: null,
      createdAtFrom: null,
      createdAtTo: null,
      sort: 'production_step',
      size: 10,
      cursor: null,
    });
    const current = byStep.rows.find((row) => row.id === orderId);
    expect(current).toBeDefined();
    expect(
      (
        await repository.list(tenant, {
          customerId: null,
          quoteId: null,
          status: null,
          currentProductionStepId: null,
          createdAtFrom: null,
          createdAtTo: null,
          sort: 'production_step',
          size: 10,
          cursor: { sort: `${stepTwo}|${current!.created_at}`, id: orderId },
        })
      ).rows,
    ).toEqual([]);
  });
});
