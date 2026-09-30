import type { PoolClient } from 'pg';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp, toIsoTimestampOrNull } from '../../modules/_shared/application/index.ts';
import type {
  CreatePriceRuleCommand,
  PriceRuleDto,
  PriceRuleResolveResultDto,
  ProductRangeDefaultMarginDto,
  UpdatePriceRuleCommand,
} from '../../modules/pricing/api/contracts.ts';
import {
  PriceRuleCommandRejectedError,
  PriceRuleNotFoundError,
  type ListPriceRulesParams,
  type ListPriceRulesResult,
  type PriceRulesRepository,
  type ResolvePriceRuleParams,
} from '../../modules/pricing/application/price-rules-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type PriceRuleRow = Readonly<{
  id: string; tenant_id: string; name: string;
  scope: PriceRuleDto['scope']; customer_id: string | null; product_range_id: string | null;
  value_type: PriceRuleDto['value_type']; value: string | number;
  valid_from: string | Date; valid_to: string | Date | null; is_active: boolean;
  created_by: string | null; created_at: Date; updated_at: Date;
}>;
type MarginRow = Readonly<{
  tenant_id: string; product_range_id: string; margin_rate: string | number;
  updated_at: Date; updated_by: string | null;
}>;

export class PostgresPriceRulesRepository implements PriceRulesRepository {
  constructor(private readonly transactions: PostgresTransactionRunner) {}

  list(tenantId: TenantId, params: ListPriceRulesParams): Promise<ListPriceRulesResult> {
    return this.transactions.run({ tenantId }, async (client) => {
      const column = params.sort.field === 'starts_on' ? 'valid_from' : 'created_at';
      const direction = params.sort.direction;
      const values: unknown[] = [tenantId];
      const filters = ['tenant_id = $1'];
      if (params.status !== null) {
        values.push(params.status === 'active');
        filters.push(`is_active = $${values.length}`);
      }
      if (params.q !== null) {
        const q = sanitizeSearchTerm(params.q);
        if (q.length > 0) {
          values.push(`%${escapeLike(q)}%`);
          filters.push(`name ilike $${values.length} escape '\\'`);
        }
      }
      if (params.customerId !== null) {
        values.push(params.customerId);
        filters.push(`customer_id = $${values.length}`);
      }
      if (params.productRangeId !== null) {
        values.push(params.productRangeId);
        filters.push(`product_range_id = $${values.length}`);
      }
      if (params.cursor !== null) {
        values.push(params.cursor.value, params.cursor.id);
        const comparison = direction === 'asc' ? '>' : '<';
        const cast = column === 'created_at' ? 'timestamptz' : 'date';
        filters.push(`(${column}, id) ${comparison} ($${values.length - 1}::${cast}, $${values.length}::uuid)`);
      }
      values.push(params.size + 1);
      const result = await client.query<PriceRuleRow>(`
        select * from public.price_rules
         where ${filters.join(' and ')}
         order by ${column} ${direction}, id ${direction}
         limit $${values.length}
      `, values);
      return { rows: result.rows.map(toPriceRuleDto) };
    });
  }

  findById(tenantId: TenantId, priceRuleId: string): Promise<PriceRuleDto | null> {
    return this.transactions.run({ tenantId }, async (client) => {
      const result = await client.query<PriceRuleRow>(
        'select * from public.price_rules where tenant_id = $1 and id = $2',
        [tenantId, priceRuleId],
      );
      return result.rows[0] === undefined ? null : toPriceRuleDto(result.rows[0]);
    });
  }

  create(tenantId: TenantId, actor: UserId, command: CreatePriceRuleCommand): Promise<PriceRuleDto> {
    return this.write(tenantId, actor, async (client) => {
      const result = await client.query<PriceRuleRow>(`
        insert into public.price_rules (
          tenant_id, name, scope, customer_id, product_range_id, value_type,
          value, valid_from, valid_to, is_active, created_by
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        returning *
      `, [tenantId, command.name, command.scope, command.customer_id ?? null,
        command.product_range_id ?? null, command.value_type, command.value,
        command.starts_on, command.ends_on ?? null, command.is_active, actor]);
      return toPriceRuleDto(required(result.rows[0]));
    }, 'Création de la règle de prix impossible.');
  }

  update(tenantId: TenantId, priceRuleId: string, actor: UserId, command: UpdatePriceRuleCommand): Promise<PriceRuleDto> {
    return this.write(tenantId, actor, async (client) => {
      const fields: Array<[string, unknown]> = [];
      add(fields, 'name', command.name);
      add(fields, 'value', command.value);
      add(fields, 'valid_from', command.starts_on);
      add(fields, 'valid_to', command.ends_on);
      add(fields, 'is_active', command.is_active);
      if (fields.length === 0) throw new PriceRuleNotFoundError();
      const assignments = fields.map(([column], index) => `${column} = $${index + 3}`);
      const result = await client.query<PriceRuleRow>(`
        update public.price_rules set ${assignments.join(', ')}
         where tenant_id = $1 and id = $2 returning *
      `, [tenantId, priceRuleId, ...fields.map(([, value]) => value)]);
      if (result.rows[0] === undefined) throw new PriceRuleNotFoundError();
      return toPriceRuleDto(result.rows[0]);
    }, 'Modification de la règle de prix impossible.');
  }

  resolve(tenantId: TenantId, params: ResolvePriceRuleParams): Promise<PriceRuleResolveResultDto> {
    return this.transactions.run({ tenantId }, async (client) => {
      const result = await client.query<PriceRuleRow & { candidate_count: string | number }>(`
        with candidates as (
          select pr.*,
            case pr.scope when 'customer_range' then 3 when 'customer' then 2
              when 'range' then 1 else 0 end as specificity_rank
          from public.price_rules pr
          where pr.tenant_id = $1 and pr.is_active
            and pr.valid_from <= $4::date
            and (pr.valid_to is null or pr.valid_to >= $4::date)
            and (
              pr.scope = 'global'
              or (pr.scope = 'range' and $3::uuid is not null and pr.product_range_id = $3)
              or (pr.scope = 'customer' and $2::uuid is not null and pr.customer_id = $2)
              or (pr.scope = 'customer_range' and $2::uuid is not null and $3::uuid is not null
                  and pr.customer_id = $2 and pr.product_range_id = $3)
            )
        ), ranked as (
          select *, count(*) over (partition by specificity_rank) as candidate_count
          from candidates
        )
        select * from ranked
        order by specificity_rank desc, created_at desc, id desc
        limit 1
      `, [tenantId, params.customerId, params.productRangeId, params.at]);
      const row = result.rows[0];
      if (row === undefined) return { rule: null, reason: null };
      return {
        rule: toPriceRuleDto(row),
        reason: Number(row.candidate_count) > 1 ? 'recency' : 'specificity',
      };
    });
  }

  productRangeExists(tenantId: TenantId, productRangeId: string): Promise<boolean> {
    return this.transactions.run({ tenantId }, async (client) => {
      const result = await client.query(
        'select 1 from public.product_gammes where id = $1',
        [productRangeId],
      );
      return result.rowCount === 1;
    });
  }

  getDefaultMargin(tenantId: TenantId, productRangeId: string): Promise<ProductRangeDefaultMarginDto> {
    return this.transactions.run({ tenantId }, async (client) => {
      const result = await client.query<MarginRow>(`
        select * from public.product_range_default_margins
         where tenant_id = $1 and product_range_id = $2
      `, [tenantId, productRangeId]);
      return result.rows[0] === undefined
        ? { tenant_id: tenantId, product_range_id: productRangeId, margin_rate: null, updated_at: null, updated_by: null }
        : toMarginDto(result.rows[0]);
    });
  }

  setDefaultMargin(tenantId: TenantId, productRangeId: string, actor: UserId, marginRate: string): Promise<ProductRangeDefaultMarginDto> {
    return this.write(tenantId, actor, async (client) => {
      const result = await client.query<MarginRow>(`
        insert into public.product_range_default_margins (
          tenant_id, product_range_id, margin_rate, updated_by
        ) values ($1,$2,$3,$4)
        on conflict (tenant_id, product_range_id) do update set
          margin_rate = excluded.margin_rate, updated_by = excluded.updated_by
        returning *
      `, [tenantId, productRangeId, marginRate, actor]);
      return toMarginDto(required(result.rows[0]));
    }, 'Enregistrement de la marge publique standard impossible.');
  }

  actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean> {
    return this.transactions.run({ tenantId, userId: actorId }, async (client) => {
      const result = await client.query<{ allowed: boolean }>(
        'select magrit.actor_has_capability($1, $2) as allowed',
        [tenantId, capability],
      );
      return result.rows[0]?.allowed === true;
    });
  }

  private write<T>(tenantId: TenantId, actor: UserId | undefined, operation: (client: PoolClient) => Promise<T>, fallback: string): Promise<T> {
    return this.transactions.run({ tenantId, ...(actor === undefined ? {} : { userId: actor }) }, async (client) => {
      try { return await operation(client); } catch (error) { throw mapError(error, fallback); }
    });
  }
}

function sanitizeSearchTerm(raw: string): string { return raw.replace(/[,()%]/g, ' ').replace(/\s+/g, ' ').trim(); }
function escapeLike(value: string): string { return value.replace(/[\\_%]/g, '\\$&'); }
function add(fields: Array<[string, unknown]>, column: string, value: unknown): void {
  if (value !== undefined) fields.push([column, value]);
}
function required<T>(row: T | undefined): T { if (row === undefined) throw new Error('Ligne PostgreSQL absente.'); return row; }
function dateOnly(value: string | Date): string { return value instanceof Date ? value.toISOString().slice(0, 10) : value; }
function rate(value: string | number): string { return typeof value === 'string' ? value : value.toFixed(4); }
function toPriceRuleDto(row: PriceRuleRow): PriceRuleDto { return {
  id: row.id, tenant_id: row.tenant_id, name: row.name, scope: row.scope,
  customer_id: row.customer_id, product_range_id: row.product_range_id,
  value_type: row.value_type, value: rate(row.value), starts_on: dateOnly(row.valid_from),
  ends_on: row.valid_to === null ? null : dateOnly(row.valid_to), is_active: row.is_active,
  created_by: row.created_by, created_at: toIsoTimestamp(row.created_at), updated_at: toIsoTimestamp(row.updated_at),
}; }
function toMarginDto(row: MarginRow): ProductRangeDefaultMarginDto { return {
  tenant_id: row.tenant_id, product_range_id: row.product_range_id,
  margin_rate: rate(row.margin_rate), updated_at: toIsoTimestampOrNull(row.updated_at), updated_by: row.updated_by,
}; }
function mapError(error: unknown, fallback: string): Error {
  if (error instanceof PriceRuleNotFoundError) return error;
  const value = error as { code?: string; constraint?: string; message?: string };
  if (value.code === '23514') {
    const code = value.constraint?.includes('scope') ? 'price_rule.invalid_scope'
      : value.constraint?.includes('period') ? 'price_rule.invalid_period' : 'api.validation_failed';
    return new PriceRuleCommandRejectedError(code, value.message ?? fallback);
  }
  if (value.code === '23503' || value.code === '22P02') {
    return new PriceRuleCommandRejectedError('api.validation_failed', value.message ?? fallback);
  }
  return error instanceof Error ? error : new Error(fallback);
}
