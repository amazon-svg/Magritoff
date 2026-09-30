import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';
import { PostgresCommercialQuotesRepository } from '../../src/adapters/postgres/commercial-quotes-repository.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';

const integrationEnabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('PostgresCommercialQuotesRepository — PostgreSQL reel', () => {
  let pool: Pool;
  let repository: PostgresCommercialQuotesRepository;
  const tenantId = randomUUID() as TenantId;
  const foreignTenantId = randomUUID() as TenantId;
  const actorId = randomUUID() as UserId;
  const customerId = randomUUID();
  const projectId = randomUUID();
  const firstItemId = randomUUID();
  const secondItemId = randomUUID();

  beforeAll(async () => {
    pool = createPostgresPool();
    repository = new PostgresCommercialQuotesRepository(new PostgresTransactionRunner(pool, 'magrit_api'));
    await pool.query(`insert into public.app_users (id,email_normalized,display_name) values ($1,$2,'Quote Repository User')`,
      [actorId, `quote-repository-${actorId}@example.invalid`]);
    await pool.query(`insert into public.tenants (id,slug,name) values ($1,$2,'Quote Repository'),($3,$4,'Foreign Quote Repository')`,
      [tenantId, `quote-repository-${tenantId}`, foreignTenantId, `quote-repository-${foreignTenantId}`]);
    await pool.query(`insert into public.tenant_members (tenant_id,user_id,role) values ($1,$2,'owner')`, [tenantId, actorId]);
    await pool.query(`
      insert into public.customers (id,tenant_id,type,civility,first_name,last_name,created_by)
      values ($1,$2,'individual','mr','Jean','Repository',$3)
    `, [customerId, tenantId, actorId]);
    await pool.query(`insert into public.projects (id,tenant_id,customer_id,name,created_by) values ($1,$2,$3,'Projet repository',$4)`,
      [projectId, tenantId, customerId, actorId]);
    await pool.query(`
      insert into public.project_items (id,tenant_id,project_id,label,description_html,quote_payload,position)
      values
        ($1,$3,$4,'Premier','<p>Premier</p>','{"quantity":100,"amounts":{"clariprint_price_ht":"40.00"}}',0),
        ($2,$3,$4,'Second',null,'{"quantity":50,"amounts":{"price":"20.00"}}',1)
    `, [firstItemId, secondItemId, tenantId, projectId]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('delete from public.tenants where id=any($1::uuid[])', [[tenantId, foreignTenantId]]);
    await pool.query('delete from public.app_users where id=$1', [actorId]);
    await pool.end();
  });

  it('cree, tarifie, liste et isole un devis complet', async () => {
    const created = await repository.createFromProjectItems(tenantId, actorId, {
      project_id: projectId,
      item_ids: [firstItemId, secondItemId],
    });

    expect(created).toMatchObject({
      tenant_id: tenantId,
      customer_id: customerId,
      project_id: projectId,
      status: 'draft',
      totals: { lines_subtotal: '60.00' },
    });
    expect(created.number).toMatch(/^DEV-[0-9]{4}-00001$/);
    expect(created.lines.map((line) => [line.label, line.sale_price, line.position])).toEqual([
      ['Premier', '40.00', 0],
      ['Second', '20.00', 1],
    ]);
    expect((await repository.list(tenantId, {
      customerId: null, projectId: null, status: null, size: 20, cursor: null,
    })).rows).toHaveLength(1);
    await expect(repository.findById(foreignTenantId, created.id)).resolves.toBeNull();
  });

  it('journalise les mutations de l entete et des lignes avec leur acteur', async () => {
    const quote = (await repository.list(tenantId, {
      customerId: null, projectId: null, status: null, size: 20, cursor: null,
    })).rows[0]!;
    await repository.update(tenantId, quote.id, actorId, { show_discounts: true, vat_rate: '0.0550' });
    const added = await repository.addLine(tenantId, quote.id, actorId, {
      origin: 'free', projectItemId: null, label: 'Livraison', descriptionHtml: null,
      productConfig: {}, quantity: 1, chiffrageQuantity: null,
      productionPrice: '5.00', publicPrice: '5.00', customerPrice: '5.00',
      appliedMarginRate: '0.0000', appliedRuleId: null, salePrice: '5.00',
      saleMarginRate: '0.0000', discountRate: '0.0000', marginVariation: '0.0000',
      breakdown: [{ post: 'total', cost: '5.00', margin_rate: '0.0000', price: '5.00', source: 'prix_marche' }],
    });
    await repository.updateLine(tenantId, quote.id, added.id, actorId, {
      quantity: 2, salePrice: '4.50', saleMarginRate: '-0.1000',
      discountRate: '0.1000', marginVariation: '-0.1000',
    });
    const detail = await repository.reorderLines(
      tenantId, quote.id, actorId, [added.id, ...((await repository.findDetailById(tenantId, quote.id))!.lines
        .filter((line) => line.id !== added.id).map((line) => line.id))],
    );
    expect(detail.lines[0]?.id).toBe(added.id);
    await repository.removeLine(tenantId, quote.id, added.id, actorId);

    const headerAudit = await repository.listHeaderAuditEntries(tenantId, { quoteId: quote.id, size: 20, cursor: null });
    expect(headerAudit.rows.map((row) => row.field)).toEqual(expect.arrayContaining(['show_discounts', 'vat_rate']));
    expect(headerAudit.rows.every((row) => row.actor_id === actorId)).toBe(true);
    const lineAudit = await repository.listLineAuditEntries(tenantId, { quoteId: quote.id, lineId: null, size: 50, cursor: null });
    expect(lineAudit.rows.map((row) => row.action)).toEqual(expect.arrayContaining(['added', 'updated', 'reordered', 'removed']));
    expect(lineAudit.rows.every((row) => row.actor_id === actorId)).toBe(true);
  });

  it('envoie puis duplique atomiquement le devis et refuse les lignes apres envoi', async () => {
    const source = (await repository.list(tenantId, {
      customerId: null, projectId: null, status: 'draft', size: 20, cursor: null,
    })).rows[0]!;
    const validUntil = await repository.resolveValidUntilForSend(tenantId, source.id);
    const sent = await repository.sendQuote(tenantId, actorId, source.id, { show_discounts: true }, validUntil);
    expect(sent).toMatchObject({ status: 'sent', valid_until: validUntil, show_discounts: true });
    await expect(repository.addLine(tenantId, source.id, actorId, {
      origin: 'free', projectItemId: null, label: 'Interdite', descriptionHtml: null,
      productConfig: {}, quantity: 1, chiffrageQuantity: null, productionPrice: '1.00',
      publicPrice: '1.00', customerPrice: '1.00', appliedMarginRate: '0.0000', appliedRuleId: null,
      salePrice: '1.00', saleMarginRate: '0.0000', discountRate: '0.0000', marginVariation: '0.0000',
      breakdown: [{ post: 'total', cost: '1.00', margin_rate: '0.0000', price: '1.00', source: 'prix_marche' }],
    })).rejects.toMatchObject({ name: 'QuoteLineQuoteNotDraftError' });

    const copy = await repository.duplicateQuote(tenantId, actorId, source.id);
    expect(copy).toMatchObject({ status: 'draft', source_quote_id: source.id, valid_until: null });
    expect(copy.number).not.toBe(source.number);
    expect(copy.lines.map((line) => line.sale_price)).toEqual(sent.lines.map((line) => line.sale_price));
  });

  it('evalue les capacites depuis le contexte acteur PostgreSQL', async () => {
    await expect(repository.actorHasCapability(tenantId, actorId, 'can_manage_pricing')).resolves.toBe(true);
  });
});
