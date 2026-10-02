import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp, toIsoTimestampOrNull } from '../../modules/_shared/application/index.ts';
import {
  computeQuoteLineWarnings,
  formatCentsToMoneyNonNegative,
  parseMoneyNonNegativeToCents,
} from '../../modules/commercial-quotes/application/quote-line-pricing.ts';
import { computeQuoteTotals, computeQuoteWarnings } from '../../modules/commercial-quotes/application/quote-totals.ts';
import type {
  CreateQuoteFromProjectCommand,
  QuoteAuditEntryDto,
  QuoteDetailDto,
  QuoteDto,
  QuoteLineDto,
  SendQuoteCommand,
  TaxRegimeDto,
  UpdateQuoteCommand,
} from '../../modules/commercial-quotes/api/contracts.ts';
import {
  QuoteCommandRejectedError,
  QuoteDeleteRequiresDraftError,
  QuoteLineNotFoundError,
  QuoteLinePositionsMismatchError,
  QuoteLineQuoteNotDraftError,
  QuoteNotFoundError,
  QuoteProjectNotFoundError,
  QuoteResendImmutableError,
  QuoteSendForbiddenStatusError,
  QuoteSendRequiresLinesError,
  QuoteUpdateRequiresDraftError,
  type CommercialQuotesRepository,
  type ListQuoteHeaderAuditParams,
  type ListQuoteHeaderAuditResult,
  type ListQuoteLineAuditParams,
  type ListQuoteLineAuditResult,
  type ListQuotesParams,
  type ListQuotesResult,
  type PricedQuoteLineWrite,
  type QuoteLineWriteUpdate,
} from '../../modules/commercial-quotes/application/commercial-quotes-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type QuoteRow = Record<string, unknown> & {
  id: string; tenant_id: string; customer_id: string; project_id: string;
  created_at: Date; updated_at: Date;
};
type QuoteLineRow = Record<string, unknown> & {
  id: string; quote_id: string; created_at: Date;
};
type QuoteWithSubtotalRow = QuoteRow & { lines_subtotal: string | number };
type AuditRow = Record<string, unknown> & { id: string; occurred_at: Date };

const DEFAULT_TAX_REGIME: TaxRegimeDto = 'metropole_fr';

/** Adaptateur direct PostgreSQL des devis commerciaux, sans RPC PostgREST. */
export class PostgresCommercialQuotesRepository implements CommercialQuotesRepository {
  constructor(private readonly transactions: PostgresTransactionRunner) {}

  list(tenantId: TenantId, params: ListQuotesParams): Promise<ListQuotesResult> {
    return this.transactions.run({ tenantId }, async (client) => {
      const values: unknown[] = [tenantId];
      const filters = ['quote.tenant_id = $1'];
      if (params.customerId !== null) { values.push(params.customerId); filters.push(`quote.customer_id = $${values.length}`); }
      if (params.projectId !== null) { values.push(params.projectId); filters.push(`quote.project_id = $${values.length}`); }
      if (params.status !== null) { values.push(params.status); filters.push(`quote.status = $${values.length}`); }
      if (params.cursor !== null) {
        values.push(params.cursor.sort, params.cursor.id);
        filters.push(`(quote.created_at, quote.id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`);
      }
      values.push(params.size + 1);
      const [quotes, taxRegime] = await Promise.all([
        client.query<QuoteWithSubtotalRow>(`
          select quote.*, coalesce(sum(line.sale_price), 0)::numeric(12,2) as lines_subtotal
            from public.commercial_quotes quote
            left join public.commercial_quote_lines line on line.quote_id = quote.id
           where ${filters.join(' and ')}
           group by quote.id
           order by quote.created_at desc, quote.id desc
           limit $${values.length}
        `, values),
        this.selectTaxRegime(client, tenantId),
      ]);
      return { rows: quotes.rows.map((row) => toQuoteDto(row, money(row.lines_subtotal), taxRegime)) };
    });
  }

  findById(tenantId: TenantId, quoteId: string): Promise<QuoteDto | null> {
    return this.transactions.run({ tenantId }, async (client) => this.selectQuote(client, tenantId, quoteId));
  }

  findDetailById(tenantId: TenantId, quoteId: string): Promise<QuoteDetailDto | null> {
    return this.transactions.run({ tenantId }, async (client) => this.selectDetail(client, tenantId, quoteId));
  }

  getTenantTaxRegime(tenantId: TenantId): Promise<TaxRegimeDto> {
    return this.transactions.run({ tenantId }, (client) => this.selectTaxRegime(client, tenantId));
  }

  createFromProjectItems(
    tenantId: TenantId,
    actor: UserId,
    command: CreateQuoteFromProjectCommand,
  ): Promise<QuoteDetailDto> {
    return this.write(tenantId, actor, async (client) => {
      if (command.item_ids.length === 0) throw invalidItems('Au moins un élément de projet est requis.');
      const project = await client.query<{ customer_id: string }>(
        'select customer_id from public.projects where tenant_id = $1 and id = $2 for update',
        [tenantId, command.project_id],
      );
      const customerId = project.rows[0]?.customer_id;
      if (customerId === undefined) throw new QuoteProjectNotFoundError();
      const itemCount = await client.query<{ count: number }>(`
        select count(*)::integer as count from public.project_items
         where tenant_id = $1 and project_id = $2 and id = any($3::uuid[])
      `, [tenantId, command.project_id, command.item_ids]);
      if (itemCount.rows[0]?.count !== new Set(command.item_ids).size || command.item_ids.length !== new Set(command.item_ids).size) {
        throw invalidItems('Un ou plusieurs éléments ne correspondent pas à ce projet.');
      }

      const { number } = await this.nextNumber(client, tenantId);
      const created = await client.query<QuoteRow>(`
        insert into public.commercial_quotes (
          tenant_id, customer_id, project_id, number, created_by
        ) values ($1,$2,$3,$4,$5) returning *
      `, [tenantId, customerId, command.project_id, number, actor]);
      const quote = required(created.rows[0]);

      const lines = await client.query<QuoteLineRow>(`
        with selected_items as (
          select item.*,
            greatest(coalesce(nullif(item.quote_payload->>'quantity', '')::numeric, 1), 1)::integer as quantity,
            coalesce(
              nullif(item.quote_payload#>>'{amounts,clariprint_price_ht}', '')::numeric,
              nullif(item.quote_payload#>>'{amounts,price}', '')::numeric,
              0
            )::numeric(12,2) as production_price,
            row_number() over (order by item.position, item.id) - 1 as quote_position
          from public.project_items item
          where item.tenant_id = $1 and item.project_id = $2 and item.id = any($3::uuid[])
        ), priced as (
          select selected_items.*,
            coalesce(case when rule.value_type = 'margin_rate' then rule.value end, 0)::numeric(6,4) as margin_rate,
            rule.id as rule_id,
            rule.value_type as rule_value_type,
            rule.value as rule_value
          from selected_items
          left join lateral (
            select candidate.* from public.price_rules candidate
             where candidate.tenant_id = $1 and candidate.is_active
               and candidate.valid_from <= current_date
               and (candidate.valid_to is null or candidate.valid_to >= current_date)
               and (candidate.scope = 'global' or (candidate.scope = 'customer' and candidate.customer_id = $4))
             order by case candidate.scope when 'customer' then 2 else 0 end desc,
                      candidate.created_at desc, candidate.id desc
             limit 1
          ) rule on true
        ), calculated as (
          select priced.*,
            round(production_price * (1 + margin_rate), 2)::numeric(12,2) as public_price
          from priced
        ), final as (
          select calculated.*,
            case when rule_value_type = 'discount_rate'
              then round(public_price * (1 - rule_value), 2)::numeric(12,2)
              else public_price end as customer_price
          from calculated
        )
        insert into public.commercial_quote_lines (
          quote_id, origin, project_item_id, label, description_html, product_config,
          quantity, chiffrage_quantity, position, production_price, public_price,
          customer_price, applied_margin_rate, applied_rule_id, sale_price,
          sale_margin_rate, discount_rate, margin_variation, breakdown
        )
        select $5, 'project_item', id, label, description_html, quote_payload,
          quantity, quantity, quote_position, production_price, public_price,
          customer_price, margin_rate, rule_id, customer_price,
          case when production_price = 0 then null else round((customer_price-production_price)/production_price, 4) end,
          case when customer_price = 0 then null else 0 end,
          case when production_price = 0 then null
               else round(round((customer_price-production_price)/production_price, 4)-margin_rate, 4) end,
          jsonb_build_array(jsonb_build_object(
            'post','total','cost',production_price::text,'margin_rate',margin_rate::text,
            'price',customer_price::text,'source','clariprint'
          ))
        from final order by quote_position
        returning *
      `, [tenantId, command.project_id, command.item_ids, customerId, quote.id]);
      await this.auditAddedLines(client, actor, quote.id, lines.rows, randomUUID());
      return required(await this.selectDetail(client, tenantId, quote.id));
    }, 'Création du devis impossible.');
  }

  update(
    tenantId: TenantId,
    quoteId: string,
    actor: UserId,
    command: UpdateQuoteCommand,
  ): Promise<QuoteDto> {
    return this.write(tenantId, actor, async (client) => {
      const current = await this.lockQuote(client, tenantId, quoteId);
      if (current === null) throw new QuoteNotFoundError();
      if (current['status'] !== 'draft') throw new QuoteUpdateRequiresDraftError();
      const fields: Array<[string, unknown]> = [];
      add(fields, 'valid_until', command.valid_until);
      add(fields, 'show_discounts', command.show_discounts);
      if ('global_discount_rate' in command) {
        fields.push(['global_discount_rate', command.global_discount_rate], ['target_net_total', null]);
      }
      if ('target_net_total' in command) {
        fields.push(['target_net_total', command.target_net_total], ['global_discount_rate', null]);
      }
      add(fields, 'vat_rate', command.vat_rate);
      if (fields.length > 0) {
        const assignments = fields.map(([column], index) => `${column} = $${index + 3}`);
        await client.query(
          `update public.commercial_quotes set ${assignments.join(', ')} where tenant_id = $1 and id = $2`,
          [tenantId, quoteId, ...fields.map(([, value]) => value)],
        );
        await this.auditHeaderChanges(client, actor, quoteId, current, fields, randomUUID());
      }
      return required(await this.selectQuote(client, tenantId, quoteId));
    }, 'Modification du devis impossible.');
  }

  remove(tenantId: TenantId, quoteId: string): Promise<void> {
    return this.write(tenantId, undefined, async (client) => {
      const result = await client.query(
        "delete from public.commercial_quotes where tenant_id = $1 and id = $2 and status = 'draft' returning id",
        [tenantId, quoteId],
      );
      if (result.rowCount !== 1) throw new QuoteDeleteRequiresDraftError();
    }, 'Suppression du devis impossible.');
  }

  resolveValidUntilForSend(tenantId: TenantId, quoteId: string): Promise<string | null> {
    return this.transactions.run({ tenantId }, async (client) => {
      const result = await client.query<{ valid_until: string | Date | null }>(`
        select coalesce(quote.valid_until,
          case when settings.default_validity_days is null then null
               else current_date + settings.default_validity_days end) as valid_until
          from public.commercial_quotes quote
          left join public.commercial_settings settings on settings.tenant_id = quote.tenant_id
         where quote.tenant_id = $1 and quote.id = $2
      `, [tenantId, quoteId]);
      if (result.rows[0] === undefined) throw new QuoteNotFoundError();
      return dateOnly(result.rows[0].valid_until);
    });
  }

  sendQuote(
    tenantId: TenantId,
    actor: UserId,
    quoteId: string,
    command: SendQuoteCommand,
    resolvedValidUntil: string | null,
  ): Promise<QuoteDetailDto> {
    return this.write(tenantId, actor, async (client) => {
      const current = await this.lockQuote(client, tenantId, quoteId);
      if (current === null) throw new QuoteNotFoundError();
      const status = current['status'];
      if (status !== 'draft' && status !== 'sent') throw new QuoteSendForbiddenStatusError();
      const changeSet = randomUUID();
      if (status === 'draft') {
        const count = await client.query<{ count: number }>(
          'select count(*)::integer as count from public.commercial_quote_lines where quote_id = $1', [quoteId],
        );
        if (count.rows[0]?.count === 0) throw new QuoteSendRequiresLinesError();
        let validUntil = current['valid_until'] ?? resolvedValidUntil;
        if (validUntil == null) {
          const settings = await client.query<{ valid_until: string | Date | null }>(`
            select case when default_validity_days is null then null
                   else current_date + default_validity_days end as valid_until
              from public.commercial_settings where tenant_id=$1
          `, [tenantId]);
          validUntil = settings.rows[0]?.valid_until ?? null;
        }
        const showDiscounts = command.show_discounts ?? current['show_discounts'];
        await client.query(`
          update public.commercial_quotes set status='sent', sent_at=coalesce(sent_at,clock_timestamp()),
            last_sent_at=clock_timestamp(), sent_by=$3, valid_until=$4, show_discounts=$5
           where tenant_id=$1 and id=$2
        `, [tenantId, quoteId, actor, validUntil, showDiscounts]);
        await this.auditHeaderChanges(client, actor, quoteId, current, [
          ['valid_until', validUntil], ['show_discounts', showDiscounts],
        ], changeSet);
        const snapshot = await client.query<{ snapshot: Record<string, unknown> }>(`
          select jsonb_build_object('quote',to_jsonb(quote),'lines',coalesce(
            (select jsonb_agg(to_jsonb(line) order by line.position) from public.commercial_quote_lines line where line.quote_id=quote.id),
            '[]'::jsonb)) as snapshot
          from public.commercial_quotes quote where quote.id=$1
        `, [quoteId]);
        await this.insertHeaderAudit(client, actor, quoteId, changeSet, 'sent', null, null, null,
          required(snapshot.rows[0]).snapshot);
      } else {
        if (command.show_discounts !== undefined && command.show_discounts !== current['show_discounts']) {
          throw new QuoteResendImmutableError();
        }
        await client.query('update public.commercial_quotes set last_sent_at=clock_timestamp() where id=$1', [quoteId]);
        await this.insertHeaderAudit(client, actor, quoteId, changeSet, 'resent', null, null, null, null);
      }
      return required(await this.selectDetail(client, tenantId, quoteId));
    }, 'Envoi du devis impossible.');
  }

  duplicateQuote(tenantId: TenantId, actor: UserId, quoteId: string): Promise<QuoteDetailDto> {
    return this.write(tenantId, actor, async (client) => {
      const source = await this.lockQuote(client, tenantId, quoteId);
      if (source === null) throw new QuoteNotFoundError();
      const { number } = await this.nextNumber(client, tenantId);
      const copy = await client.query<QuoteRow>(`
        insert into public.commercial_quotes (
          tenant_id,customer_id,project_id,source_quote_id,number,show_discounts,
          global_discount_rate,target_net_total,vat_rate,created_by
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *
      `, [tenantId, source['customer_id'], source['project_id'], quoteId, number,
        source['show_discounts'], source['global_discount_rate'], source['target_net_total'], source['vat_rate'], actor]);
      const copied = required(copy.rows[0]);
      const lines = await client.query<QuoteLineRow>(`
        insert into public.commercial_quote_lines (
          quote_id,origin,project_item_id,label,description_html,product_config,quantity,
          chiffrage_quantity,position,production_price,public_price,customer_price,
          applied_margin_rate,applied_rule_id,sale_price,sale_margin_rate,
          discount_rate,margin_variation,breakdown
        ) select $2,origin,project_item_id,label,description_html,product_config,quantity,
          chiffrage_quantity,position,production_price,public_price,customer_price,
          applied_margin_rate,applied_rule_id,sale_price,sale_margin_rate,
          discount_rate,margin_variation,breakdown
          from public.commercial_quote_lines where quote_id=$1 order by position returning *
      `, [quoteId, copied.id]);
      await this.auditAddedLines(client, actor, copied.id, lines.rows, randomUUID());
      await this.insertHeaderAudit(client, actor, quoteId, randomUUID(), 'duplicated', null, null, copied.id, null);
      return required(await this.selectDetail(client, tenantId, copied.id));
    }, 'Duplication du devis impossible.');
  }

  listHeaderAuditEntries(tenantId: TenantId, params: ListQuoteHeaderAuditParams): Promise<ListQuoteHeaderAuditResult> {
    return this.transactions.run({ tenantId }, async (client) => {
      const values: unknown[] = [params.quoteId];
      const filters = ['quote_id=$1'];
      if (params.cursor !== null) {
        values.push(params.cursor.sort, params.cursor.id);
        filters.push(`(occurred_at,id)<($${values.length - 1}::timestamptz,$${values.length}::uuid)`);
      }
      values.push(params.size + 1);
      const result = await client.query<AuditRow>(`
        select * from public.commercial_quote_header_audit where ${filters.join(' and ')}
         order by occurred_at desc,id desc limit $${values.length}
      `, values);
      return { rows: result.rows.map(toHeaderAuditDto) };
    });
  }

  findLineById(tenantId: TenantId, quoteId: string, lineId: string): Promise<QuoteLineDto | null> {
    return this.transactions.run({ tenantId }, async (client) => {
      const result = await client.query<QuoteLineRow>(`
        select line.* from public.commercial_quote_lines line
        join public.commercial_quotes quote on quote.id=line.quote_id
        where quote.tenant_id=$1 and quote.id=$2 and line.id=$3
      `, [tenantId, quoteId, lineId]);
      return result.rows[0] === undefined ? null : toQuoteLineDto(result.rows[0]);
    });
  }

  addLine(tenantId: TenantId, quoteId: string, actor: UserId, line: PricedQuoteLineWrite): Promise<QuoteLineDto> {
    return this.write(tenantId, actor, async (client) => {
      await this.requireDraftQuote(client, tenantId, quoteId);
      const created = await client.query<QuoteLineRow>(`
        insert into public.commercial_quote_lines (
          quote_id,origin,project_item_id,label,description_html,product_config,quantity,
          chiffrage_quantity,position,production_price,public_price,customer_price,
          applied_margin_rate,applied_rule_id,sale_price,sale_margin_rate,
          discount_rate,margin_variation,breakdown
        ) values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,
          (select coalesce(max(position)+1,0) from public.commercial_quote_lines where quote_id=$1),
          $9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb) returning *
      `, [quoteId,line.origin,line.projectItemId,line.label,line.descriptionHtml,JSON.stringify(line.productConfig),
        line.quantity,line.chiffrageQuantity,line.productionPrice,line.publicPrice,line.customerPrice,
        line.appliedMarginRate,line.appliedRuleId,line.salePrice,line.saleMarginRate,line.discountRate,
        line.marginVariation,JSON.stringify(line.breakdown)]);
      const row = required(created.rows[0]);
      await this.auditAddedLines(client, actor, quoteId, [row], randomUUID());
      return toQuoteLineDto(row);
    }, 'Ajout de la ligne de devis impossible.');
  }

  updateLine(
    tenantId: TenantId,
    quoteId: string,
    lineId: string,
    actor: UserId,
    update: QuoteLineWriteUpdate,
  ): Promise<QuoteLineDto> {
    return this.write(tenantId, actor, async (client) => {
      await this.requireDraftQuote(client, tenantId, quoteId);
      const before = await client.query<QuoteLineRow>(
        'select * from public.commercial_quote_lines where quote_id=$1 and id=$2 for update', [quoteId, lineId],
      );
      const current = before.rows[0];
      if (current === undefined) throw new QuoteLineNotFoundError();
      const fields: Array<[string, unknown]> = [];
      add(fields, 'description_html', update.descriptionHtml);
      add(fields, 'quantity', update.quantity);
      add(fields, 'sale_price', update.salePrice);
      add(fields, 'sale_margin_rate', update.saleMarginRate);
      add(fields, 'discount_rate', update.discountRate);
      add(fields, 'margin_variation', update.marginVariation);
      if (fields.length === 0) return toQuoteLineDto(current);
      const assignments = fields.map(([column], index) => `${column}=$${index + 3}`);
      const result = await client.query<QuoteLineRow>(`
        update public.commercial_quote_lines set ${assignments.join(', ')}
         where quote_id=$1 and id=$2 returning *
      `, [quoteId, lineId, ...fields.map(([, value]) => value)]);
      const changed = required(result.rows[0]);
      await this.auditLineChanges(client, actor, quoteId, lineId, current, fields, randomUUID());
      return toQuoteLineDto(changed);
    }, 'Modification de la ligne de devis impossible.');
  }

  removeLine(tenantId: TenantId, quoteId: string, lineId: string, actor: UserId): Promise<void> {
    return this.write(tenantId, actor, async (client) => {
      await this.requireDraftQuote(client, tenantId, quoteId);
      const selected = await client.query<QuoteLineRow>(
        'select * from public.commercial_quote_lines where quote_id=$1 and id=$2 for update', [quoteId, lineId],
      );
      const removed = selected.rows[0];
      if (removed === undefined) throw new QuoteLineNotFoundError();
      const changeSet = randomUUID();
      await client.query('delete from public.commercial_quote_lines where id=$1', [lineId]);
      const shifted = await client.query<QuoteLineRow>(`
        update public.commercial_quote_lines set position=position-1
         where quote_id=$1 and position>$2 returning *
      `, [quoteId, removed['position']]);
      await this.insertLineAudit(client, actor, quoteId, lineId, changeSet, 'removed', null, null, null, removed);
      for (const row of shifted.rows) {
        await this.insertLineAudit(client, actor, quoteId, row.id, changeSet, 'reordered', 'position',
          String(Number(row['position']) + 1), String(row['position']), null);
      }
    }, 'Suppression de la ligne de devis impossible.');
  }

  reorderLines(
    tenantId: TenantId,
    quoteId: string,
    actor: UserId,
    lineIds: readonly string[],
  ): Promise<QuoteDetailDto> {
    return this.write(tenantId, actor, async (client) => {
      await this.requireDraftQuote(client, tenantId, quoteId);
      const current = await client.query<QuoteLineRow>(
        'select * from public.commercial_quote_lines where quote_id=$1 order by position for update', [quoteId],
      );
      if (lineIds.length !== current.rows.length || new Set(lineIds).size !== lineIds.length ||
          current.rows.some((row) => !lineIds.includes(row.id))) {
        throw new QuoteLinePositionsMismatchError();
      }
      await client.query('set constraints commercial_quote_lines_quote_position_unique deferred');
      const oldPositions = new Map(current.rows.map((row) => [row.id, Number(row['position'])]));
      const changed = await client.query<QuoteLineRow>(`
        update public.commercial_quote_lines line set position=numbered.position
          from unnest($2::uuid[]) with ordinality ordered(id, ordinal)
          cross join lateral (select (ordered.ordinal-1)::integer as position) numbered
         where line.quote_id=$1 and line.id=ordered.id and line.position<>numbered.position
         returning line.*
      `, [quoteId, lineIds]);
      const changeSet = randomUUID();
      for (const row of changed.rows) {
        await this.insertLineAudit(client, actor, quoteId, row.id, changeSet, 'reordered', 'position',
          String(oldPositions.get(row.id)), String(row['position']), null);
      }
      return required(await this.selectDetail(client, tenantId, quoteId));
    }, 'Réordonnancement des lignes impossible.');
  }

  listLineAuditEntries(tenantId: TenantId, params: ListQuoteLineAuditParams): Promise<ListQuoteLineAuditResult> {
    return this.transactions.run({ tenantId }, async (client) => {
      const values: unknown[] = [params.quoteId];
      const filters = ['quote_id=$1'];
      if (params.lineId !== null) { values.push(params.lineId); filters.push(`quote_line_id=$${values.length}`); }
      if (params.cursor !== null) {
        values.push(params.cursor.sort, params.cursor.id);
        filters.push(`(occurred_at,id)<($${values.length - 1}::timestamptz,$${values.length}::uuid)`);
      }
      values.push(params.size + 1);
      const result = await client.query<AuditRow>(`
        select * from public.commercial_quote_line_audit where ${filters.join(' and ')}
         order by occurred_at desc,id desc limit $${values.length}
      `, values);
      return { rows: result.rows.map(toLineAuditRow) };
    });
  }

  actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean> {
    return this.transactions.run({ tenantId, userId: actorId }, async (client) => {
      const result = await client.query<{ allowed: boolean }>(
        'select magrit.actor_has_capability($1,$2) as allowed', [tenantId, capability],
      );
      return result.rows[0]?.allowed === true;
    });
  }

  private async selectQuote(client: PoolClient, tenantId: TenantId, quoteId: string): Promise<QuoteDto | null> {
    const [result, taxRegime] = await Promise.all([
      client.query<QuoteWithSubtotalRow>(`
        select quote.*,coalesce(sum(line.sale_price),0)::numeric(12,2) as lines_subtotal
          from public.commercial_quotes quote
          left join public.commercial_quote_lines line on line.quote_id=quote.id
         where quote.tenant_id=$1 and quote.id=$2 group by quote.id
      `, [tenantId, quoteId]),
      this.selectTaxRegime(client, tenantId),
    ]);
    const row = result.rows[0];
    return row === undefined ? null : toQuoteDto(row, money(row.lines_subtotal), taxRegime);
  }

  private async selectDetail(client: PoolClient, tenantId: TenantId, quoteId: string): Promise<QuoteDetailDto | null> {
    const quote = await this.selectQuote(client, tenantId, quoteId);
    if (quote === null) return null;
    const lines = await client.query<QuoteLineRow>(
      'select * from public.commercial_quote_lines where quote_id=$1 order by position', [quoteId],
    );
    return { ...quote, lines: lines.rows.map(toQuoteLineDto) };
  }

  private async selectTaxRegime(client: PoolClient, tenantId: TenantId): Promise<TaxRegimeDto> {
    const result = await client.query<{ tax_regime: unknown }>('select tax_regime from public.tenants where id=$1', [tenantId]);
    const value = result.rows[0]?.tax_regime;
    return isTaxRegime(value) ? value : DEFAULT_TAX_REGIME;
  }

  private async nextNumber(client: PoolClient, tenantId: TenantId): Promise<{ number: string }> {
    const result = await client.query<{ year: number; last_value: number }>(`
      insert into public.commercial_quote_number_counters (tenant_id,year,last_value)
      values ($1,extract(year from timezone('utc',clock_timestamp()))::integer,1)
      on conflict (tenant_id,year) do update set last_value=public.commercial_quote_number_counters.last_value+1
      returning year,last_value
    `, [tenantId]);
    const row = required(result.rows[0]);
    return { number: `DEV-${row.year}-${String(row.last_value).padStart(5, '0')}` };
  }

  private async lockQuote(client: PoolClient, tenantId: TenantId, quoteId: string): Promise<QuoteRow | null> {
    const result = await client.query<QuoteRow>(
      'select * from public.commercial_quotes where tenant_id=$1 and id=$2 for update', [tenantId, quoteId],
    );
    return result.rows[0] ?? null;
  }

  private async requireDraftQuote(client: PoolClient, tenantId: TenantId, quoteId: string): Promise<QuoteRow> {
    const quote = await this.lockQuote(client, tenantId, quoteId);
    if (quote === null) throw new QuoteNotFoundError();
    if (quote['status'] !== 'draft') throw new QuoteLineQuoteNotDraftError();
    return quote;
  }

  private async auditAddedLines(
    client: PoolClient, actor: UserId, quoteId: string, lines: readonly QuoteLineRow[], changeSet: string,
  ): Promise<void> {
    for (const line of lines) {
      await this.insertLineAudit(client, actor, quoteId, line.id, changeSet, 'added', null, null, null, line);
    }
  }

  private async auditLineChanges(
    client: PoolClient, actor: UserId, quoteId: string, lineId: string,
    before: QuoteLineRow, fields: readonly [string, unknown][], changeSet: string,
  ): Promise<void> {
    const auditable = new Set(['sale_price', 'discount_rate', 'margin_variation', 'quantity', 'position']);
    for (const [field, value] of fields) {
      if (!auditable.has(field) || sameDatabaseValue(before[field], value)) continue;
      await this.insertLineAudit(client, actor, quoteId, lineId, changeSet, 'updated', field,
        databaseText(before[field]), databaseText(value), null);
    }
  }

  private async auditHeaderChanges(
    client: PoolClient, actor: UserId, quoteId: string, before: QuoteRow,
    fields: readonly [string, unknown][], changeSet: string,
  ): Promise<void> {
    const auditable = new Set(['global_discount_rate', 'target_net_total', 'vat_rate', 'show_discounts', 'valid_until']);
    for (const [field, value] of fields) {
      if (!auditable.has(field) || sameDatabaseValue(before[field], value)) continue;
      await this.insertHeaderAudit(client, actor, quoteId, changeSet, 'updated', field,
        databaseText(before[field]), databaseText(value), null);
    }
  }

  private async insertLineAudit(
    client: PoolClient, actor: UserId, quoteId: string, lineId: string, changeSet: string,
    action: string, field: string | null, previous: string | null, next: string | null,
    snapshot: Record<string, unknown> | null,
  ): Promise<void> {
    await client.query(`
      insert into public.commercial_quote_line_audit (
        quote_id,quote_line_id,change_set_id,action,field,previous_value,new_value,line_snapshot,actor_id,actor_label
      ) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,
        (select email_normalized from public.app_users where id=$9))
    `, [quoteId,lineId,changeSet,action,field,previous,next,snapshot === null ? null : JSON.stringify(snapshot),actor]);
  }

  private async insertHeaderAudit(
    client: PoolClient, actor: UserId, quoteId: string, changeSet: string,
    action: string, field: string | null, previous: string | null, next: string | null,
    snapshot: Record<string, unknown> | null,
  ): Promise<void> {
    await client.query(`
      insert into public.commercial_quote_header_audit (
        quote_id,change_set_id,action,field,previous_value,new_value,quote_snapshot,actor_id,actor_label
      ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,
        (select email_normalized from public.app_users where id=$8))
    `, [quoteId,changeSet,action,field,previous,next,snapshot === null ? null : JSON.stringify(snapshot),actor]);
  }

  private write<T>(
    tenantId: TenantId,
    actor: UserId | undefined,
    operation: (client: PoolClient) => Promise<T>,
    fallback: string,
  ): Promise<T> {
    return this.transactions.run({ tenantId, ...(actor === undefined ? {} : { userId: actor }) }, async (client) => {
      try { return await operation(client); } catch (error) { throw mapError(error, fallback); }
    });
  }
}

function add(fields: Array<[string, unknown]>, column: string, value: unknown): void {
  if (value !== undefined) fields.push([column, value]);
}
function required<T>(value: T | undefined | null): T {
  if (value == null) throw new Error('Ligne PostgreSQL absente.');
  return value;
}
function invalidItems(message: string): QuoteCommandRejectedError {
  return new QuoteCommandRejectedError('quote.items_invalid', message, [
    { field: 'item_ids', message: 'Un ou plusieurs éléments ne correspondent pas à ce projet.' },
  ]);
}
function dateOnly(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}
function databaseText(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
function sameDatabaseValue(left: unknown, right: unknown): boolean {
  return databaseText(left) === databaseText(right);
}
function money(value: unknown): string {
  const normalized = typeof value === 'string' ? value : typeof value === 'number' ? value.toFixed(2) : '0.00';
  return formatCentsToMoneyNonNegative(parseMoneyNonNegativeToCents(normalized));
}
function rate(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? value.toFixed(4) : '0.0000';
}
function nullableNumeric(value: unknown, decimals: 2 | 4): string | null {
  if (value == null) return null;
  return typeof value === 'string' ? value : typeof value === 'number' ? value.toFixed(decimals) : null;
}
function isTaxRegime(value: unknown): value is TaxRegimeDto {
  return value === 'metropole_fr' || value === 'dom_tom' || value === 'franchise_tva' ||
    value === 'export_eu' || value === 'export_world';
}

function toQuoteDto(row: QuoteRow, linesSubtotal: string, tenantTaxRegime: TaxRegimeDto): QuoteDto {
  const globalDiscountRate = nullableNumeric(row['global_discount_rate'], 4);
  const targetNetTotal = nullableNumeric(row['target_net_total'], 2);
  const vatRate = nullableNumeric(row['vat_rate'], 4);
  const validUntil = dateOnly(row['valid_until'] as string | Date | null);
  return {
    id: row.id, tenant_id: row.tenant_id, customer_id: row.customer_id, project_id: row.project_id,
    source_quote_id: row['source_quote_id'] as string | null, number: String(row['number']),
    status: row['status'] as QuoteDto['status'], valid_until: validUntil,
    show_discounts: Boolean(row['show_discounts']), global_discount_rate: globalDiscountRate,
    target_net_total: targetNetTotal, vat_rate: vatRate,
    totals: computeQuoteTotals({ linesSubtotal, globalDiscountRate, targetNetTotal,
      quoteVatRateOverride: vatRate, tenantTaxRegime }),
    warnings: [...computeQuoteWarnings({ validUntil, now: new Date() })],
    sent_at: toIsoTimestampOrNull(row['sent_at'] as Date | null),
    last_sent_at: toIsoTimestampOrNull(row['last_sent_at'] as Date | null),
    sent_by: row['sent_by'] as string | null, decided_at: toIsoTimestampOrNull(row['decided_at'] as Date | null),
    decided_by_account_id: row['decided_by_account_id'] as string | null,
    converted_at: toIsoTimestampOrNull(row['converted_at'] as Date | null),
    created_by: row['created_by'] as string | null,
    created_at: toIsoTimestamp(row.created_at), updated_at: toIsoTimestamp(row.updated_at),
  };
}

function toQuoteLineDto(row: QuoteLineRow): QuoteLineDto {
  const quantity = Number(row['quantity']);
  const chiffrageQuantity = row['chiffrage_quantity'] == null ? null : Number(row['chiffrage_quantity']);
  const productionPrice = money(row['production_price']);
  const salePrice = money(row['sale_price']);
  return {
    id: row.id, quote_id: row.quote_id, origin: row['origin'] as QuoteLineDto['origin'],
    project_item_id: row['project_item_id'] as string | null, label: String(row['label']),
    description_html: row['description_html'] as string | null,
    product_config: (row['product_config'] ?? {}) as Record<string, unknown>, quantity,
    position: Number(row['position']), production_price: productionPrice,
    public_price: money(row['public_price']), customer_price: money(row['customer_price']),
    applied_margin_rate: rate(row['applied_margin_rate']), applied_rule_id: row['applied_rule_id'] as string | null,
    sale_price: salePrice, sale_margin_rate: row['sale_margin_rate'] == null ? null : rate(row['sale_margin_rate']),
    discount_rate: row['discount_rate'] == null ? null : rate(row['discount_rate']),
    margin_variation: row['margin_variation'] == null ? null : rate(row['margin_variation']),
    breakdown: Array.isArray(row['breakdown']) ? row['breakdown'] as QuoteLineDto['breakdown'] : [],
    warnings: computeQuoteLineWarnings({ origin: row['origin'] as 'project_item' | 'free', quantity,
      chiffrageQuantity, salePrice, productionPrice }),
    created_at: toIsoTimestamp(row.created_at),
  };
}

function toHeaderAuditDto(row: AuditRow): QuoteAuditEntryDto {
  return {
    id: row.id, quote_id: String(row['quote_id']), change_set_id: String(row['change_set_id']),
    action: row['action'] as QuoteAuditEntryDto['action'], field: row['field'] as QuoteAuditEntryDto['field'],
    previous_value: row['previous_value'] as string | null, new_value: row['new_value'] as string | null,
    quote_snapshot: row['quote_snapshot'] as Record<string, unknown> | null,
    actor_id: row['actor_id'] as string | null, actor_label: row['actor_label'] as string | null,
    occurred_at: toIsoTimestamp(row.occurred_at),
  };
}

function toLineAuditRow(row: AuditRow): ListQuoteLineAuditResult['rows'][number] {
  return {
    id: row.id, quote_id: String(row['quote_id']), quote_line_id: String(row['quote_line_id']),
    change_set_id: String(row['change_set_id']), action: row['action'] as 'added' | 'updated' | 'removed' | 'reordered',
    field: row['field'] as 'sale_price' | 'discount_rate' | 'margin_variation' | 'quantity' | 'position' | null,
    previous_value: row['previous_value'] as string | null, new_value: row['new_value'] as string | null,
    line_snapshot: row['line_snapshot'] as Record<string, unknown> | null,
    actor_id: row['actor_id'] as string | null, actor_label: row['actor_label'] as string | null,
    occurred_at: toIsoTimestamp(row.occurred_at),
  };
}

function mapError(error: unknown, fallback: string): Error {
  if (error instanceof QuoteCommandRejectedError || error instanceof QuoteDeleteRequiresDraftError ||
      error instanceof QuoteLineNotFoundError || error instanceof QuoteLinePositionsMismatchError ||
      error instanceof QuoteLineQuoteNotDraftError || error instanceof QuoteNotFoundError ||
      error instanceof QuoteProjectNotFoundError || error instanceof QuoteResendImmutableError ||
      error instanceof QuoteSendForbiddenStatusError || error instanceof QuoteSendRequiresLinesError ||
      error instanceof QuoteUpdateRequiresDraftError) return error;
  const value = error as { code?: string; constraint?: string; message?: string };
  if (value.message?.includes('quote_line.quote_not_draft')) return new QuoteLineQuoteNotDraftError();
  if (value.code === '23514' || value.code === '22P02') {
    return new QuoteCommandRejectedError('api.validation_failed', value.message ?? fallback);
  }
  return error instanceof Error ? error : new Error(fallback);
}
