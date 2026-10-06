import { PostgresOrderExportRunRepository } from '../../src/adapters/postgres/order-exports-repository';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createPostgresPool } from '../../src/adapters/postgres/pool';
import { PostgresOrdersRepository } from '../../src/adapters/postgres/orders-repository';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner';
import type { TenantId, UserId } from '../../src/kernel/ids';
import type { ListOrdersParams } from '../../src/modules/orders/application/orders-repository';
import { orderListEntriesSchema, unifiedOrderDetailSchema } from '../../src/modules/orders/api/contracts';
import { endOfDayInReferenceTimeZone } from '../../src/kernel/clock';
import { computeEntityTag } from '../../src/modules/_shared/application';

const suite = process.env.MAGRIT_POSTGRES_INTEGRATION === '1' ? describe : describe.skip;
suite('Commandes communes — pagination et filtres PostgreSQL', () => {
  let pool: Pool;
  let repository: PostgresOrdersRepository;
  const tenantId = randomUUID() as TenantId;
  const foreignTenantId = randomUUID() as TenantId;
  const actor = randomUUID() as UserId;
  const viewer = randomUUID() as UserId;
  const customerId = randomUUID();
  const projectId = randomUUID();
  const quoteId = randomUUID();
  const shopId = randomUUID();
  const stepId = randomUUID();
  const storefrontIds = [randomUUID(), randomUUID(), randomUUID()];
  const quoteOrderId = randomUUID();
  const sourceLineId = randomUUID();
  const timestamp = '2026-10-05T12:00:00.000Z';
  const params = (overrides: Partial<ListOrdersParams> = {}): ListOrdersParams => ({
    actor, filters: {}, size: 2, cursor: null, createdAtFrom: null, createdAtTo: null, ...overrides,
  });

  beforeAll(async () => {
    pool = createPostgresPool();
    repository = new PostgresOrdersRepository(new PostgresTransactionRunner(pool, 'magrit_api'), {
      transition: async () => undefined, created: async () => undefined,
    });
    await pool.query('insert into public.app_users(id,email_normalized,display_name) values($1,$2,$3)',
      [actor, `unified-${actor}@example.invalid`, 'Acheteur Boutique']);
    await pool.query('insert into public.app_users(id,email_normalized,display_name) values($1,$2,$3)',
      [viewer, `unified-${viewer}@example.invalid`, 'Lecteur sans modification']);
    await pool.query("insert into public.tenants(id,slug,name) values($1,$2,'Liste commune'),($3,$4,'Autre tenant')",
      [tenantId, `unified-${tenantId}`, foreignTenantId, `unified-${foreignTenantId}`]);
    await pool.query("insert into public.tenant_members(tenant_id,user_id,role) values($1,$2,'owner')", [tenantId, actor]);
    await pool.query("insert into public.tenant_members(tenant_id,user_id,role) values($1,$2,'member')", [tenantId, viewer]);
    await pool.query("insert into public.shops(id,tenant_id,owner_user_id,slug,name) values($1,$2,$3,$4,'Atelier Lumière')", [shopId, tenantId, actor, `unified-${shopId}`]);
    await pool.query("insert into public.customers(id,tenant_id,type,civility,first_name,last_name) values($1,$2,'individual','mr','Jean','Devis')", [customerId, tenantId]);
    await pool.query("insert into public.projects(id,tenant_id,customer_id,name,created_by) values($1,$2,$3,'Projet',$4)", [projectId, tenantId, customerId, actor]);
    await pool.query("insert into public.commercial_quotes(id,tenant_id,customer_id,project_id,number,status,created_by) values($1,$2,$3,$4,'DEV-2026-00001','draft',$5)", [quoteId, tenantId, customerId, projectId, actor]);
    await pool.query(`insert into public.commercial_quote_lines(id,quote_id,origin,label,product_config,quantity,position,
      production_price,public_price,customer_price,applied_margin_rate,sale_price,breakdown)
      values($1,$2,'free','Flyer devis','{}',1,0,80,130,123.45,.5000,123.45,
      '[{"post":"printing","cost":"80.00","margin_rate":"0.5000","price":"123.45","source":"prix_marche"}]')`, [sourceLineId, quoteId]);
    await pool.query("insert into public.production_steps(id,tenant_id,label,position,color) values($1,$2,'Impression',100,'blue')", [stepId, tenantId]);
    await pool.query(`insert into public.tenant_orders(id,tenant_id,shop_id,created_by,total_ht,status,created_at)
      select unnest($1::uuid[]),$2,$3,$4,25.00,'draft',$5::timestamptz`, [storefrontIds, tenantId, shopId, actor, timestamp]);
    await pool.query(`insert into public.tenant_order_items(order_id,product_label,quantity,unit_price_ht,line_total_ht,price_origin)
      select unnest($1::uuid[]),'Flyer',2,12.50,25.00,'catalog'`, [storefrontIds]);
    await pool.query(`insert into public.tenant_orders(id,tenant_id,created_by,total_ht,status,created_at,order_origin,
      customer_id,quote_id,number,source_quote_status,lines_subtotal,global_discount,net_total,vat_rate,vat_amount,total_incl_tax,current_production_step_id)
      values($1,$2,$3,123.45,'validated',$4,'quote',$5,$6,'CDE-2026-00001','accepted',123.45,0,123.45,.0550,6.79,130.24,$7)`,
      [quoteOrderId, tenantId, actor, timestamp, customerId, quoteId, stepId]);
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query("select set_config('magrit.quote_conversion','on',true)");
      await client.query(`insert into public.tenant_order_items(order_id,source_quote_line_id,product_label,clariprint_options,
        quantity,unit_price_ht,line_total_ht,price_origin,line_origin,position,
        production_price,public_price,customer_price,applied_margin_rate,sale_price,breakdown)
        values($1,$2,'Flyer devis','{"paper":"mat"}',1,123.45,123.45,'quoted','free',0,80,130,123.45,.5000,123.45,
        '[{"post":"printing","cost":"80.00","margin_rate":"0.5000","price":"123.45","source":"prix_marche"}]')`, [quoteOrderId, sourceLineId]);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }

  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('delete from public.tenant_orders where tenant_id=$1', [tenantId]);
    await pool.query('delete from public.tenants where id=any($1::uuid[])', [[tenantId, foreignTenantId]]);
    await pool.query('delete from public.app_users where id=any($1::uuid[])', [[actor, viewer]]);
    await pool.end();
  });

  it('parcourt les deux origines sans doublon ni omission à date égale', async () => {
    const first = await repository.listOrders(tenantId, params());
    expect(first).toHaveLength(3); // size + 1
    expect(orderListEntriesSchema.safeParse(first).success).toBe(true);
    const second = await repository.listOrders(tenantId, params({ cursor: { sort: first[1].cursorCreatedAt!, id: first[1].id } }));
    const ids = [...first.slice(0, 2), ...second].map((row) => row.id);
    expect(ids).toEqual([...storefrontIds, quoteOrderId].sort().reverse());
    expect(new Set(ids).size).toBe(4);
    await expect(repository.listOrders(foreignTenantId, params())).resolves.toEqual([]);
  });

  it('joint le client et conserve les montants figés des devis, sans boutique obligatoire', async () => {
    const rows = await repository.listOrders(tenantId, params({ filters: { origin: 'quote', customer_id: customerId, quote_id: quoteId, current_production_step_id: stepId } }));
    expect(rows).toEqual([expect.objectContaining({ id: quoteOrderId, shop_id: null, shop_name: null,
      customer_name: 'Jean Devis', customer_id: customerId, total_ht: '123.45', total_ttc: '130.24', items: [{ name: 'Flyer devis', quantity: 1, unit_price_ht: '123.45', price_origin: 'quoted' }] })]);
  });

  it('filtre avant la limite et accepte les commandes sans client CRM', async () => {
    const rows = await repository.listOrders(tenantId, params({ filters: { origin: 'storefront', shop_id: shopId, customer_search: 'BOUTIQUE', status: 'draft' }, size: 1 }));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ customer_id: null, customer_name: 'Acheteur Boutique', total_ht: '25.00', total_ttc: '30.00',
      items: [{ name: 'Flyer', quantity: 2, unit_price_ht: '12.50', price_origin: 'catalog' }] });
    expect(rows.every((row) => row.origin === 'storefront')).toBe(true);
    await expect(repository.listOrders(tenantId, params({ filters: { customer_search: '%' } }))).resolves.toEqual([]);
    await expect(repository.listOrders(tenantId, params({ filters: { shop_id: randomUUID() } }))).resolves.toEqual([]);
  });

  it('préserve les microsecondes de la position de pagination', async () => {
    await pool.query("update public.tenant_orders set created_at='2026-10-05T12:00:00.000123Z' where id=$1", [storefrontIds[0]]);
    try {
      const first = await repository.listOrders(tenantId, params({ size: 1 }));
      expect(first[0].id).toBe(storefrontIds[0]);
      expect(first[0].cursorCreatedAt).toBe('2026-10-05T12:00:00.000123Z');
      const rest = await repository.listOrders(tenantId, params({ size: 10, cursor: { sort: first[0].cursorCreatedAt!, id: first[0].id } }));
      expect(rest.map((row) => row.id).sort()).toEqual([...storefrontIds.slice(1), quoteOrderId].sort());
    } finally {
      await pool.query('update public.tenant_orders set created_at=$1 where id=$2', [timestamp, storefrontIds[0]]);
    }
  });

  it('ouvre les deux origines et conserve les relations absentes et les prix boutique', async () => {
    const storefront = await repository.getUnifiedOrderDetail(tenantId, storefrontIds[0], actor);
    expect(unifiedOrderDetailSchema.safeParse(storefront).success).toBe(true);
    expect(storefront).toMatchObject({ origin: 'storefront', customer_id: null, quote_id: null,
      total_ht: '25.00', total_ttc: '30.00', detail: { shopId, items: [{ quantity: 2,
        unitPriceHt: '12.50', lineTotalHt: '25.00', priceOrigin: 'catalog' }] } });
    const quote = await repository.getUnifiedOrderDetail(tenantId, quoteOrderId, actor);
    expect(unifiedOrderDetailSchema.safeParse(quote).success).toBe(true);
    expect(quote).toMatchObject({ origin: 'quote', shop_id: null, customer_id: customerId,
      quote_id: quoteId, total_ht: '123.45', total_ttc: '130.24', detail: { lines: [{ source_quote_line_id: sourceLineId, sale_price: '123.45', production_price: '80.00', product_config: { paper: 'mat' } }] } });
  });

  it('ne divulgue aucune commande d’un autre tenant ni un identifiant absent', async () => {
    await expect(repository.getUnifiedOrderDetail(foreignTenantId, storefrontIds[0], actor)).resolves.toBeNull();
    await expect(repository.getUnifiedOrderDetail(foreignTenantId, quoteOrderId, actor)).resolves.toBeNull();
    await expect(repository.getUnifiedOrderDetail(tenantId, randomUUID(), actor)).resolves.toBeNull();
  });

  it('lit la liste et le détail avec le seul contexte tenant d’une clé de service', async () => {
    const rows = await repository.listOrders(tenantId, params({ actor: null, size: 10 }));
    expect(rows).toHaveLength(4);
    await expect(repository.getUnifiedOrderDetail(tenantId, quoteOrderId, null)).resolves.toMatchObject({
      id: quoteOrderId, origin: 'quote', quote_id: quoteId,
    });
    await expect(repository.listOrders(foreignTenantId, params({ actor: null, size: 10 }))).resolves.toEqual([]);
  });

  it.each([
    ['storefront', storefrontIds[0]],
    ['quote', quoteOrderId],
  ] as const)('modifie et audite les informations non financières d une commande %s', async (_origin, orderId) => {
    const before = (await repository.getUnifiedOrderDetail(tenantId, orderId, actor))!;
    const tag = await computeEntityTag(before);
    const updated = await repository.updateOrderMetadata(tenantId, orderId, actor, {
      customer_reference: `REF-${_origin}`,
      notes: `Note ${_origin}`,
    }, tag);
    expect(updated).toMatchObject({
      id: orderId,
      customer_reference: `REF-${_origin}`,
      notes: `Note ${_origin}`,
      total_ht: before.total_ht,
      total_ttc: before.total_ttc,
    });
    if (updated!.origin === 'storefront' && before.origin === 'storefront') {
      expect(updated!.detail.items).toEqual(before.detail.items);
      expect(updated!.detail.totalHt).toBe(before.detail.totalHt);
      expect(updated!.detail.totalTtc).toBe(before.detail.totalTtc);
    } else if (updated!.origin === 'quote' && before.origin === 'quote') {
      expect(updated!.detail.lines).toEqual(before.detail.lines);
      expect(updated!.detail.totals).toEqual(before.detail.totals);
    } else {
      throw new Error('L origine de la commande a changé pendant la modification.');
    }
    expect(updated!.updated_at).not.toBe(before.updated_at);
    const audit = (await pool.query(`select actor_id,changes from public.tenant_order_metadata_events
      where order_id=$1 order by occurred_at desc limit 1`, [orderId])).rows[0];
    expect(audit).toEqual({
      actor_id: actor,
      changes: {
        customer_reference: { before: null, after: `REF-${_origin}` },
        notes: { before: '', after: `Note ${_origin}` },
      },
    });
    await expect(repository.listAuditEvents(orderId, {
      storefrontToken: null, magritUserId: actor,
    })).resolves.toEqual(expect.arrayContaining([expect.objectContaining({
      kind: 'metadata', eventType: 'metadata_updated', actorId: actor,
      payload: { changes: audit.changes },
    })]));
  });

  it('refuse un ETag périmé sans écraser la version courante', async () => {
    const orderId = storefrontIds[1];
    const before = (await repository.getUnifiedOrderDetail(tenantId, orderId, actor))!;
    const staleTag = await computeEntityTag(before);
    await repository.updateOrderMetadata(tenantId, orderId, actor, { customer_reference: 'VERSION-1', notes: '' }, staleTag);
    await expect(repository.updateOrderMetadata(
      tenantId, orderId, actor, { customer_reference: 'ECRASEMENT', notes: '' }, staleTag,
    )).rejects.toMatchObject({ init: { status: 409, code: 'api.resource_conflict' } });
    await expect(repository.getUnifiedOrderDetail(tenantId, orderId, actor)).resolves.toMatchObject({
      customer_reference: 'VERSION-1',
    });
  });

  it('exige can_modify et ne traverse jamais la frontière du tenant', async () => {
    const detail = (await repository.getUnifiedOrderDetail(tenantId, storefrontIds[2], actor))!;
    const tag = await computeEntityTag(detail);
    await expect(repository.updateOrderMetadata(tenantId, detail.id, viewer, {
      customer_reference: null, notes: 'Interdit',
    }, tag)).rejects.toMatchObject({ init: { status: 403, code: 'identity.capability_required' } });
    await expect(repository.updateOrderMetadata(foreignTenantId, detail.id, actor, {
      customer_reference: null, notes: 'Autre tenant',
    }, tag)).resolves.toBeNull();
  });

  async function exportedRows(filters: ListOrdersParams['filters'], granularity = 'order', legacy = false) {
    const id = await new PostgresTransactionRunner(pool, 'magrit_api').run({ tenantId, userId: actor }, async (client) =>
      (await client.query<{ id: string }>(legacy
        ? 'select magrit.request_order_export($1,$2,$3,$4) id'
        : 'select magrit.request_unified_order_export($1,$2,$3,$4) id', [tenantId, 'csv', granularity, filters])).rows[0].id);
    const worker = new PostgresOrderExportRunRepository(new PostgresTransactionRunner(pool, 'magrit_worker'));
    const claimed = await worker.claim({ limit: 1, maxAttempts: 3, maxAgeSeconds: 900 });
    expect(claimed).toEqual([expect.objectContaining({ id, layoutVersion: legacy ? 1 : 2 })]);
    const rows: Readonly<Record<string, unknown>>[] = [];
    let after: unknown = null;
    try {
      for (let page = 0; page < 10; page += 1) {
        const result = await worker.readRows(id, after, 1);
        rows.push(...result.rows);
        if (!result.nextAfter) break;
        after = result.nextAfter;
      }
      return rows;
    } finally {
      await worker.markFailed(id, 'order_export.generation_failed', 'Fin du test isolé.', new Date().toISOString());
    }
  }

  it('exporte exactement la sélection de la grille commune, avant pagination', async () => {
    const selections: ListOrdersParams['filters'][] = [
      {}, { origin: 'quote' }, { origin: 'storefront', status: 'draft' },
      { customer_search: 'BOUTIQUE' }, { customer_search: '%' }, { customer_id: customerId },
      { quote_id: quoteId }, { quote_id: randomUUID() },
      { shop_id: shopId }, { shop_id: randomUUID() }, { current_production_step_id: stepId },
      { created_from: '2026-10-05', created_to: '2026-10-05' }, { created_from: '2026-10-06' },
    ];
    for (const filters of selections) {
      const grid = await repository.listOrders(tenantId, params({ filters, size: 100,
        createdAtFrom: filters.created_from ? `${filters.created_from}T00:00:00+02:00` : null,
        createdAtTo: filters.created_to ? new Date(Date.parse(endOfDayInReferenceTimeZone(filters.created_to)) + 1).toISOString() : null }));
      const rows = await exportedRows(filters);
      expect(rows.map((row) => row.order_id).sort()).toEqual(grid.map((row) => row.id).sort());
      expect(new Set(rows.map((row) => row.order_id)).size).toBe(rows.length);
      for (const row of rows) {
        const order = grid.find((order) => order.id === row.order_id)!;
        expect(row).toMatchObject({ net_total: order.total_ht, total_incl_tax: order.total_ttc,
          order_origin: order.origin, shop_name: order.shop_name });
      }
    }
  });

  it('exporte les lignes boutique et devis sans dupliquer les totaux et préserve les exports historiques', async () => {
    const lines = await exportedRows({}, 'line');
    expect(lines).toHaveLength(4);
    expect(lines.find((line) => line.order_id === quoteOrderId)).toMatchObject({ sale_price: '123.45',
      bracket_amount_excl_tax: '123.45', unit_price_indicative: '123.4500', order_origin: 'quote' });
    expect(lines.filter((line) => line.order_origin === 'storefront').every((line) =>
      line.sale_price === '25.00' && line.unit_price_indicative === '12.5000' && line.line_position === 0)).toBe(true);
    const legacy = await exportedRows({}, 'order', true);
    expect(legacy).toHaveLength(1);
    expect(legacy[0]).toMatchObject({ order_number: 'CDE-2026-00001', net_total: '123.45', total_incl_tax: '130.24' });
  });

  it('inclut le dernier jour civil jusqu’à ses dernières microsecondes dans la grille et l’export', async () => {
    await pool.query("update public.tenant_orders set created_at='2026-10-05T21:59:59.999999Z' where id=$1", [storefrontIds[0]]);
    await pool.query("update public.tenant_orders set created_at='2026-10-05T22:00:00.000000Z' where id=$1", [storefrontIds[1]]);
    try {
      const filters = { created_from: '2026-10-05', created_to: '2026-10-05' };
      const grid = await repository.listOrders(tenantId, params({ filters, size: 10,
        createdAtFrom: '2026-10-04T22:00:00.000Z', createdAtTo: '2026-10-05T22:00:00.000Z' }));
      expect(grid.map((row) => row.id).sort()).toEqual([storefrontIds[0], storefrontIds[2], quoteOrderId].sort());
      expect((await exportedRows(filters)).map((row) => row.order_id).sort()).toEqual(grid.map((row) => row.id).sort());
    } finally {
      await pool.query('update public.tenant_orders set created_at=$1 where id=any($2::uuid[])', [timestamp, storefrontIds]);
    }
  });

  it('applique la borne inférieure inclusive et la borne supérieure exclusive', async () => {
    expect(await repository.listOrders(tenantId, params({ createdAtFrom: timestamp, createdAtTo: '2026-10-05T12:00:00.001Z', size: 10 }))).toHaveLength(4);
    await expect(repository.listOrders(tenantId, params({ createdAtTo: timestamp }))).resolves.toEqual([]);
    await expect(repository.listOrders(tenantId, params({ createdAtFrom: '2026-10-06T00:00:00.000Z' }))).resolves.toEqual([]);
  });
});
