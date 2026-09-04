/**
 * Implementation Supabase du referentiel Devis commerciaux (stories E10.3,
 * E10.9).
 *
 * Le tenant est toujours passe explicitement par l appelant (route), jamais
 * lu depuis la session Supabase : c est le principal deja resolu par la
 * facade (CA4) qui fait foi.
 *
 * La creation d un DEVIS (`createFromProjectItems`) delegue ENTIEREMENT a la
 * fonction Postgres `api_create_commercial_quote_from_project_items`
 * (`security definer`, migration 20260901000600) : numerotation, insertion du
 * devis et de ses lignes y sont FAITES DANS LA MEME TRANSACTION cote base.
 *
 * ── E10.9 — pourquoi `addLine`/`updateLine` sont de simples insert/update ──
 * Contrairement a `createFromProjectItems`, ces deux operations ne touchent
 * qu UNE ligne : aucune transaction multi-instructions n est necessaire, et
 * le PRIX est deja entierement calcule par le service
 * (`PriceRulesService.resolve()` + `PricingEngine.price()`, E10.21) — cet
 * adaptateur ne fait AUCUN calcul, il persiste des colonnes deja resolues
 * (`PricedQuoteLineWrite`/`QuoteLineWriteUpdate`).
 *
 * `removeLine`/`reorderLines`, eux, affectent PLUSIEURS lignes dans une seule
 * requete logique (resserrement des positions, reaffectation complete) :
 * ils delegue aux fonctions `security invoker`
 * `api_delete_commercial_quote_line`/`api_reorder_commercial_quote_lines`
 * (migration 20260904000100), qui partagent un `change_set_id` de
 * transaction pour l audit (CA5).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import { computeQuoteLineWarnings } from '../../modules/commercial-quotes/application/quote-line-pricing.ts';
import type {
  CreateQuoteFromProjectCommand,
  QuoteDetailDto,
  QuoteDto,
  QuoteLineDto,
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
  type CommercialQuotesRepository,
  type ListQuoteLineAuditParams,
  type ListQuoteLineAuditResult,
  type ListQuotesParams,
  type ListQuotesResult,
  type PricedQuoteLineWrite,
  type QuoteLineWriteUpdate,
} from '../../modules/commercial-quotes/application/commercial-quotes-repository.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';

const CHECK_VIOLATION = '23514';

export class SupabaseCommercialQuotesRepository implements CommercialQuotesRepository {
  constructor(private readonly client: SupabaseClient<any>) {}

  async list(tenantId: TenantId, params: ListQuotesParams): Promise<ListQuotesResult> {
    let query = this.client
      .from('commercial_quotes')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(params.size + 1);

    if (params.customerId) query = query.eq('customer_id', params.customerId);
    if (params.projectId) query = query.eq('project_id', params.projectId);
    if (params.status) query = query.eq('status', params.status);
    if (params.cursor) {
      query = query.or(
        `created_at.lt.${params.cursor.sort},and(created_at.eq.${params.cursor.sort},id.lt.${params.cursor.id})`,
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { rows: (data ?? []).map(toQuoteDto) };
  }

  async findById(tenantId: TenantId, quoteId: string): Promise<QuoteDto | null> {
    const { data, error } = await this.client
      .from('commercial_quotes')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', quoteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toQuoteDto(data) : null;
  }

  async findDetailById(tenantId: TenantId, quoteId: string): Promise<QuoteDetailDto | null> {
    const quote = await this.findById(tenantId, quoteId);
    if (!quote) return null;
    const { data, error } = await this.client
      .from('commercial_quote_lines')
      .select('*')
      .eq('quote_id', quoteId)
      .order('position', { ascending: true });
    if (error) throw new Error(error.message);
    return { ...quote, lines: (data ?? []).map(toQuoteLineDto) };
  }

  async createFromProjectItems(
    tenantId: TenantId,
    actor: UserId,
    command: CreateQuoteFromProjectCommand,
  ): Promise<QuoteDetailDto> {
    const { data, error } = await this.client.rpc('api_create_commercial_quote_from_project_items', {
      p_tenant_id: tenantId,
      p_project_id: command.project_id,
      p_item_ids: command.item_ids,
    });
    if (error) throw mapQuoteCommandError(error.message);
    void actor; // trace : created_by est porte par la fonction (auth.uid()), pas par ce parametre.

    const quoteId = data as string;
    const detail = await this.findDetailById(tenantId, quoteId);
    if (!detail) {
      // Ne devrait jamais arriver : la fonction vient de creer cette ligne
      // dans la meme transaction que celle qui a commis avant ce SELECT.
      throw new Error('Le devis cree est introuvable juste apres sa creation.');
    }
    return detail;
  }

  async update(tenantId: TenantId, quoteId: string, command: UpdateQuoteCommand): Promise<QuoteDto> {
    const patch: Record<string, unknown> = {};
    if ('valid_until' in command && command.valid_until !== undefined) {
      patch['valid_until'] = command.valid_until;
    }
    if ('show_discounts' in command && command.show_discounts !== undefined) {
      patch['show_discounts'] = command.show_discounts;
    }

    const { data, error } = await this.client
      .from('commercial_quotes')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', quoteId)
      .select()
      .maybeSingle();
    if (error) throw toDomainError(error, 'Modification du devis impossible.');
    if (!data) throw new QuoteNotFoundError();
    return toQuoteDto(data);
  }

  async remove(tenantId: TenantId, quoteId: string): Promise<void> {
    // CA6 — un devis ne se supprime qu a l etat brouillon : le filtre porte
    // directement la condition, pour distinguer "introuvable" (le service l
    // a deja verifie) de "trouve mais pas brouillon" par le NOMBRE de lignes
    // affectees, comme `markSiretVerified` (E10.4, m4) l a etabli comme motif
    // pour ce genre de condition d ecriture.
    const { data, error } = await this.client
      .from('commercial_quotes')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', quoteId)
      .eq('status', 'draft')
      .select('id');
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new QuoteDeleteRequiresDraftError();
  }

  // ---------------------------------------------------------------------------
  // E10.9 — lignes de devis.
  // ---------------------------------------------------------------------------

  async findLineById(tenantId: TenantId, quoteId: string, lineId: string): Promise<QuoteLineDto | null> {
    // Tenant verifie via le devis parent (RLS + jointure applicative, meme
    // discipline que `findDetailById`) : une ligne d un devis hors tenant ne
    // peut de toute facon pas etre atteinte, `quoteId` a deja ete valide en
    // amont par l appelant (service) via `findById`/`getSummary`.
    void tenantId;
    const { data, error } = await this.client
      .from('commercial_quote_lines')
      .select('*')
      .eq('quote_id', quoteId)
      .eq('id', lineId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toQuoteLineDto(data) : null;
  }

  async addLine(tenantId: TenantId, quoteId: string, line: PricedQuoteLineWrite): Promise<QuoteLineDto> {
    void tenantId;
    const { count, error: countError } = await this.client
      .from('commercial_quote_lines')
      .select('id', { count: 'exact', head: true })
      .eq('quote_id', quoteId);
    if (countError) throw new Error(countError.message);

    const { data, error } = await this.client
      .from('commercial_quote_lines')
      .insert({
        quote_id: quoteId,
        origin: line.origin,
        project_item_id: line.projectItemId,
        label: line.label,
        product_config: line.productConfig,
        quantity: line.quantity,
        chiffrage_quantity: line.chiffrageQuantity,
        position: count ?? 0,
        production_price: line.productionPrice,
        public_price: line.publicPrice,
        customer_price: line.customerPrice,
        applied_margin_rate: line.appliedMarginRate,
        applied_rule_id: line.appliedRuleId,
        sale_price: line.salePrice,
        sale_margin_rate: line.saleMarginRate,
        discount_rate: line.discountRate,
        margin_variation: line.marginVariation,
        breakdown: line.breakdown,
      })
      .select()
      .maybeSingle();
    if (error) throw mapQuoteLineWriteError(error.message);
    if (!data) throw new Error('La ligne ajoutee est introuvable juste apres son insertion.');
    return toQuoteLineDto(data);
  }

  async updateLine(
    tenantId: TenantId,
    quoteId: string,
    lineId: string,
    update: QuoteLineWriteUpdate,
  ): Promise<QuoteLineDto> {
    void tenantId;
    const patch: Record<string, unknown> = {};
    if (update.quantity !== undefined) patch['quantity'] = update.quantity;
    if (update.salePrice !== undefined) patch['sale_price'] = update.salePrice;
    if (update.saleMarginRate !== undefined) patch['sale_margin_rate'] = update.saleMarginRate;
    if (update.discountRate !== undefined) patch['discount_rate'] = update.discountRate;
    if (update.marginVariation !== undefined) patch['margin_variation'] = update.marginVariation;

    const { data, error } = await this.client
      .from('commercial_quote_lines')
      .update(patch)
      .eq('quote_id', quoteId)
      .eq('id', lineId)
      .select()
      .maybeSingle();
    if (error) throw mapQuoteLineWriteError(error.message);
    if (!data) throw new QuoteLineNotFoundError();
    return toQuoteLineDto(data);
  }

  async removeLine(tenantId: TenantId, quoteId: string, lineId: string): Promise<void> {
    const { error } = await this.client.rpc('api_delete_commercial_quote_line', {
      p_tenant_id: tenantId,
      p_quote_id: quoteId,
      p_line_id: lineId,
    });
    if (error) throw mapQuoteLineWriteError(error.message);
  }

  async reorderLines(
    tenantId: TenantId,
    quoteId: string,
    lineIds: readonly string[],
  ): Promise<QuoteDetailDto> {
    const { error } = await this.client.rpc('api_reorder_commercial_quote_lines', {
      p_tenant_id: tenantId,
      p_quote_id: quoteId,
      p_line_ids: [...lineIds],
    });
    if (error) throw mapQuoteLineWriteError(error.message);

    const detail = await this.findDetailById(tenantId, quoteId);
    if (!detail) throw new QuoteNotFoundError();
    return detail;
  }

  async listLineAuditEntries(
    tenantId: TenantId,
    params: ListQuoteLineAuditParams,
  ): Promise<ListQuoteLineAuditResult> {
    void tenantId; // `quoteId` deja verifie appartenir au tenant par l appelant (service).
    let query = this.client
      .from('commercial_quote_line_audit')
      .select('*')
      .eq('quote_id', params.quoteId)
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(params.size + 1);

    if (params.lineId) query = query.eq('quote_line_id', params.lineId);
    if (params.cursor) {
      query = query.or(
        `occurred_at.lt.${params.cursor.sort},and(occurred_at.eq.${params.cursor.sort},id.lt.${params.cursor.id})`,
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return {
      rows: (data ?? []).map((row: Record<string, any>) => ({
        id: row.id,
        quote_id: row.quote_id,
        quote_line_id: row.quote_line_id,
        change_set_id: row.change_set_id,
        action: row.action,
        field: row.field ?? null,
        previous_value: row.previous_value ?? null,
        new_value: row.new_value ?? null,
        line_snapshot: row.line_snapshot ?? null,
        actor_id: row.actor_id ?? null,
        actor_label: row.actor_label ?? null,
        occurred_at: toIsoTimestamp(row.occurred_at),
      })),
    };
  }

  async findActorTenantRole(tenantId: TenantId, actorId: UserId): Promise<'admin' | 'member' | null> {
    const { data, error } = await this.client
      .from('tenant_members')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', actorId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const role = data?.role;
    return role === 'admin' || role === 'member' ? role : null;
  }
}

function toQuoteDto(row: Record<string, any>): QuoteDto {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    customer_id: row.customer_id,
    project_id: row.project_id,
    number: row.number,
    status: row.status,
    valid_until: row.valid_until ?? null,
    show_discounts: Boolean(row.show_discounts),
    created_by: row.created_by ?? null,
    created_at: toIsoTimestamp(row.created_at),
    updated_at: toIsoTimestamp(row.updated_at),
  };
}

function toQuoteLineDto(row: Record<string, any>): QuoteLineDto {
  const quantity = Number(row.quantity);
  const chiffrageQuantity =
    row.chiffrage_quantity === null || row.chiffrage_quantity === undefined
      ? null
      : Number(row.chiffrage_quantity);
  const salePrice = toMoneyString(row.sale_price);
  const productionPrice = toMoneyString(row.production_price);

  return {
    id: row.id,
    quote_id: row.quote_id,
    origin: row.origin,
    project_item_id: row.project_item_id ?? null,
    label: row.label,
    product_config: row.product_config ?? {},
    quantity,
    position: Number(row.position),
    production_price: productionPrice,
    public_price: toMoneyString(row.public_price),
    customer_price: toMoneyString(row.customer_price),
    applied_margin_rate: toRateString(row.applied_margin_rate),
    applied_rule_id: row.applied_rule_id ?? null,
    sale_price: salePrice,
    sale_margin_rate: row.sale_margin_rate === null || row.sale_margin_rate === undefined
      ? null
      : toRateString(row.sale_margin_rate),
    discount_rate: row.discount_rate === null || row.discount_rate === undefined
      ? null
      : toRateString(row.discount_rate),
    margin_variation: row.margin_variation === null || row.margin_variation === undefined
      ? null
      : toRateString(row.margin_variation),
    breakdown: Array.isArray(row.breakdown) ? row.breakdown : [],
    warnings: computeQuoteLineWarnings({
      origin: row.origin,
      quantity,
      chiffrageQuantity,
      salePrice,
      productionPrice,
    }),
    created_at: toIsoTimestamp(row.created_at),
  };
}

/** `numeric(12,2)` PostgREST rend un nombre ou une chaine selon le driver : normalise en Money. */
function toMoneyString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toFixed(2);
  return '0.00';
}

/** `numeric(6,4)` : meme normalisation que `toMoneyString`, a 4 decimales. */
function toRateString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toFixed(4);
  return '0.0000';
}

/** Traduit le message d exception de la fonction PL/pgSQL en erreur de domaine. */
function mapQuoteCommandError(message: string): Error {
  if (message.includes('project_not_found')) {
    return new QuoteProjectNotFoundError();
  }
  if (message.includes('invalid_item_ids')) {
    return new QuoteCommandRejectedError(
      'quote.items_invalid',
      message,
      [{ field: 'item_ids', message: 'Un ou plusieurs elements ne correspondent pas a ce projet.' }],
    );
  }
  if (message.includes('permission_denied')) {
    return new QuoteCommandRejectedError('quote.permission_denied', message);
  }
  if (message.includes('authentication_required')) {
    return new QuoteCommandRejectedError('quote.authentication_required', message);
  }
  return new Error(`Création du devis impossible: ${message}`);
}

/** Traduit le message d exception des ecritures de LIGNE (trigger, RPC) en erreur de domaine (E10.9). */
function mapQuoteLineWriteError(message: string): Error {
  if (message.includes('quote_line.quote_not_draft')) {
    return new QuoteLineQuoteNotDraftError(message);
  }
  if (message.includes('quote_line.positions_mismatch')) {
    return new QuoteLinePositionsMismatchError(message);
  }
  if (message.includes('quote_line.not_found')) {
    return new QuoteLineNotFoundError(message);
  }
  return new Error(`Ecriture de ligne de devis impossible: ${message}`);
}

/** Traduit les erreurs Postgres generiques (PATCH) en erreurs de domaine du module. */
function toDomainError(
  error: { code?: string; message: string; details?: string | null } | null,
  fallback: string,
): Error {
  if (error?.code === CHECK_VIOLATION) {
    return new QuoteCommandRejectedError('api.validation_failed', error.message ?? fallback);
  }
  return new Error(error?.message ?? fallback);
}
