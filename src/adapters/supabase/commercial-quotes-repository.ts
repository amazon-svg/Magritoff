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
import { toIsoTimestamp, toIsoTimestampOrNull } from '../../modules/_shared/application/index.ts';

const CHECK_VIOLATION = '23514';
/** `commercial_quote_lines_quote_position_unique` (qa-review, point mineur 2) : retente `addLine` une fois. */
const UNIQUE_VIOLATION = '23505';
const DEFAULT_TAX_REGIME: TaxRegimeDto = 'metropole_fr';

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
    const rows = data ?? [];
    const [subtotals, taxRegime] = await Promise.all([
      this.subtotalsByQuoteId(tenantId, rows.map((row: Record<string, any>) => row.id as string)),
      this.getTenantTaxRegime(tenantId),
    ]);
    return {
      rows: rows.map((row: Record<string, any>) =>
        toQuoteDto(row, subtotals.get(row.id) ?? '0.00', taxRegime),
      ),
    };
  }

  async findById(tenantId: TenantId, quoteId: string): Promise<QuoteDto | null> {
    const { data, error } = await this.client
      .from('commercial_quotes')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', quoteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const [subtotals, taxRegime] = await Promise.all([
      this.subtotalsByQuoteId(tenantId, [quoteId]),
      this.getTenantTaxRegime(tenantId),
    ]);
    return toQuoteDto(data, subtotals.get(quoteId) ?? '0.00', taxRegime);
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

  /**
   * Somme des `sale_price` des lignes, PAR devis (`QuoteTotals.lines_subtotal`).
   *
   * AGREGEE EN BASE (`api_commercial_quote_line_subtotals`, migration
   * 20260906160000), jamais un `select` brut des lignes individuelles cote
   * TypeScript (qa-review E10.10a round 1, B2) : un `select quote_id,
   * sale_price ... in (quoteIds)` SANS `limit`/`order` se faisait tronquer
   * SANS ERREUR par PostgREST au-dela de `max_rows` (1000) — une page de 50
   * devis a 20 lignes chacun suffit a l atteindre — et sans `order by` le
   * sous-ensemble retourne n etait meme pas deterministe d un appel a l
   * autre. La fonction SQL fait le `group by` : le nombre de lignes qu elle
   * retourne est borne par le nombre de DEVIS demandes (une page), jamais par
   * leur nombre de lignes, donc jamais par `max_rows` dans la plage de
   * pagination du contrat.
   */
  private async subtotalsByQuoteId(
    tenantId: TenantId,
    quoteIds: readonly string[],
  ): Promise<Map<string, string>> {
    if (quoteIds.length === 0) return new Map();
    const { data, error } = await this.client.rpc('api_commercial_quote_line_subtotals', {
      p_tenant_id: tenantId,
      p_quote_ids: quoteIds,
    });
    if (error) throw new Error(error.message);
    return new Map(
      (data ?? []).map((row: Record<string, any>) => [
        row.quote_id as string,
        formatCentsToMoneyNonNegative(parseMoneyNonNegativeToCents(toMoneyString(row.subtotal))),
      ]),
    );
  }

  /** `tenants.tax_regime`, colonne NOT NULL (defaut `metropole_fr`) — le repli ne sert qu une ligne absente/legacy. */
  async getTenantTaxRegime(tenantId: TenantId): Promise<TaxRegimeDto> {
    const { data, error } = await this.client
      .from('tenants')
      .select('tax_regime')
      .eq('id', tenantId)
      .maybeSingle();
    if (error) throw new Error(`Lecture du regime fiscal impossible: ${error.message}`);
    const regime = data?.tax_regime;
    return isTaxRegime(regime) ? regime : DEFAULT_TAX_REGIME;
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
    // E10.10a — remise globale : prix cible XOR taux (deja garanti par le
    // schema Zod, `not: required: [global_discount_rate, target_net_total]`
    // du contrat). Poser l un des deux met l AUTRE a `null` cote serveur,
    // meme quand l appelant ne l a pas mentionne : il n y a jamais deux
    // remises globales sur un devis.
    if ('global_discount_rate' in command) {
      patch['global_discount_rate'] = command.global_discount_rate;
      patch['target_net_total'] = null;
    }
    if ('target_net_total' in command) {
      patch['target_net_total'] = command.target_net_total;
      patch['global_discount_rate'] = null;
    }
    if ('vat_rate' in command) {
      patch['vat_rate'] = command.vat_rate;
    }

    // E10.10a — GARDE D ETAT (409 `quote.update_requires_draft`) : le filtre
    // par statut fait partie de l operation elle-meme, meme condition
    // d ecriture que `remove()` (CA6). Le SERVICE a deja verifie l existence
    // du devis (`findById`) avant cet appel : un 0-ligne ici ne peut donc
    // signifier qu un statut different de `draft`, jamais une absence.
    const { data, error } = await this.client
      .from('commercial_quotes')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', quoteId)
      .eq('status', 'draft')
      .select()
      .maybeSingle();
    if (error) throw toDomainError(error, 'Modification du devis impossible.');
    if (!data) throw new QuoteUpdateRequiresDraftError();

    const [subtotals, taxRegime] = await Promise.all([
      this.subtotalsByQuoteId(tenantId, [quoteId]),
      this.getTenantTaxRegime(tenantId),
    ]);
    return toQuoteDto(data, subtotals.get(quoteId) ?? '0.00', taxRegime);
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
  // E10.10a — envoi/renvoi, duplication, journal d audit d entete.
  // ---------------------------------------------------------------------------

  /**
   * Delegue ENTIEREMENT a `api_send_commercial_quote` (`security definer`,
   * migration 20260906160000) : transition de statut, calcul de
   * `valid_until`, ecriture d audit (`sent`/`resent` + `updated` par champ
   * change, meme `change_set_id`) sont FAITS DANS LA MEME TRANSACTION cote
   * base — meme raisonnement que `api_create_commercial_quote_from_project_items`.
   */
  async sendQuote(
    tenantId: TenantId,
    actor: UserId,
    quoteId: string,
    command: SendQuoteCommand,
  ): Promise<QuoteDetailDto> {
    void actor; // trace : l auteur est porte par la fonction (auth.uid()), pas par ce parametre.
    const { error } = await this.client.rpc('api_send_commercial_quote', {
      p_tenant_id: tenantId,
      p_quote_id: quoteId,
      p_show_discounts: command.show_discounts ?? null,
      p_show_discounts_provided: command.show_discounts !== undefined,
    });
    if (error) throw mapQuoteSendError(error.message);

    const detail = await this.findDetailById(tenantId, quoteId);
    if (!detail) throw new QuoteNotFoundError();
    return detail;
  }

  /**
   * Delegue ENTIEREMENT a `api_duplicate_commercial_quote` (`security
   * definer`) : numerotation (meme compteur que la creation, CA5), insertion
   * du nouveau devis et copie de ses lignes, entree d audit `duplicated` sur
   * l ORIGINAL sont FAITS DANS LA MEME TRANSACTION.
   */
  async duplicateQuote(tenantId: TenantId, actor: UserId, quoteId: string): Promise<QuoteDetailDto> {
    void actor;
    const { data, error } = await this.client.rpc('api_duplicate_commercial_quote', {
      p_tenant_id: tenantId,
      p_source_quote_id: quoteId,
    });
    if (error) throw mapQuoteSendError(error.message);

    const newQuoteId = data as string;
    const detail = await this.findDetailById(tenantId, newQuoteId);
    if (!detail) {
      throw new Error('Le devis duplique est introuvable juste apres sa creation.');
    }
    return detail;
  }

  async listHeaderAuditEntries(
    tenantId: TenantId,
    params: ListQuoteHeaderAuditParams,
  ): Promise<ListQuoteHeaderAuditResult> {
    void tenantId; // `quoteId` deja verifie appartenir au tenant par l appelant (service).
    let query = this.client
      .from('commercial_quote_header_audit')
      .select('*')
      .eq('quote_id', params.quoteId)
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
    return {
      rows: (data ?? []).map((row: Record<string, any>): QuoteAuditEntryDto => ({
        id: row.id,
        quote_id: row.quote_id,
        change_set_id: row.change_set_id,
        action: row.action,
        field: row.field ?? null,
        previous_value: row.previous_value ?? null,
        new_value: row.new_value ?? null,
        quote_snapshot: row.quote_snapshot ?? null,
        actor_id: row.actor_id ?? null,
        actor_label: row.actor_label ?? null,
        occurred_at: toIsoTimestamp(row.occurred_at),
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // E10.9 — lignes de devis.
  // ---------------------------------------------------------------------------

  async findLineById(tenantId: TenantId, quoteId: string, lineId: string): Promise<QuoteLineDto | null> {
    // qa-review (point mineur 4) — la garde REELLE ici est la RLS
    // (`commercial_quote_lines_select`, jointure sur `commercial_quotes.
    // tenant_id`), pas une validation applicative prealable : `tenantId` n
    // est PAS revalide par un appelant (le service n appelle pas forcement
    // `findById`/`getSummary` avant ce point, ex. `getLine`/`updateLine`
    // partent directement d ici). Une ligne d un devis hors tenant est donc
    // filtree par Postgres lui-meme, jamais par une garantie cote code.
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

  /**
   * qa-review (point mineur 2) — `count()` PUIS `insert()` en deux
   * allers-retours SEPARES n est pas atomique : deux `addLine` concurrents
   * sur le MEME devis peuvent lire le meme compte et tenter la MEME
   * `position`. La contrainte `commercial_quote_lines_quote_position_unique`
   * (migration 20260904000100, DEFERRABLE INITIALLY DEFERRED) rend ce
   * scenario IMPOSSIBLE a committer plutot que de le laisser produire deux
   * lignes silencieusement mal ordonnees : le perdant recoit une violation
   * d unicite (23505), qu on retente ICI une seule fois avec un compte
   * fraichement relu — un vrai verrou (`select ... for update` sur le devis,
   * ou une fonction `security invoker` dediee comme `api_delete_commercial_
   * quote_line`) serait plus robuste sous forte contention, mais cette story
   * ne l exige pas : le cas reste rare (deux commerciaux ajoutant une ligne
   * A LA MEME MILLISECONDE sur le MEME devis) et UNE retentative suffit a le
   * rendre correct plutot que silencieux.
   */
  async addLine(tenantId: TenantId, quoteId: string, line: PricedQuoteLineWrite): Promise<QuoteLineDto> {
    void tenantId;
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
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
      if (error) {
        if (error.code === UNIQUE_VIOLATION && attempt < MAX_ATTEMPTS) continue;
        throw mapQuoteLineWriteError(error.message);
      }
      if (!data) throw new Error('La ligne ajoutee est introuvable juste apres son insertion.');
      return toQuoteLineDto(data);
    }
    // Inatteignable (la derniere iteration renvoie ou leve toujours), mais
    // TypeScript ne peut pas le prouver a partir d une boucle `for`.
    throw new Error('addLine : nombre maximal de tentatives atteint.');
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

  /**
   * E10.11 — meme fonction SQL que `SupabaseRolesRepository.userCapability()`
   * (`src/adapters/supabase/roles-repository.ts`), appelee directement ici
   * plutot que par une dependance croisee vers le module Roles (convention
   * du depot : un adaptateur reste autonome, cf. `sanitizeSearchTerm` dans
   * `price-rules-repository.ts`).
   */
  async actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean> {
    const { data, error } = await this.client.rpc('user_has_capability', {
      p_tenant_id: tenantId,
      p_capability: capability,
    });
    if (error) throw new Error(error.message);
    return Boolean(data);
  }
}

/** `true` seulement pour l une des cinq valeurs du contrat `TaxRegime` (defense contre une valeur legacy/inattendue). */
function isTaxRegime(value: unknown): value is TaxRegimeDto {
  return (
    value === 'metropole_fr' ||
    value === 'dom_tom' ||
    value === 'franchise_tva' ||
    value === 'export_eu' ||
    value === 'export_world'
  );
}

/** `numeric(6,4)` nullable (colonne `global_discount_rate`/`target_net_total`/`vat_rate`). */
function toNullableNumericString(value: unknown, decimals: 2 | 4): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toFixed(decimals);
  return null;
}

function toQuoteDto(row: Record<string, any>, linesSubtotal: string, tenantTaxRegime: TaxRegimeDto): QuoteDto {
  const globalDiscountRate = toNullableNumericString(row.global_discount_rate, 4);
  const targetNetTotal = toNullableNumericString(row.target_net_total, 2);
  const vatRateOverride = toNullableNumericString(row.vat_rate, 4);
  const validUntil = row.valid_until ?? null;

  const totals = computeQuoteTotals({
    linesSubtotal,
    globalDiscountRate,
    targetNetTotal,
    quoteVatRateOverride: vatRateOverride,
    tenantTaxRegime,
  });
  const warnings = computeQuoteWarnings({ validUntil, now: new Date() });

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    customer_id: row.customer_id,
    project_id: row.project_id,
    source_quote_id: row.source_quote_id ?? null,
    number: row.number,
    status: row.status,
    valid_until: validUntil,
    show_discounts: Boolean(row.show_discounts),
    global_discount_rate: globalDiscountRate,
    target_net_total: targetNetTotal,
    vat_rate: vatRateOverride,
    totals,
    warnings: [...warnings],
    sent_at: toIsoTimestampOrNull(row.sent_at),
    last_sent_at: toIsoTimestampOrNull(row.last_sent_at),
    sent_by: row.sent_by ?? null,
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

/** Traduit le message d exception de `api_send_commercial_quote`/`api_duplicate_commercial_quote` (E10.10a). */
function mapQuoteSendError(message: string): Error {
  if (message.includes('quote.send_forbidden_status')) {
    return new QuoteSendForbiddenStatusError(message);
  }
  if (message.includes('quote.send_requires_lines')) {
    return new QuoteSendRequiresLinesError(message);
  }
  if (message.includes('quote.resend_immutable')) {
    return new QuoteResendImmutableError(message);
  }
  if (message.includes('quote.not_found')) {
    return new QuoteNotFoundError(message);
  }
  if (message.includes('permission_denied')) {
    return new QuoteCommandRejectedError('quote.permission_denied', message);
  }
  if (message.includes('authentication_required')) {
    return new QuoteCommandRejectedError('quote.authentication_required', message);
  }
  return new Error(`Envoi/duplication du devis impossible: ${message}`);
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
