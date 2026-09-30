import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresPriceRulesRepository } from '../../src/adapters/postgres/price-rules-repository.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';

const integrationEnabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('PostgresPriceRulesRepository — PostgreSQL reel', () => {
  let pool: Pool;
  let repository: PostgresPriceRulesRepository;
  const tenantId = randomUUID() as TenantId;
  const foreignTenantId = randomUUID() as TenantId;
  const adminId = randomUUID() as UserId;
  const memberId = randomUUID() as UserId;
  const rangeId = randomUUID();
  const customerId = randomUUID();
  const createdRuleIds: string[] = [];

  beforeAll(async () => {
    pool = createPostgresPool();
    repository = new PostgresPriceRulesRepository(
      new PostgresTransactionRunner(pool, 'magrit_api'),
    );
    await pool.query(`
      insert into public.app_users (id, email_normalized, display_name)
      values ($1,$2,'Pricing Admin'), ($3,$4,'Pricing Member')
    `, [adminId, `pricing-admin-${adminId}@example.invalid`, memberId, `pricing-member-${memberId}@example.invalid`]);
    await pool.query(`
      insert into public.tenants (id, slug, name)
      values ($1,$2,'Pricing Integration'), ($3,$4,'Foreign Pricing')
    `, [tenantId, `pricing-${tenantId}`, foreignTenantId, `pricing-${foreignTenantId}`]);
    await pool.query(`
      insert into public.tenant_members (tenant_id, user_id, role)
      values ($1,$2,'admin'), ($1,$3,'member')
    `, [tenantId, adminId, memberId]);
    await pool.query(`
      insert into public.product_gammes (id, slug, name)
      values ($1,$2,'Gamme pricing integration')
    `, [rangeId, `pricing_${rangeId.replaceAll('-', '')}`]);
    await pool.query(`
      insert into public.customers (
        id, tenant_id, type, civility, first_name, last_name, created_by
      ) values ($1,$2,'individual','mr','Jean','Tarif',$3)
    `, [customerId, tenantId, adminId]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('delete from public.tenants where id = any($1::uuid[])', [[tenantId, foreignTenantId]]);
    await pool.query('delete from public.product_gammes where id = $1', [rangeId]);
    await pool.query('delete from public.app_users where id = any($1::uuid[])', [[adminId, memberId]]);
    await pool.end();
  });

  it('cree, modifie et audite une regle avec l acteur reel', async () => {
    const created = await repository.create(tenantId, adminId, {
      name: 'Marge globale', scope: 'global', value_type: 'margin_rate',
      value: '0.2500', starts_on: '2026-09-01', is_active: true,
    });
    createdRuleIds.push(created.id);
    const updated = await repository.update(tenantId, created.id, adminId, { is_active: false });
    expect(updated.is_active).toBe(false);

    const audit = await pool.query<{ action: string; actor_id: string }>(`
      select action, actor_id::text from public.price_rules_audit
       where price_rule_id = $1 order by occurred_at
    `, [created.id]);
    expect(audit.rows).toEqual([
      { action: 'created', actor_id: adminId },
      { action: 'deactivated', actor_id: adminId },
    ]);
  });

  it('arbitre par specificite puis par recence', async () => {
    const global = await repository.create(tenantId, adminId, {
      name: 'Globale', scope: 'global', value_type: 'discount_rate',
      value: '0.0500', starts_on: '2026-01-01', is_active: true,
    });
    const first = await repository.create(tenantId, adminId, {
      name: 'Client gamme ancienne', scope: 'customer_range', customer_id: customerId,
      product_range_id: rangeId, value_type: 'discount_rate', value: '0.1000',
      starts_on: '2026-01-01', is_active: true,
    });
    const latest = await repository.create(tenantId, adminId, {
      name: 'Client gamme recente', scope: 'customer_range', customer_id: customerId,
      product_range_id: rangeId, value_type: 'discount_rate', value: '0.1500',
      starts_on: '2026-01-01', is_active: true,
    });
    createdRuleIds.push(global.id, first.id, latest.id);
    await expect(repository.resolve(tenantId, {
      customerId, productRangeId: rangeId, at: '2026-09-30',
    })).resolves.toMatchObject({ rule: { id: latest.id }, reason: 'recency' });
    await expect(repository.resolve(tenantId, {
      customerId: null, productRangeId: null, at: '2026-09-30',
    })).resolves.toMatchObject({ rule: { id: global.id }, reason: 'specificity' });
  });

  it('gere la marge par defaut et refuse un membre simple en ecriture', async () => {
    await expect(repository.setDefaultMargin(tenantId, rangeId, adminId, '0.3000'))
      .resolves.toMatchObject({ margin_rate: '0.3000', updated_by: adminId });
    await expect(repository.getDefaultMargin(tenantId, rangeId))
      .resolves.toMatchObject({ margin_rate: '0.3000' });
    await expect(repository.setDefaultMargin(tenantId, rangeId, memberId, '0.4000'))
      .rejects.toMatchObject({ code: '42501' });
  });

  it('isole les tenants et expose la gamme partagee dans le contexte du tenant', async () => {
    await expect(repository.productRangeExists(tenantId, rangeId)).resolves.toBe(true);
    await expect(repository.list(foreignTenantId, {
      q: null, status: null, customerId: null, productRangeId: null,
      sort: { field: 'created_at', direction: 'desc' }, size: 100, cursor: null,
    })).resolves.toEqual({ rows: [] });
  });
});
