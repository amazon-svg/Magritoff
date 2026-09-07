/**
 * Implementation Supabase du module Devis du portail client (stories
 * E10.10b-1, E10.10b-2).
 *
 * Pur relai vers `api_list_storefront_quotes`/`api_get_storefront_quote`
 * (migration 20260906170000, renforcee 20260907000000) et
 * `api_decide_storefront_quote` (migration 20260907000000) : ce fichier ne
 * fait AUCUN calcul et n applique AUCUN filtrage de securite ni AUCUNE garde
 * de decision — tout est deja fait par la fonction SQL avant que la ligne
 * n atteigne ce mapping. Il normalise seulement la forme des valeurs
 * (numeric -> Money/Rate string, timestamptz -> Timestamp ISO, cf.
 * `.claude/rules/api.md`) et traduit les exceptions PL/pgSQL prefixees en
 * erreurs de domaine (meme patron que
 * `src/adapters/supabase/commercial-quotes-repository.ts`,
 * `mapQuoteSendError`).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { toIsoTimestamp } from '../../modules/_shared/application/timestamps.ts';
import type {
  StorefrontQuoteDecision,
  StorefrontQuoteDetailDto,
  StorefrontQuoteDto,
  StorefrontQuoteLineDto,
  StorefrontQuoteStatus,
  StorefrontQuoteTotalsDto,
  StorefrontTaxRegime,
} from '../../modules/storefront-quotes/api/contracts.ts';
import {
  StorefrontQuoteDecisionExpiredError,
  StorefrontQuoteDecisionForbiddenDelegatedError,
  StorefrontQuoteDecisionForbiddenStatusError,
  type ListStorefrontQuotesCriteria,
  type StorefrontQuoteDecisionResult,
  type StorefrontQuotesRepository,
} from '../../modules/storefront-quotes/application/storefront-quotes-repository.ts';
import type { Database } from '../../types/database.types.ts';

export class SupabaseStorefrontQuotesRepository implements StorefrontQuotesRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async list(
    sessionToken: string,
    criteria: ListStorefrontQuotesCriteria,
  ): Promise<readonly StorefrontQuoteDto[]> {
    const { data, error } = await this.client.rpc('api_list_storefront_quotes', {
      p_opaque_token: sessionToken,
      p_status: criteria.status,
      p_limit: criteria.limit,
      p_cursor_issued_at: criteria.cursor?.sort ?? null,
      p_cursor_id: criteria.cursor?.id ?? null,
    });
    if (error) throw new Error(`api_list_storefront_quotes: ${error.message}`);

    return (data ?? []).map((row) => toStorefrontQuoteDto(row as Record<string, unknown>));
  }

  async findById(sessionToken: string, quoteId: string): Promise<StorefrontQuoteDetailDto | null> {
    const { data, error } = await this.client.rpc('api_get_storefront_quote', {
      p_opaque_token: sessionToken,
      p_quote_id: quoteId,
    });
    if (error) throw new Error(`api_get_storefront_quote: ${error.message}`);
    if (!data || typeof data !== 'object') return null;

    return toStorefrontQuoteDetailDto(data as Record<string, unknown>);
  }

  /**
   * E10.10b-2 — delegue ENTIEREMENT a `api_decide_storefront_quote`
   * (`security definer`, migration 20260907000000) : visibilite, session
   * deleguee, statut, peremption et transition ATOMIQUE (`update ... where
   * status = 'sent'`) sont tous verifies EN BASE. Rend `null` sur les quatre
   * causes indiscernables (comme `findById`), jamais une exception — c est la
   * fonction elle-meme qui distingue ce cas des trois erreurs de domaine.
   *
   * La fonction rend `(id, customer_id)`, PAS la representation complete :
   * `customer_id` n entre dans AUCUN schema client (liste blanche) mais le
   * SERVICE en a besoin pour l evenement sortant. Re-lecture via
   * `api_get_storefront_quote` (meme session) pour construire la
   * representation CLIENT a jour — meme patron que `sendQuote()`/
   * `duplicateQuote()` (commercial-quotes-repository.ts), qui re-lisent eux
   * aussi apres l ecriture plutot que de dupliquer sa construction.
   */
  async decide(
    sessionToken: string,
    quoteId: string,
    decision: StorefrontQuoteDecision,
  ): Promise<StorefrontQuoteDecisionResult | null> {
    const { data, error } = await this.client.rpc('api_decide_storefront_quote', {
      p_opaque_token: sessionToken,
      p_quote_id: quoteId,
      p_decision: decision,
    });
    if (error) throw mapStorefrontQuoteDecisionError(error.message);

    const row = (data ?? [])[0] as Readonly<{ id: string; customer_id: string }> | undefined;
    if (!row) return null;

    const detail = await this.findById(sessionToken, row.id);
    if (!detail) {
      throw new Error('Le devis decide est introuvable juste apres sa decision (defense en profondeur).');
    }
    return { detail, customerId: row.customer_id };
  }
}

/** Traduit le message d exception de `api_decide_storefront_quote` en erreur de domaine (E10.10b-2). */
function mapStorefrontQuoteDecisionError(message: string): Error {
  if (message.includes('quote.decision_forbidden_delegated')) {
    return new StorefrontQuoteDecisionForbiddenDelegatedError(message);
  }
  if (message.includes('quote.decision_forbidden_status')) {
    return new StorefrontQuoteDecisionForbiddenStatusError(message);
  }
  if (message.includes('quote.decision_expired')) {
    return new StorefrontQuoteDecisionExpiredError(message);
  }
  return new Error(`Decision sur le devis impossible: ${message}`);
}

function toStorefrontQuoteDto(row: Record<string, unknown>): StorefrontQuoteDto {
  return {
    id: row.id as string,
    number: row.number as string,
    status: row.status as StorefrontQuoteStatus,
    issued_at: toIsoTimestamp(row.issued_at as string),
    valid_until: (row.valid_until as string | null) ?? null,
    expired: Boolean(row.expired),
    totals: toStorefrontQuoteTotalsDto(row),
  };
}

function toStorefrontQuoteDetailDto(row: Record<string, unknown>): StorefrontQuoteDetailDto {
  const rawTotals = row.totals as Record<string, unknown> | null | undefined;
  const rawLines = Array.isArray(row.lines) ? row.lines : [];

  return {
    id: row.id as string,
    number: row.number as string,
    status: row.status as StorefrontQuoteStatus,
    issued_at: toIsoTimestamp(row.issued_at as string),
    valid_until: (row.valid_until as string | null) ?? null,
    expired: Boolean(row.expired),
    totals: toStorefrontQuoteTotalsDto({ ...(rawTotals ?? {}) }),
    lines: rawLines.map((line) => toStorefrontQuoteLineDto(line as Record<string, unknown>)),
  };
}

/**
 * Accepte indifferemment un objet ROW (colonnes `lines_subtotal`, ...
 * a la racine — cas `listStorefrontQuotes`, `returns table`) ou un objet
 * `totals` deja isole (cas `getStorefrontQuote`, `returns jsonb`) : les deux
 * fonctions SQL nomment leurs champs de totaux a l identique.
 */
function toStorefrontQuoteTotalsDto(source: Record<string, unknown>): StorefrontQuoteTotalsDto {
  return {
    lines_subtotal: toNullableMoneyString(source.lines_subtotal),
    global_discount: toNullableMoneyString(source.global_discount),
    effective_discount_rate: toNullableRateString(source.effective_discount_rate),
    net_total: toMoneyString(source.net_total),
    vat_rate: toRateString(source.vat_rate),
    vat_regime: (source.vat_regime as StorefrontTaxRegime | null) ?? null,
    vat_amount: toMoneyString(source.vat_amount),
    total_incl_tax: toMoneyString(source.total_incl_tax),
  };
}

function toStorefrontQuoteLineDto(row: Record<string, unknown>): StorefrontQuoteLineDto {
  return {
    id: row.id as string,
    label: row.label as string,
    product_config: (row.product_config as Record<string, unknown>) ?? {},
    quantity: Number(row.quantity),
    position: Number(row.position),
    price_before_discount: toNullableMoneyString(row.price_before_discount),
    discount_rate: toNullableRateString(row.discount_rate),
    price: toMoneyString(row.price),
  };
}

/** `numeric(12,2)` : PostgREST/RPC rend un nombre ou une chaine selon le driver — normalise en Money. */
function toMoneyString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toFixed(2);
  return '0.00';
}

function toNullableMoneyString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return toMoneyString(value);
}

/** `numeric(6,4)` : meme normalisation que `toMoneyString`, a 4 decimales. */
function toRateString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toFixed(4);
  return '0.0000';
}

function toNullableRateString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return toRateString(value);
}
