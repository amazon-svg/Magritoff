/**
 * Faux repository Pricing (E10.6), utilise par `price-rules.contract.test.ts`.
 *
 * Reimplemente le TRI et le CURSEUR de `SupabasePriceRulesRepository.list()`
 * a l identique (meme champ, meme sens de comparaison) : un fake qui se
 * contenterait de filtrer par tenant passerait le typecheck sans jamais
 * exercer la pagination reelle — piege deja rencontre deux fois ce sprint
 * (docs/api/CONVENTIONS.md, bivariance de methode).
 */
import type { TenantId, UserId } from '@/kernel';
import {
  PriceRuleCommandRejectedError,
  PriceRuleNotFoundError,
  ProductRangeNotFoundError,
  type ListPriceRulesParams,
  type ListPriceRulesResult,
  type PriceRulesRepository,
  type ResolvePriceRuleParams,
} from '@/modules/pricing/application/price-rules-repository';
import type {
  CreatePriceRuleCommand,
  PriceRuleDto,
  PriceRuleResolveResultDto,
  ProductRangeDefaultMarginDto,
  UpdatePriceRuleCommand,
} from '@/modules/pricing/api/contracts';
import { sanitizeSearchTerm } from '@/adapters/supabase/price-rules-repository';

/**
 * Rang de specificite (E10.7 Dev Notes) : `global` < `range` < `customer` <
 * `customer_range`. Duplique de l ordre attendu de `SPECIFICITY_RANK` cote
 * fonction SQL `resolve_price_rule` — un ecart entre les deux ferait passer
 * ce fake sans jamais exercer le vrai algorithme.
 */
const SPECIFICITY_RANK: Record<PriceRuleDto['scope'], number> = {
  global: 0,
  range: 1,
  customer: 2,
  customer_range: 3,
};

let sequence = 0;
export function fakeUuid(): string {
  sequence += 1;
  return `00000000-0000-4000-9100-${String(sequence).padStart(12, '0')}`;
}

/**
 * `created_at` STRICTEMENT croissant a chaque appel : deux regles creees dans
 * la meme milliseconde de test (Date.now() n a pas cette garantie) doivent
 * quand meme se departager sans ambiguite dans les tests de recence (E10.7)
 * — meme invariant que deux INSERT Postgres successifs, dont `now()` ne
 * revient jamais en arriere au sein d une session.
 */
let lastTimestampMs = 0;
function monotonicIsoTimestamp(): string {
  lastTimestampMs = Math.max(Date.now(), lastTimestampMs + 1);
  return new Date(lastTimestampMs).toISOString();
}

export class InMemoryPriceRulesRepository implements PriceRulesRepository {
  private readonly rules = new Map<string, PriceRuleDto>();
  private readonly defaultMargins = new Map<string, ProductRangeDefaultMarginDto>();
  /** Simule `public.product_gammes` : identifiants connus du catalogue partage. */
  readonly knownProductRanges = new Set<string>();

  async list(tenantId: TenantId, params: ListPriceRulesParams): Promise<ListPriceRulesResult> {
    let rows = [...this.rules.values()].filter((rule) => rule.tenant_id === tenantId);

    if (params.status) {
      const wantActive = params.status === 'active';
      rows = rows.filter((rule) => rule.is_active === wantActive);
    }
    if (params.q) {
      const term = sanitizeSearchTerm(params.q).toLowerCase();
      if (term.length > 0) rows = rows.filter((rule) => rule.name.toLowerCase().includes(term));
    }
    // Egalite stricte, fidele au comportement reel (adaptateur Supabase) :
    // jamais de simulation de resolution (pas de `OR ... IS NULL`).
    if (params.customerId) rows = rows.filter((rule) => rule.customer_id === params.customerId);
    if (params.productRangeId) {
      rows = rows.filter((rule) => rule.product_range_id === params.productRangeId);
    }

    const field = params.sort.field;
    const ascending = params.sort.direction === 'asc';
    const valueOf = (rule: PriceRuleDto) => (field === 'starts_on' ? rule.starts_on : rule.created_at);

    rows = rows.sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      if (av !== bv) return ascending ? (av < bv ? -1 : 1) : av < bv ? 1 : -1;
      return ascending ? (a.id < b.id ? -1 : 1) : a.id < b.id ? 1 : -1;
    });

    if (params.cursor) {
      rows = rows.filter((rule) => {
        const value = valueOf(rule);
        if (ascending) {
          return value > params.cursor!.value || (value === params.cursor!.value && rule.id > params.cursor!.id);
        }
        return value < params.cursor!.value || (value === params.cursor!.value && rule.id < params.cursor!.id);
      });
    }

    return { rows: rows.slice(0, params.size + 1) };
  }

  async findById(tenantId: TenantId, priceRuleId: string): Promise<PriceRuleDto | null> {
    const found = this.rules.get(priceRuleId);
    return found && found.tenant_id === tenantId ? found : null;
  }

  async create(
    tenantId: TenantId,
    actor: UserId,
    command: CreatePriceRuleCommand,
  ): Promise<PriceRuleDto> {
    const now = monotonicIsoTimestamp();
    const rule: PriceRuleDto = {
      id: fakeUuid(),
      tenant_id: tenantId,
      name: command.name,
      scope: command.scope,
      customer_id: command.customer_id ?? null,
      product_range_id: command.product_range_id ?? null,
      value_type: command.value_type,
      value: command.value,
      starts_on: command.starts_on,
      ends_on: command.ends_on ?? null,
      is_active: command.is_active,
      created_by: actor,
      created_at: now,
      updated_at: now,
    };
    this.rules.set(rule.id, rule);
    return rule;
  }

  async update(
    tenantId: TenantId,
    priceRuleId: string,
    command: UpdatePriceRuleCommand,
  ): Promise<PriceRuleDto> {
    const current = await this.findById(tenantId, priceRuleId);
    if (!current) throw new PriceRuleNotFoundError();
    const updated: PriceRuleDto = {
      ...current,
      ...('name' in command ? { name: command.name! } : {}),
      ...('value' in command ? { value: command.value! } : {}),
      ...('starts_on' in command ? { starts_on: command.starts_on! } : {}),
      ...('ends_on' in command ? { ends_on: command.ends_on ?? null } : {}),
      ...('is_active' in command ? { is_active: command.is_active! } : {}),
      updated_at: new Date().toISOString(),
    };
    this.rules.set(priceRuleId, updated);
    return updated;
  }

  /**
   * Reimplemente l algorithme d E10.7 (Dev Notes de la story) : filtre les
   * regles ACTIVES du tenant dont la periode couvre `at` et dont la portee
   * est candidate au contexte fourni, retient le rang de specificite le plus
   * eleve, puis departage par `created_at` decroissant. `reason` vaut
   * `recency` SSI plus d une regle etait candidate au rang retenu.
   */
  async resolve(
    tenantId: TenantId,
    params: ResolvePriceRuleParams,
  ): Promise<PriceRuleResolveResultDto> {
    const candidates = [...this.rules.values()].filter((rule) => {
      if (rule.tenant_id !== tenantId) return false;
      if (!rule.is_active) return false;
      if (rule.starts_on > params.at) return false;
      if (rule.ends_on !== null && rule.ends_on < params.at) return false;

      switch (rule.scope) {
        case 'global':
          return true;
        case 'range':
          return params.productRangeId !== null && rule.product_range_id === params.productRangeId;
        case 'customer':
          return params.customerId !== null && rule.customer_id === params.customerId;
        case 'customer_range':
          return (
            params.customerId !== null &&
            params.productRangeId !== null &&
            rule.customer_id === params.customerId &&
            rule.product_range_id === params.productRangeId
          );
        default:
          return false;
      }
    });

    if (candidates.length === 0) return { rule: null, reason: null };

    const maxRank = Math.max(...candidates.map((rule) => SPECIFICITY_RANK[rule.scope]));
    const atMaxRank = candidates.filter((rule) => SPECIFICITY_RANK[rule.scope] === maxRank);
    const sorted = [...atMaxRank].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const winner = sorted[0]!;
    return {
      rule: winner,
      reason: atMaxRank.length > 1 ? 'recency' : 'specificity',
    };
  }

  async productRangeExists(productRangeId: string): Promise<boolean> {
    return this.knownProductRanges.has(productRangeId);
  }

  async getDefaultMargin(
    tenantId: TenantId,
    productRangeId: string,
  ): Promise<ProductRangeDefaultMarginDto> {
    const found = this.defaultMargins.get(marginKey(tenantId, productRangeId));
    return (
      found ?? {
        tenant_id: tenantId,
        product_range_id: productRangeId,
        margin_rate: null,
        updated_at: null,
        updated_by: null,
      }
    );
  }

  async setDefaultMargin(
    tenantId: TenantId,
    productRangeId: string,
    actor: UserId,
    marginRate: string,
  ): Promise<ProductRangeDefaultMarginDto> {
    const margin: ProductRangeDefaultMarginDto = {
      tenant_id: tenantId,
      product_range_id: productRangeId,
      margin_rate: marginRate,
      updated_at: new Date().toISOString(),
      updated_by: actor,
    };
    this.defaultMargins.set(marginKey(tenantId, productRangeId), margin);
    return margin;
  }
}

function marginKey(tenantId: TenantId, productRangeId: string): string {
  return `${tenantId}:${productRangeId}`;
}

export { PriceRuleCommandRejectedError, PriceRuleNotFoundError, ProductRangeNotFoundError };
