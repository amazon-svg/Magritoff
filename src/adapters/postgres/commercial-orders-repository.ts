import type { PoolClient } from 'pg';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';
import { QuoteNotFoundError } from '../../modules/commercial-quotes/application/commercial-quotes-repository.ts';
import type { TaxRegimeDto } from '../../modules/commercial-quotes/api/contracts.ts';
import {
  CommercialOrderNotFoundError,
  OrderAdministrativeStatusBlockedError,
  OrderStepUnchangedError,
  ProductionStepInactiveError,
  QuoteConversionForbiddenStatusError,
  type CommercialOrdersRepository,
  type ListCommercialOrdersParams,
  type ListCommercialOrdersResult,
  type ListOrderStepChangesParams,
  type ListOrderStepChangesResult,
  type OrderDataForDocumentGeneration,
} from '../../modules/commercial-orders/application/commercial-orders-repository.ts';
import type {
  ChangeOrderProductionStepCommand,
  CommercialOrderDetailDto,
  CommercialOrderDto,
  CommercialOrderLineDto,
  CommercialOrderStatus,
  CommercialOrderTotalsDto,
  ConvertedFromStatus,
  OrderStepChangeDto,
} from '../../modules/commercial-orders/api/contracts.ts';
import { ProductionStepNotFoundError } from '../../modules/production-steps/application/production-steps-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type Row = Record<string, any>;

export class PostgresCommercialOrdersRepository implements CommercialOrdersRepository {
  constructor(private readonly transactions: PostgresTransactionRunner) {}

  list(tenantId: TenantId, params: ListCommercialOrdersParams): Promise<ListCommercialOrdersResult> {
    return this.transactions.run({ tenantId }, async (client) => {
      const values: unknown[] = [tenantId];
      const predicates = ["orders.tenant_id = $1", "orders.order_origin = 'quote'"];

      addOptionalPredicate(predicates, values, 'orders.customer_id', params.customerId);
      addOptionalPredicate(predicates, values, 'orders.quote_id', params.quoteId);
      addOptionalPredicate(predicates, values, 'orders.status', params.status);
      addOptionalPredicate(
        predicates,
        values,
        'orders.current_production_step_id',
        params.currentProductionStepId,
      );
      addOptionalPredicate(predicates, values, 'orders.created_at', params.createdAtFrom, '>=');
      addOptionalPredicate(predicates, values, 'orders.created_at', params.createdAtTo, '<=');

      let join = '';
      let orderBy: string;

      if (params.sort === 'production_step' || params.sort === '-production_step') {
        join = 'left join public.production_steps steps on steps.id = orders.current_production_step_id';
        const descending = params.sort === '-production_step';
        orderBy = `steps.position ${descending ? 'desc' : 'asc'} nulls last, orders.created_at desc, orders.id desc`;

        if (params.cursor) {
          const separatorIndex = params.cursor.sort.lastIndexOf('|');
          if (separatorIndex < 0) throw new Error('Curseur production_step illisible.');

          const stepId = params.cursor.sort.slice(0, separatorIndex) || null;
          const createdAt = params.cursor.sort.slice(separatorIndex + 1);
          values.push(stepId, createdAt, params.cursor.id);
          const stepIndex = values.length - 2;
          const createdAtIndex = values.length - 1;
          const idIndex = values.length;
          const positionOperator = descending ? '<' : '>';

          predicates.push(`(
            ($${stepIndex}::uuid is not null and (
              steps.position ${positionOperator} (select position from public.production_steps where id = $${stepIndex})
              or steps.position is null
              or (
                steps.position = (select position from public.production_steps where id = $${stepIndex})
                and (
                  orders.created_at < $${createdAtIndex}
                  or (orders.created_at = $${createdAtIndex} and orders.id < $${idIndex})
                )
              )
            ))
            or ($${stepIndex}::uuid is null and steps.position is null and (
              orders.created_at < $${createdAtIndex}
              or (orders.created_at = $${createdAtIndex} and orders.id < $${idIndex})
            ))
          )`);
        }
      } else {
        const ascending = params.sort === 'created_at';
        const operator = ascending ? '>' : '<';
        orderBy = `orders.created_at ${ascending ? 'asc' : 'desc'}, orders.id ${ascending ? 'asc' : 'desc'}`;

        if (params.cursor) {
          values.push(params.cursor.sort, params.cursor.id);
          const sortIndex = values.length - 1;
          const idIndex = values.length;
          predicates.push(`(
            orders.created_at ${operator} $${sortIndex}
            or (orders.created_at = $${sortIndex} and orders.id ${operator} $${idIndex})
          )`);
        }
      }

      values.push(params.size + 1);
      const result = await client.query(
        `select orders.*, orders.expected_delivery_date::text as expected_delivery_date
         from public.tenant_orders orders
         ${join}
         where ${predicates.join(' and ')}
         order by ${orderBy}
         limit $${values.length}`,
        values,
      );

      return { rows: result.rows.map(toCommercialOrder) };
    });
  }

  findById(tenantId: TenantId, orderId: string): Promise<CommercialOrderDto | null> {
    return this.transactions.run({ tenantId }, async (client) => {
      const result = await client.query(
        "select * from public.tenant_orders where tenant_id = $1 and id = $2 and order_origin = 'quote'",
        [tenantId, orderId],
      );
      return result.rows[0] ? toCommercialOrder(result.rows[0]) : null;
    });
  }

  findDetailById(tenantId: TenantId, orderId: string): Promise<CommercialOrderDetailDto | null> {
    return this.transactions.run({ tenantId }, (client) => readCommercialOrderDetail(client, tenantId, orderId));
  }

  findStepChangeContext(tenantId: TenantId, orderId: string, actor: UserId | null) {
    return this.transactions.run({ tenantId, ...(actor ? { userId: actor } : { actorKind: 'service' as const }) }, async (client) => {
      const result = await client.query(
        `select number,customer_id,status::text,current_production_step_id
           from public.tenant_orders where tenant_id=$1 and id=$2`,
        [tenantId, orderId],
      );
      const row = result.rows[0];
      return row ? {
        number: row.number ?? null,
        customerId: row.customer_id ?? null,
        status: row.status,
        currentProductionStepId: row.current_production_step_id ?? null,
      } : null;
    });
  }

  async convertQuote(tenantId: TenantId, actor: UserId, quoteId: string): Promise<CommercialOrderDetailDto> {
    try {
      const orderId = await this.transactions.run({ tenantId, userId: actor }, async (client) => {
        const result = await client.query('select magrit.convert_commercial_quote($1, $2) as id', [
          tenantId,
          quoteId,
        ]);
        return result.rows[0].id as string;
      });
      const detail = await this.findDetailById(tenantId, orderId);
      if (!detail) throw new Error('Commande créée introuvable.');
      return detail;
    } catch (error) {
      throw mapQuoteConversionError(error);
    }
  }

  listStepChanges(
    tenantId: TenantId,
    orderId: string,
    params: ListOrderStepChangesParams,
    actor: UserId | null,
  ): Promise<ListOrderStepChangesResult> {
    return this.transactions.run({ tenantId, ...(actor ? { userId: actor } : { actorKind: 'service' as const }) }, async (client) => {
      const values: unknown[] = [orderId];
      let cursorPredicate = '';
      if (params.cursor) {
        values.push(params.cursor.sort, params.cursor.id);
        cursorPredicate = 'and (occurred_at < $2 or (occurred_at = $2 and id < $3))';
      }
      values.push(params.size + 1);

      const result = await client.query(
        `select * from public.commercial_order_step_changes
         where order_id = $1 ${cursorPredicate}
         order by occurred_at desc, id desc
         limit $${values.length}`,
        values,
      );
      return { rows: result.rows.map(toOrderStepChange) };
    });
  }

  async changeProductionStep(
    tenantId: TenantId,
    orderId: string,
    actor: UserId | null,
    command: ChangeOrderProductionStepCommand,
    serviceActorLabel: string | null,
  ): Promise<OrderStepChangeDto> {
    try {
      return await this.transactions.run(
        { tenantId, ...(actor ? { userId: actor } : {}) },
        async (client) => {
          const result = await client.query(
            'select * from magrit.change_commercial_order_step($1, $2, $3, $4, $5, $6)',
            [tenantId, orderId, command.step_id, actor, command.note ?? null, serviceActorLabel],
          );
          return toOrderStepChange(result.rows[0]);
        },
      );
    } catch (error) {
      throw mapProductionStepChangeError(error);
    }
  }

  findForDocumentGeneration(
    tenantId: TenantId,
    orderId: string,
  ): Promise<OrderDataForDocumentGeneration | null> {
    return this.transactions.run({ tenantId }, async (client) => {
      const orderResult = await client.query(
        `select orders.*, orders.expected_delivery_date::text as expected_delivery_date,
                quotes.number as quote_number
         from public.tenant_orders orders
         join public.commercial_quotes quotes on quotes.id = orders.quote_id
         where orders.tenant_id = $1 and orders.id = $2 and orders.order_origin = 'quote'`,
        [tenantId, orderId],
      );
      const order = orderResult.rows[0];
      if (!order) return null;

      const lines = await client.query(
        `select items.*, items.product_label as label, items.clariprint_options as product_config,
                items.line_origin as origin
           from public.tenant_order_items items where order_id = $1 order by position`,
        [orderId],
      );
      return {
        id: order.id,
        number: order.number,
        createdAt: toIsoTimestamp(order.created_at),
        customerId: order.customer_id,
        quoteNumber: order.quote_number,
        customerReference: order.customer_reference ?? null,
        expectedDeliveryDate: order.expected_delivery_date ?? null,
        showDiscounts: Boolean(order.show_discounts),
        totals: toCommercialOrderTotals(order),
        lines: lines.rows.map((line) => ({
          position: Number(line.position),
          label: line.label,
          descriptionHtml: line.description_html ?? null,
          productConfig: line.product_config ?? {},
          quantity: Number(line.quantity),
          customerPrice: toMoney(line.customer_price),
          discountRate: toRate(line.discount_rate),
          salePrice: toMoney(line.sale_price),
        })),
      };
    });
  }
}

function addOptionalPredicate(
  predicates: string[],
  values: unknown[],
  column: string,
  value: unknown,
  operator = '=',
): void {
  if (value === null || value === undefined) return;
  values.push(value);
  predicates.push(`${column} ${operator} $${values.length}`);
}

function toMoney(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toFixed(2);
  return '0.00';
}

function toRate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toFixed(4);
  return null;
}

function toCommercialOrderTotals(row: Row): CommercialOrderTotalsDto {
  return {
    lines_subtotal: toMoney(row.lines_subtotal),
    global_discount: toMoney(row.global_discount),
    effective_discount_rate: toRate(row.effective_discount_rate),
    net_total: toMoney(row.net_total),
    vat_rate: toRate(row.vat_rate) ?? '0.0000',
    vat_regime: isTaxRegime(row.vat_regime) ? row.vat_regime : null,
    vat_amount: toMoney(row.vat_amount),
    total_incl_tax: toMoney(row.total_incl_tax),
  };
}

function isTaxRegime(value: unknown): value is TaxRegimeDto {
  return ['metropole_fr', 'dom_tom', 'franchise_tva', 'export_eu', 'export_world'].includes(String(value));
}

function toCommercialOrder(row: Row): CommercialOrderDto {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    customer_id: row.customer_id,
    quote_id: row.quote_id,
    number: row.number,
    status: row.status as CommercialOrderStatus,
    source_quote_status: row.source_quote_status as ConvertedFromStatus,
    current_production_step_id: row.current_production_step_id ?? null,
    totals: toCommercialOrderTotals(row),
    created_by: row.created_by ?? null,
    created_at: toIsoTimestamp(row.created_at),
    updated_at: toIsoTimestamp(row.updated_at),
  };
}

function toCommercialOrderLine(row: Row): CommercialOrderLineDto {
  return {
    id: row.id,
    order_id: row.order_id,
    source_quote_line_id: row.source_quote_line_id,
    origin: row.origin,
    label: row.label,
    description_html: row.description_html ?? null,
    product_config: row.product_config ?? {},
    quantity: Number(row.quantity),
    position: Number(row.position),
    production_price: toMoney(row.production_price),
    public_price: toMoney(row.public_price),
    customer_price: toMoney(row.customer_price),
    applied_margin_rate: toRate(row.applied_margin_rate) ?? '0.0000',
    applied_rule_id: row.applied_rule_id ?? null,
    sale_price: toMoney(row.sale_price),
    sale_margin_rate: toRate(row.sale_margin_rate),
    discount_rate: toRate(row.discount_rate),
    margin_variation: toRate(row.margin_variation),
    breakdown: Array.isArray(row.breakdown) ? row.breakdown : [],
    created_at: toIsoTimestamp(row.created_at),
  };
}

function toOrderStepChange(row: Row): OrderStepChangeDto {
  return {
    id: row.id,
    order_id: row.order_id,
    from_step_id: row.from_step_id ?? null,
    to_step_id: row.to_step_id,
    note: row.note ?? null,
    actor_id: row.actor_id ?? null,
    actor_label: row.actor_label ?? null,
    occurred_at: toIsoTimestamp(row.occurred_at),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function mapQuoteConversionError(error: unknown): Error {
  const message = errorMessage(error);
  if (message.includes('conversion_forbidden')) return new QuoteConversionForbiddenStatusError(message);
  if (message.includes('quote.not_found')) return new QuoteNotFoundError(message);
  return error instanceof Error ? error : new Error(message);
}

function mapProductionStepChangeError(error: unknown): Error {
  const message = errorMessage(error);
  if (message.includes('order.not_found')) return new CommercialOrderNotFoundError(message);
  if (message.includes('production_step.not_found')) return new ProductionStepNotFoundError(message);
  if (message.includes('production_step.inactive')) return new ProductionStepInactiveError(message);
  if (message.includes('order.administrative_status_blocked')) return new OrderAdministrativeStatusBlockedError(message);
  if (message.includes('step_unchanged')) return new OrderStepUnchangedError(message);
  return error instanceof Error ? error : new Error(message);
}

/** Shared by the historical façade and the unified order projection. */
export async function readCommercialOrderDetail(client: PoolClient, tenantId: TenantId, orderId: string): Promise<CommercialOrderDetailDto | null> {
  const orderResult = await client.query(
    `select orders.*, orders.expected_delivery_date::text as expected_delivery_date
     from public.tenant_orders orders
     where orders.tenant_id = $1 and orders.id = $2 and orders.order_origin = 'quote'`,
    [tenantId, orderId],
  );
  const order = orderResult.rows[0];
  if (!order) return null;

  const lines = await client.query(
    `select items.*, items.product_label as label, items.clariprint_options as product_config,
            items.line_origin as origin
       from public.tenant_order_items items where order_id = $1 order by position`,
    [orderId],
  );
  return {
    ...toCommercialOrder(order),
    customer_contact_id: order.customer_contact_id ?? null,
    expected_delivery_date: order.expected_delivery_date ?? null,
    lines: lines.rows.map(toCommercialOrderLine),
  };
}
