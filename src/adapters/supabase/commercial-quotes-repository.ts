/**
 * Implementation Supabase du referentiel Devis commerciaux (story E10.3).
 *
 * Le tenant est toujours passe explicitement par l appelant (route), jamais
 * lu depuis la session Supabase : c est le principal deja resolu par la
 * facade (CA4) qui fait foi.
 *
 * La creation (`createFromProjectItems`) delegue ENTIEREMENT a la fonction
 * Postgres `api_create_commercial_quote_from_project_items` (`security
 * definer`, migration 20260901000600) : numerotation, insertion du devis et
 * de ses lignes y sont FAITES DANS LA MEME TRANSACTION cote base. Aucune
 * tentative de recomposer cette atomicite en plusieurs appels PostgREST
 * successifs ici — ce serait exactement le trou de sequence / devis orphelin
 * que la story interdit.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
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
  QuoteNotFoundError,
  QuoteProjectNotFoundError,
  type CommercialQuotesRepository,
  type ListQuotesParams,
  type ListQuotesResult,
} from '../../modules/commercial-quotes/application/commercial-quotes-repository.ts';

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
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toQuoteLineDto(row: Record<string, any>): QuoteLineDto {
  return {
    id: row.id,
    quote_id: row.quote_id,
    project_item_id: row.project_item_id,
    label: row.label,
    product_config: row.product_config ?? {},
    quantity: Number(row.quantity),
    position: Number(row.position),
    production_price: toMoneyString(row.production_price),
    public_price: row.public_price === null || row.public_price === undefined
      ? null
      : toMoneyString(row.public_price),
    customer_price: row.customer_price === null || row.customer_price === undefined
      ? null
      : toMoneyString(row.customer_price),
    applied_margin_rate:
      row.applied_margin_rate === null || row.applied_margin_rate === undefined
        ? null
        : toRateString(row.applied_margin_rate),
    applied_rule_id: row.applied_rule_id ?? null,
    breakdown: Array.isArray(row.breakdown) ? row.breakdown : [],
    created_at: row.created_at,
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
