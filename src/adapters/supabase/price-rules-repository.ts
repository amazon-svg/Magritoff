/**
 * Implementation Supabase du referentiel des regles de prix et de la marge
 * publique standard par gamme (story E10.6).
 *
 * Le tenant est toujours passe explicitement par l appelant (route), jamais
 * lu depuis la session Supabase — meme discipline que
 * src/adapters/supabase/customers-repository.ts (CA4 du socle E10.0).
 *
 * ── Mapping de colonnes ──────────────────────────────────────────────────
 * La table `price_rules` porte `valid_from`/`valid_to` (modele de donnees de
 * la story) ; le contrat API expose `starts_on`/`ends_on` (coherent avec
 * `PriceRuleResolveQuery` d E10.7). L adaptateur est le SEUL endroit ou cette
 * traduction a lieu.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
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

const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';

/**
 * Neutralise les caracteres reserves de la grammaire de filtre PostgREST
 * avant de les interpoler dans un `.ilike(...)`. Meme garde-fou que
 * `customers-repository.ts` (qa-review E10.2) : dupliquee plutot
 * qu importee, comme `toRateString` ci-dessous — chaque adaptateur reste
 * autonome (convention du depot, cf. `commercial-quotes-repository.ts`).
 */
export function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()%]/g, ' ').replace(/\s+/g, ' ').trim();
}

export class SupabasePriceRulesRepository implements PriceRulesRepository {
  constructor(private readonly client: SupabaseClient<any>) {}

  async list(tenantId: TenantId, params: ListPriceRulesParams): Promise<ListPriceRulesResult> {
    const column = sortColumn(params.sort.field);
    const ascending = params.sort.direction === 'asc';

    let query = this.client
      .from('price_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .order(column, { ascending })
      .order('id', { ascending })
      .limit(params.size + 1);

    if (params.status) query = query.eq('is_active', params.status === 'active');
    if (params.q) {
      const sanitized = sanitizeSearchTerm(params.q);
      if (sanitized.length > 0) query = query.ilike('name', `%${sanitized}%`);
    }
    // Egalite stricte, jamais une simulation de resolution (contrat
    // `listPriceRules` : ces filtres portent sur la CIBLE DECLAREE de la
    // regle, pas sur son applicabilite — aucun `OR ... IS NULL`).
    if (params.customerId) query = query.eq('customer_id', params.customerId);
    if (params.productRangeId) query = query.eq('product_range_id', params.productRangeId);
    if (params.cursor) {
      const op = ascending ? 'gt' : 'lt';
      query = query.or(
        `${column}.${op}.${params.cursor.value},and(${column}.eq.${params.cursor.value},id.${op}.${params.cursor.id})`,
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { rows: (data ?? []).map(toPriceRuleDto) };
  }

  async findById(tenantId: TenantId, priceRuleId: string): Promise<PriceRuleDto | null> {
    const { data, error } = await this.client
      .from('price_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', priceRuleId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toPriceRuleDto(data) : null;
  }

  async create(
    tenantId: TenantId,
    actor: UserId,
    command: CreatePriceRuleCommand,
  ): Promise<PriceRuleDto> {
    const { data, error } = await this.client
      .from('price_rules')
      .insert({
        tenant_id: tenantId,
        name: command.name,
        scope: command.scope,
        customer_id: command.customer_id ?? null,
        product_range_id: command.product_range_id ?? null,
        value_type: command.value_type,
        value: command.value,
        valid_from: command.starts_on,
        valid_to: command.ends_on ?? null,
        is_active: command.is_active,
        created_by: actor,
      })
      .select()
      .single();
    if (error || !data) throw toDomainError(error, 'Création de la règle de prix impossible.');
    return toPriceRuleDto(data);
  }

  async update(
    tenantId: TenantId,
    priceRuleId: string,
    command: UpdatePriceRuleCommand,
  ): Promise<PriceRuleDto> {
    const patch: Record<string, unknown> = {};
    if ('name' in command) patch['name'] = command.name;
    if ('value' in command) patch['value'] = command.value;
    if ('starts_on' in command) patch['valid_from'] = command.starts_on;
    if ('ends_on' in command) patch['valid_to'] = command.ends_on ?? null;
    if ('is_active' in command) patch['is_active'] = command.is_active;

    const { data, error } = await this.client
      .from('price_rules')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', priceRuleId)
      .select()
      .maybeSingle();
    if (error) throw toDomainError(error, 'Modification de la règle de prix impossible.');
    if (!data) throw new PriceRuleNotFoundError();
    return toPriceRuleDto(data);
  }

  /**
   * Arbitrage E10.7 : delegue le calcul de specificite/recence a la fonction
   * SQL `resolve_price_rule` (migration `..._gescom_e10_7_resolve_price_rule.sql`),
   * SEULE source de cet algorithme — pas de reimplementation cote adaptateur.
   * `p_tenant_id` est passe explicitement (meme discipline que le reste de
   * cet adaptateur, CA4 du socle) ; la fonction est SECURITY INVOKER, donc la
   * RLS de `price_rules` s applique en defense en profondeur pour une session
   * utilisateur, exactement comme `list()`/`findById()` ci-dessus.
   *
   * La fonction ne rend que `(rule_id, reason)` : le mapping complet vers
   * `PriceRuleDto` est delegue a `findById()`, seul et unique endroit ou la
   * ligne Postgres est traduite en DTO (`toPriceRuleDto`) — pas de deuxieme
   * mapping divergent ici.
   */
  async resolve(
    tenantId: TenantId,
    params: ResolvePriceRuleParams,
  ): Promise<PriceRuleResolveResultDto> {
    const { data, error } = (await this.client
      .rpc('resolve_price_rule', {
        p_tenant_id: tenantId,
        p_customer_id: params.customerId,
        p_product_range_id: params.productRangeId,
        p_at: params.at,
      })
      .maybeSingle()) as { data: { rule_id: string | null; reason: string | null } | null; error: { message: string } | null };
    if (error) throw new Error(error.message);
    if (!data || !data.rule_id) return { rule: null, reason: null };

    const rule = await this.findById(tenantId, data.rule_id);
    if (!rule) {
      // Incoherence transitoire (course entre la resolution et une
      // desactivation/suppression concurrente) : jamais vu en pratique, la
      // fonction et `findById` interrogeant la meme ligne sous la meme
      // transaction PostgREST, mais un `null` silencieux masquerait le
      // probleme plutot que de le signaler.
      throw new Error('Regle resolue introuvable a la relecture (incoherence transitoire).');
    }
    return { rule, reason: (data.reason as PriceRuleResolveResultDto['reason']) ?? null };
  }

  /** `public.product_gammes` : catalogue PARTAGE, sans tenant (CA2). */
  async productRangeExists(productRangeId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('product_gammes')
      .select('id')
      .eq('id', productRangeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data !== null;
  }

  async getDefaultMargin(
    tenantId: TenantId,
    productRangeId: string,
  ): Promise<ProductRangeDefaultMarginDto> {
    const { data, error } = await this.client
      .from('product_range_default_margins')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('product_range_id', productRangeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data
      ? toDefaultMarginDto(data)
      : {
          tenant_id: tenantId,
          product_range_id: productRangeId,
          margin_rate: null,
          updated_at: null,
          updated_by: null,
        };
  }

  async setDefaultMargin(
    tenantId: TenantId,
    productRangeId: string,
    actor: UserId,
    marginRate: string,
  ): Promise<ProductRangeDefaultMarginDto> {
    const { data, error } = await this.client
      .from('product_range_default_margins')
      .upsert(
        {
          tenant_id: tenantId,
          product_range_id: productRangeId,
          margin_rate: marginRate,
          updated_by: actor,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,product_range_id' },
      )
      .select()
      .single();
    if (error || !data) {
      throw toDomainError(error, 'Enregistrement de la marge publique standard impossible.');
    }
    return toDefaultMarginDto(data);
  }

  /**
   * E10.11 — meme fonction SQL que `SupabaseRolesRepository.userCapability()`
   * / `SupabaseCommercialQuotesRepository.actorHasCapability()`, appelee
   * directement ici plutot que par une dependance croisee entre modules
   * (convention du depot : un adaptateur reste autonome).
   */
  async actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean> {
    void actorId; // trace : `user_has_capability` lit `auth.uid()` de la session, pas ce parametre.
    const { data, error } = await this.client.rpc('user_has_capability', {
      p_tenant_id: tenantId,
      p_capability: capability,
    });
    if (error) throw new Error(error.message);
    return Boolean(data);
  }
}

function sortColumn(field: 'created_at' | 'starts_on'): 'created_at' | 'valid_from' {
  return field === 'starts_on' ? 'valid_from' : 'created_at';
}

function toPriceRuleDto(row: Record<string, any>): PriceRuleDto {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    scope: row.scope,
    customer_id: row.customer_id ?? null,
    product_range_id: row.product_range_id ?? null,
    value_type: row.value_type,
    value: toRateString(row.value),
    starts_on: row.valid_from,
    ends_on: row.valid_to ?? null,
    is_active: Boolean(row.is_active),
    created_by: row.created_by ?? null,
    created_at: toIsoTimestamp(row.created_at),
    updated_at: toIsoTimestamp(row.updated_at),
  };
}

function toDefaultMarginDto(row: Record<string, any>): ProductRangeDefaultMarginDto {
  return {
    tenant_id: row.tenant_id,
    product_range_id: row.product_range_id,
    margin_rate: row.margin_rate === null || row.margin_rate === undefined ? null : toRateString(row.margin_rate),
    updated_at: toIsoTimestampOrNull(row.updated_at),
    updated_by: row.updated_by ?? null,
  };
}

/** `numeric(6,4)` : PostgREST rend un nombre ou une chaine selon le driver, normalise en Rate. */
function toRateString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toFixed(4);
  return '0.0000';
}

/**
 * Nom de la contrainte violee, extrait du message Postgres (meme fonction
 * que `customers-repository.ts`, dupliquee pour la meme raison d autonomie
 * d adaptateur).
 */
function violatedConstraintName(error: { message: string; details?: string | null }): string | null {
  const haystack = `${error.message} ${error.details ?? ''}`;
  return haystack.match(/constraint "([^"]+)"/)?.[1] ?? null;
}

/** Exporte uniquement pour test unitaire. */
export function toDomainError(
  error: { code?: string; message: string; details?: string | null } | null,
  fallback: string,
): Error {
  if (error?.code === UNIQUE_VIOLATION) {
    return new PriceRuleCommandRejectedError(
      'api.validation_failed',
      'Conflit d unicite sur la ressource.',
    );
  }
  if (error?.code === CHECK_VIOLATION) {
    const constraint = violatedConstraintName(error) ?? '';
    if (constraint.includes('scope')) {
      return new PriceRuleCommandRejectedError(
        'price_rule.invalid_scope',
        'Portee incoherente avec les cibles fournies.',
      );
    }
    if (constraint.includes('period')) {
      return new PriceRuleCommandRejectedError(
        'price_rule.invalid_period',
        'La date de fin doit etre egale ou posterieure a la date de debut.',
      );
    }
    return new PriceRuleCommandRejectedError('api.validation_failed', error.message ?? fallback);
  }
  return new Error(error?.message ?? fallback);
}
