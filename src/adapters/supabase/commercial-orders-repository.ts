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
import type {
  CommercialOrderDetailDto,
  CommercialOrderDto,
  CommercialOrderLineDto,
  CommercialOrderStatus,
  CommercialOrderTotalsDto,
  ConvertedFromStatus,
} from '../../modules/commercial-orders/api/contracts.ts';
import {
  QuoteConversionForbiddenStatusError,
  type CommercialOrdersRepository,
  type ListCommercialOrdersParams,
  type ListCommercialOrdersResult,
} from '../../modules/commercial-orders/application/commercial-orders-repository.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';

export class SupabaseCommercialOrdersRepository implements CommercialOrdersRepository {
  constructor(private readonly client: SupabaseClient<any>) {}

  async list(tenantId: TenantId, params: ListCommercialOrdersParams): Promise<ListCommercialOrdersResult> {
    let query = this.client
      .from('commercial_orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(params.size + 1);

    if (params.customerId) query = query.eq('customer_id', params.customerId);
    if (params.quoteId) query = query.eq('quote_id', params.quoteId);
    if (params.status) query = query.eq('status', params.status);
    if (params.cursor) {
      query = query.or(
        `created_at.lt.${params.cursor.sort},and(created_at.eq.${params.cursor.sort},id.lt.${params.cursor.id})`,
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { rows: (data ?? []).map(toCommercialOrderDto) };
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

  async findDetailById(tenantId: TenantId, orderId: string): Promise<CommercialOrderDetailDto | null> {
    const order = await this.findById(tenantId, orderId);
    if (!order) return null;
    const { data, error } = await this.client
      .from('commercial_order_lines')
      .select('*')
      .eq('order_id', orderId)
      .order('position', { ascending: true });
    if (error) throw new Error(error.message);
    return { ...order, lines: (data ?? []).map(toCommercialOrderLineDto) };
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
