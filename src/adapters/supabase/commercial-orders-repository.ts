/**
 * Implementation Supabase du referentiel Commandes de gestion commerciale
 * (story E10.12).
 *
 * Le tenant est toujours passe explicitement par l appelant (route), jamais
 * lu depuis la session Supabase — meme discipline que
 * `SupabaseCommercialQuotesRepository`.
 *
 * La CONVERSION (`convertQuote`) delegue ENTIEREMENT a la fonction Postgres
 * `api_convert_commercial_quote` (`security definer`, migration
 * 20260908010000) : transition atomique du devis, numerotation, copie figee
 * des lignes et des totaux, audit d entete sont FAITS DANS LA MEME
 * TRANSACTION cote base.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import { QuoteNotFoundError } from '../../modules/commercial-quotes/application/commercial-quotes-repository.ts';
import type { TaxRegimeDto } from '../../modules/commercial-quotes/api/contracts.ts';
import { ProductionStepNotFoundError } from '../../modules/production-steps/application/production-steps-repository.ts';
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
import {
  CommercialOrderNotFoundError,
  OrderStepUnchangedError,
  ProductionStepInactiveError,
  QuoteConversionForbiddenStatusError,
  type CommercialOrdersRepository,
  type ListCommercialOrdersParams,
  type ListCommercialOrdersResult,
  type ListOrderStepChangesParams,
  type ListOrderStepChangesResult,
} from '../../modules/commercial-orders/application/commercial-orders-repository.ts';
import { toIsoTimestamp, toIsoTimestampOrNull } from '../../modules/_shared/application/index.ts';

export class SupabaseCommercialOrdersRepository implements CommercialOrdersRepository {
  constructor(private readonly client: SupabaseClient<any>) {}

  async list(tenantId: TenantId, params: ListCommercialOrdersParams): Promise<ListCommercialOrdersResult> {
    if (params.sort === 'production_step' || params.sort === '-production_step') {
      return this.listByProductionStep(tenantId, params);
    }

    const ascending = params.sort === 'created_at';
    let query = this.client
      .from('commercial_orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending })
      .order('id', { ascending })
      .limit(params.size + 1);

    if (params.customerId) query = query.eq('customer_id', params.customerId);
    if (params.quoteId) query = query.eq('quote_id', params.quoteId);
    if (params.status) query = query.eq('status', params.status);
    if (params.currentProductionStepId) query = query.eq('current_production_step_id', params.currentProductionStepId);
    if (params.cursor) {
      const op = ascending ? 'gt' : 'lt';
      query = query.or(
        `created_at.${op}.${params.cursor.sort},and(created_at.eq.${params.cursor.sort},id.${op}.${params.cursor.id})`,
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { rows: (data ?? []).map(toCommercialOrderDto) };
  }

  /**
   * E10.13 CA6 — `sort=production_step|-production_step` : delegue a
   * `list_commercial_orders_by_production_step` (`security invoker`, migration
   * `20260908020000`), seule lecture capable d ordonner sur la POSITION d une
   * table jointe en LEFT JOIN avec les commandes SANS etape toujours en
   * dernier (PostgREST ne sait pas l exprimer, voir le commentaire de la
   * fonction SQL). `params.cursor.sort` porte
   * `${current_production_step_id ?? ''}|${created_at}` — DECODE ICI, jamais
   * par le port ni par la route (elles restent agnostiques du mecanisme de
   * lecture choisi pour ce tri).
   */
  private async listByProductionStep(
    tenantId: TenantId,
    params: ListCommercialOrdersParams,
  ): Promise<ListCommercialOrdersResult> {
    const descending = params.sort === '-production_step';
    let hasCursor = false;
    let cursorStepId: string | null = null;
    let cursorCreatedAt: string | null = null;
    let cursorId: string | null = null;

    if (params.cursor) {
      const separatorIndex = params.cursor.sort.lastIndexOf('|');
      if (separatorIndex === -1) throw new Error('Curseur production_step illisible.');
      const rawStepId = params.cursor.sort.slice(0, separatorIndex);
      cursorCreatedAt = params.cursor.sort.slice(separatorIndex + 1);
      cursorStepId = rawStepId.length > 0 ? rawStepId : null;
      cursorId = params.cursor.id;
      hasCursor = true;
    }

    const { data, error } = await this.client.rpc('list_commercial_orders_by_production_step', {
      p_tenant_id: tenantId,
      p_customer_id: params.customerId,
      p_quote_id: params.quoteId,
      p_status: params.status,
      p_current_production_step_id: params.currentProductionStepId,
      p_descending: descending,
      p_limit: params.size + 1,
      p_has_cursor: hasCursor,
      p_cursor_step_id: cursorStepId,
      p_cursor_created_at: cursorCreatedAt,
      p_cursor_id: cursorId,
    });
    if (error) throw new Error(error.message);
    return { rows: ((data ?? []) as Record<string, any>[]).map(toCommercialOrderDto) };
  }

  async findById(tenantId: TenantId, orderId: string): Promise<CommercialOrderDto | null> {
    const { data, error } = await this.client
      .from('commercial_orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toCommercialOrderDto(data) : null;
  }

  /**
   * E10.16 — relit la ligne `commercial_orders` DIRECTEMENT (plutot que de
   * deleguer a `findById()`) : `CommercialOrderDto` (forme de liste) ne
   * porte pas `customer_contact_id`/`expected_delivery_date` (decision du
   * contrat : ces deux champs ne vivent QUE sur `CommercialOrderDetail`),
   * il faut donc la ligne brute pour les lire.
   */
  async findDetailById(tenantId: TenantId, orderId: string): Promise<CommercialOrderDetailDto | null> {
    const { data: orderRow, error: orderError } = await this.client
      .from('commercial_orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', orderId)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!orderRow) return null;

    const { data, error } = await this.client
      .from('commercial_order_lines')
      .select('*')
      .eq('order_id', orderId)
      .order('position', { ascending: true });
    if (error) throw new Error(error.message);

    return {
      ...toCommercialOrderDto(orderRow),
      // E10.16 — pointeurs propres au detail, absents de la forme abregee.
      customer_contact_id: orderRow.customer_contact_id ?? null,
      expected_delivery_date: orderRow.expected_delivery_date ?? null,
      lines: (data ?? []).map(toCommercialOrderLineDto),
    };
  }

  async convertQuote(tenantId: TenantId, actor: UserId, quoteId: string): Promise<CommercialOrderDetailDto> {
    void actor; // trace : l auteur est porte par la fonction (auth.uid()), pas par ce parametre.
    const { data, error } = await this.client.rpc('api_convert_commercial_quote', {
      p_tenant_id: tenantId,
      p_quote_id: quoteId,
    });
    if (error) throw mapQuoteConversionError(error.message);

    const orderId = data as string;
    const detail = await this.findDetailById(tenantId, orderId);
    if (!detail) {
      // Ne devrait jamais arriver : la fonction vient de creer cette ligne
      // dans la meme transaction que celle qui a commis avant ce SELECT.
      throw new Error('La commande creee est introuvable juste apres sa creation.');
    }
    return detail;
  }

  /**
   * E10.14 — journal ANTICHRONOLOGIQUE (`occurred_at desc, id desc`, seul
   * ordre publie par le contrat). La RLS de `commercial_order_step_changes`
   * (jointure sur `commercial_orders.tenant_id`) isole deja le tenant ; ce
   * filtre reste explicite sur `order_id` uniquement — l existence de la
   * commande dans le tenant est verifiee EN AMONT par le SERVICE
   * (`getSummary()`), avant d atteindre cette lecture.
   */
  async listStepChanges(
    tenantId: TenantId,
    orderId: string,
    params: ListOrderStepChangesParams,
  ): Promise<ListOrderStepChangesResult> {
    void tenantId;
    let query = this.client
      .from('commercial_order_step_changes')
      .select('*')
      .eq('order_id', orderId)
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(params.size + 1);

    if (params.cursor) {
      query = query.or(
        `occurred_at.lt.${params.cursor.sort},and(occurred_at.eq.${params.cursor.sort},id.lt.${params.cursor.id})`,
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { rows: (data ?? []).map(toOrderStepChangeDto) };
  }

  /**
   * `security definer` (`api_change_commercial_order_production_step`,
   * migration 20260909000000) : verrouille la commande, valide l etape
   * cible, met a jour `current_production_step_id` ET insere l entree de
   * journal, dans la MEME transaction (contrat, decision #4). `p_actor_label`
   * n est fourni QUE pour une cle de service (`serviceActorLabel`) — pour un
   * jeton utilisateur, la fonction resout l e-mail elle-meme depuis
   * `auth.uid()` (contrat §3 point 1).
   */
  async changeProductionStep(
    tenantId: TenantId,
    orderId: string,
    actor: UserId | null,
    command: ChangeOrderProductionStepCommand,
    serviceActorLabel: string | null,
  ): Promise<OrderStepChangeDto> {
    void actor; // trace : l auteur est porte par la fonction (auth.uid()), pas par ce parametre — meme discipline que convertQuote.
    const { data, error } = await this.client.rpc('api_change_commercial_order_production_step', {
      p_tenant_id: tenantId,
      p_order_id: orderId,
      p_step_id: command.step_id,
      p_note: command.note ?? null,
      p_actor_label: serviceActorLabel,
    });
    if (error) throw mapChangeProductionStepError(error.message);

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('La transition n a rendu aucune entree de journal.');
    return toOrderStepChangeDto(row as Record<string, any>);
  }
}

function isTaxRegime(value: unknown): value is TaxRegimeDto {
  return (
    value === 'metropole_fr' ||
    value === 'dom_tom' ||
    value === 'franchise_tva' ||
    value === 'export_eu' ||
    value === 'export_world'
  );
}

/** `numeric(12,2)` : PostgREST rend un nombre ou une chaine selon le driver, normalise en Money. */
function toMoneyString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toFixed(2);
  return '0.00';
}

/** `numeric(6,4)` nullable : meme normalisation, a 4 decimales. */
function toNullableRateString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toFixed(4);
  return null;
}

function toCommercialOrderTotalsDto(row: Record<string, any>): CommercialOrderTotalsDto {
  return {
    lines_subtotal: toMoneyString(row.lines_subtotal),
    global_discount: toMoneyString(row.global_discount),
    effective_discount_rate: toNullableRateString(row.effective_discount_rate),
    net_total: toMoneyString(row.net_total),
    vat_rate: toNullableRateString(row.vat_rate) ?? '0.0000',
    vat_regime: isTaxRegime(row.vat_regime) ? row.vat_regime : null,
    vat_amount: toMoneyString(row.vat_amount),
    total_incl_tax: toMoneyString(row.total_incl_tax),
  };
}

function toCommercialOrderDto(row: Record<string, any>): CommercialOrderDto {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    customer_id: row.customer_id,
    quote_id: row.quote_id,
    number: row.number,
    status: row.status as CommercialOrderStatus,
    source_quote_status: row.source_quote_status as ConvertedFromStatus,
    current_production_step_id: row.current_production_step_id ?? null,
    totals: toCommercialOrderTotalsDto(row),
    created_by: row.created_by ?? null,
    created_at: toIsoTimestamp(row.created_at),
    updated_at: toIsoTimestamp(row.updated_at),
  };
}

function toCommercialOrderLineDto(row: Record<string, any>): CommercialOrderLineDto {
  return {
    id: row.id,
    order_id: row.order_id,
    source_quote_line_id: row.source_quote_line_id,
    origin: row.origin,
    label: row.label,
    product_config: row.product_config ?? {},
    quantity: Number(row.quantity),
    position: Number(row.position),
    production_price: toMoneyString(row.production_price),
    public_price: toMoneyString(row.public_price),
    customer_price: toMoneyString(row.customer_price),
    applied_margin_rate: toNullableRateString(row.applied_margin_rate) ?? '0.0000',
    applied_rule_id: row.applied_rule_id ?? null,
    sale_price: toMoneyString(row.sale_price),
    sale_margin_rate: toNullableRateString(row.sale_margin_rate),
    discount_rate: toNullableRateString(row.discount_rate),
    margin_variation: toNullableRateString(row.margin_variation),
    breakdown: Array.isArray(row.breakdown) ? row.breakdown : [],
    created_at: toIsoTimestamp(row.created_at),
  };
}

/** Traduit le message d exception de `api_convert_commercial_quote` en erreur de domaine. */
function mapQuoteConversionError(message: string): Error {
  if (message.includes('quote.conversion_forbidden_status')) {
    return new QuoteConversionForbiddenStatusError(message);
  }
  if (message.includes('quote.not_found')) {
    return new QuoteNotFoundError(message);
  }
  if (message.includes('permission_denied')) {
    return new Error(`permission_denied: ${message}`);
  }
  if (message.includes('authentication_required')) {
    return new Error(`authentication_required: ${message}`);
  }
  return new Error(`Conversion du devis impossible: ${message}`);
}

function toOrderStepChangeDto(row: Record<string, any>): OrderStepChangeDto {
  return {
    id: row.id,
    order_id: row.order_id,
    from_step_id: row.from_step_id ?? null,
    to_step_id: row.to_step_id,
    note: row.note ?? null,
    actor_id: row.actor_id ?? null,
    actor_label: row.actor_label ?? null,
    occurred_at: toIsoTimestampOrNull(row.occurred_at) ?? toIsoTimestamp(row.occurred_at),
  };
}

/**
 * Traduit le message d exception de
 * `api_change_commercial_order_production_step` en erreur de domaine.
 * L ORDRE des branches suit celui de la fonction SQL (verrou -> validations
 * -> transition) : `order.not_found` d abord (aucune commande a valider
 * derriere), les deux causes de `production_step.*` ensuite (jamais
 * confondues, decision #8 du contrat), `order.step_unchanged` enfin.
 */
function mapChangeProductionStepError(message: string): Error {
  if (message.includes('order.not_found')) {
    return new CommercialOrderNotFoundError(message);
  }
  if (message.includes('production_step.not_found')) {
    return new ProductionStepNotFoundError(message);
  }
  if (message.includes('production_step.inactive')) {
    return new ProductionStepInactiveError(message);
  }
  if (message.includes('order.step_unchanged')) {
    return new OrderStepUnchangedError(message);
  }
  if (message.includes('permission_denied')) {
    return new Error(`permission_denied: ${message}`);
  }
  if (message.includes('authentication_required')) {
    return new Error(`authentication_required: ${message}`);
  }
  return new Error(`Changement d etape de production impossible: ${message}`);
}
