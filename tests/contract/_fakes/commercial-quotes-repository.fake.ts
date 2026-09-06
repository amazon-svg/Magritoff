/**
 * Faux repository Devis commerciaux (E10.3, E10.9, E10.10a), sur le meme
 * principe que `projects-repository.fake.ts` (E10.1) : partage entre les
 * tests de contrat, jamais reecrit a la main deux fois (leçon du sprint —
 * docs/api/CONVENTIONS.md, un faux non teste qui diverge de l adaptateur
 * reel passe le typecheck sans etre detecte).
 *
 * ── Point critique : la numerotation DOIT etre atomique, meme en memoire ──
 * `createFromProjectItems()`/`duplicateQuote()` lisent puis ecrivent le
 * compteur SANS aucun `await` entre les deux : sous Node/JS (boucle d
 * evenements a un seul thread), deux appels lances via `Promise.all`
 * s executent en fait en SERIE tant qu aucun point de suspension (`await`) ne
 * coupe la section critique. Introduire un `await` entre la lecture et l
 * ecriture du compteur (ex. pour "simuler" un appel reseau) reintroduirait
 * exactement le risque de doublon que la vraie fonction Postgres evite par le
 * verrou de ligne de l UPSERT.
 *
 * ── E10.9 — ce que ce faux reimplemente fidelement, pas seulement type ────
 * - La garde "devis brouillon" (`quote_line.quote_not_draft`) sur TOUTE
 *   ecriture de ligne, meme discipline que le trigger BEFORE de la migration
 *   `20260904000100_gescom_e10_9_quote_line_discounts.sql`.
 * - Le journal d audit APPEND-ONLY, une entree PAR CHAMP PERSISTE change,
 *   regroupees par `change_set_id` PAR APPEL.
 * - Les alertes (`warnings`) calculees par `computeQuoteLineWarnings()`, LA
 *   MEME fonction que l adaptateur Supabase (aucune reimplementation
 *   divergente possible).
 * - B1 (qa-review, BLOQUANT) — TOUTE ecriture de ligne avance `updated_at` du
 *   devis PARENT, meme discipline que le trigger AFTER `commercial_quote_
 *   lines_touch_quote_updated_at_trigger`.
 *
 * ── E10.10a — statut, envoi/renvoi, duplication, remise globale, totaux ────
 * Un devis est stocke sous une forme INTERNE (`StoredQuote`, colonnes DB) qui
 * ne porte NI `totals` NI `warnings` : ces deux champs sont DERIVES a chaque
 * LECTURE par `toQuoteDto()`, exactement comme l adaptateur Supabase le fait
 * (`computeQuoteTotals`/`computeQuoteWarnings`, memes fonctions PURES) —
 * jamais recalcules deux fois de facons differentes. `sendQuote`/
 * `duplicateQuote` reimplementent ici, en memoire, ce que
 * `api_send_commercial_quote`/`api_duplicate_commercial_quote` (migration
 * `20260906000100`) font en une seule transaction Postgres.
 */
import type { TenantId, UserId } from '@/kernel';
import type { ProjectDto, ProjectItemDto } from '@/modules/projects/api/contracts';
import type { ProjectsRepository } from '@/modules/projects/application/projects-repository';
import {
  computeQuoteLineWarnings,
  formatCentsToMoneyNonNegative,
  parseMoneyNonNegativeToCents,
} from '@/modules/commercial-quotes/application/quote-line-pricing';
import { computeQuoteTotals, computeQuoteWarnings } from '@/modules/commercial-quotes/application/quote-totals';
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
  type QuoteLineAuditRow,
  type QuoteLineWriteUpdate,
} from '@/modules/commercial-quotes/application/commercial-quotes-repository';
import type {
  CreateQuoteFromProjectCommand,
  QuoteAuditEntryDto,
  QuoteAuditField,
  QuoteDetailDto,
  QuoteDto,
  QuoteLineDto,
  QuoteStatus,
  SendQuoteCommand,
  TaxRegimeDto,
  UpdateQuoteCommand,
} from '@/modules/commercial-quotes/api/contracts';

let sequence = 0;
export function fakeQuoteUuid(): string {
  sequence += 1;
  return `00000000-0000-4000-b000-${String(sequence).padStart(12, '0')}`;
}

function toMoneyString(raw: unknown): string {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return '0.00';
  return value.toFixed(2);
}

/** Meme ordre que `.order('created_at', {ascending:false}).order('id', {ascending:false})`. */
function compareCreatedAtThenIdDesc(
  a: Readonly<{ created_at: string; id: string }>,
  b: Readonly<{ created_at: string; id: string }>,
): number {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

function isStrictlyAfterCursor(
  row: Readonly<{ sort: string; id: string }>,
  cursor: Readonly<{ sort: string; id: string }>,
): boolean {
  if (row.sort < cursor.sort) return true;
  if (row.sort > cursor.sort) return false;
  return row.id < cursor.id;
}

/**
 * Devis stocke SOUS FORME DE COLONNES, sans `totals` ni `warnings` (DERIVES a
 * chaque lecture par `toQuoteDto()`, jamais mis en cache dans la Map — un
 * devis dont les lignes changent ne doit jamais rendre un total perime).
 */
type StoredQuote = Readonly<{
  id: string;
  tenant_id: string;
  customer_id: string;
  project_id: string;
  source_quote_id: string | null;
  number: string;
  status: QuoteStatus;
  valid_until: string | null;
  show_discounts: boolean;
  global_discount_rate: string | null;
  target_net_total: string | null;
  vat_rate: string | null;
  sent_at: string | null;
  last_sent_at: string | null;
  sent_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}>;

type MutableStoredQuote = { -readonly [K in keyof StoredQuote]: StoredQuote[K] };

/**
 * Ligne stockee : superset de `QuoteLineDto` avec `chiffrage_quantity`
 * (colonne interne, jamais publiee au contrat — sert uniquement a calculer
 * l alerte `production_cost_stale`, meme discipline que la colonne reelle).
 */
type StoredQuoteLine = QuoteLineDto & { chiffrage_quantity: number | null };

/**
 * Horodatage STRICTEMENT croissant, partage par l audit (`occurred_at`) et
 * par `touchQuoteUpdatedAt()` (B1) : deux ecritures nees dans la meme
 * milliseconde de test doivent quand meme se departager.
 */
let lastAuditTimestampMs = 0;
function monotonicIsoTimestamp(): string {
  lastAuditTimestampMs = Math.max(Date.now(), lastAuditTimestampMs + 1);
  return new Date(lastAuditTimestampMs).toISOString();
}

export class InMemoryCommercialQuotesRepository implements CommercialQuotesRepository {
  private readonly quotes = new Map<string, StoredQuote>();
  private readonly lines = new Map<string, StoredQuoteLine>();
  private readonly auditEntries: QuoteLineAuditRow[] = [];
  private readonly headerAuditEntries: QuoteAuditEntryDto[] = [];
  /** Compteur par `${tenantId}:${year}`, meme portee que commercial_quote_number_counters. */
  private readonly counters = new Map<string, number>();
  /**
   * Droits metier de l acteur, par tenant (E10.11, `can_manage_pricing`).
   * `true` par defaut (equivalent d un `admin`, qui recoit toute capability
   * par derivation en production) : un test doit forcer `false` explicitement
   * pour exercer la garde 403 `identity.role_required`.
   */
  private readonly actorCapabilities = new Map<string, boolean>();
  /** `commercial_settings.default_validity_days` par tenant (E10.10a). `undefined` = jamais ouvert -> `null`. */
  private readonly defaultValidityDays = new Map<string, number | null>();
  /** `tenants.tax_regime` par tenant. Absent = `metropole_fr` (defaut reel de la colonne). */
  private readonly tenantTaxRegimes = new Map<string, TaxRegimeDto>();

  constructor(private readonly projects: ProjectsRepository) {}

  /** TEST UNIQUEMENT — force le droit d un acteur pour exercer la garde 403 `identity.role_required`. */
  setActorCapabilityForTest(tenantId: string, actorId: string, capability: string, granted: boolean | null): void {
    const key = `${tenantId}:${actorId}:${capability}`;
    if (granted === null) this.actorCapabilities.delete(key);
    else this.actorCapabilities.set(key, granted);
  }

  /** TEST UNIQUEMENT — equivalent de `updateCommercialSettings({default_validity_days})` sans passer par HTTP. */
  setDefaultValidityDaysForTest(tenantId: string, days: number | null): void {
    this.defaultValidityDays.set(tenantId, days);
  }

  /** TEST UNIQUEMENT — equivalent de `tenants.tax_regime` sans passer par une table `tenants` en memoire. */
  setTenantTaxRegimeForTest(tenantId: string, regime: TaxRegimeDto): void {
    this.tenantTaxRegimes.set(tenantId, regime);
  }

  async actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean> {
    return this.actorCapabilities.get(`${tenantId}:${actorId}:${capability}`) ?? true;
  }

  async getTenantTaxRegime(tenantId: TenantId): Promise<TaxRegimeDto> {
    return this.tenantTaxRegimes.get(tenantId) ?? 'metropole_fr';
  }

  async list(tenantId: TenantId, params: ListQuotesParams): Promise<ListQuotesResult> {
    let rows = [...this.quotes.values()]
      .filter((q) => q.tenant_id === tenantId)
      .filter((q) => !params.customerId || q.customer_id === params.customerId)
      .filter((q) => !params.projectId || q.project_id === params.projectId)
      .filter((q) => !params.status || q.status === params.status)
      .sort(compareCreatedAtThenIdDesc);

    if (params.cursor) {
      const cursor = params.cursor;
      rows = rows.filter((q) => isStrictlyAfterCursor({ sort: q.created_at, id: q.id }, cursor));
    }
    return { rows: rows.slice(0, params.size + 1).map((row) => this.toQuoteDto(row)) };
  }

  async findById(tenantId: TenantId, quoteId: string): Promise<QuoteDto | null> {
    const found = this.quotes.get(quoteId);
    return found && found.tenant_id === tenantId ? this.toQuoteDto(found) : null;
  }

  async findDetailById(tenantId: TenantId, quoteId: string): Promise<QuoteDetailDto | null> {
    const quote = await this.findById(tenantId, quoteId);
    if (!quote) return null;
    const lines = this.linesOf(quoteId);
    return { ...quote, lines };
  }

  /** `QuoteTotals.lines_subtotal` : somme des `sale_price` des lignes REELLES du devis, jamais mise en cache. */
  private subtotalOf(quoteId: string): string {
    const cents = [...this.lines.values()]
      .filter((line) => line.quote_id === quoteId)
      .reduce((sum, line) => sum + parseMoneyNonNegativeToCents(line.sale_price), 0n);
    return formatCentsToMoneyNonNegative(cents);
  }

  /** `StoredQuote` -> `QuoteDto` : (re)calcule `totals`/`warnings` a chaque lecture, jamais stocke. */
  private toQuoteDto(stored: StoredQuote): QuoteDto {
    const totals = computeQuoteTotals({
      linesSubtotal: this.subtotalOf(stored.id),
      globalDiscountRate: stored.global_discount_rate,
      targetNetTotal: stored.target_net_total,
      quoteVatRateOverride: stored.vat_rate,
      tenantTaxRegime: this.tenantTaxRegimes.get(stored.tenant_id) ?? 'metropole_fr',
    });
    const warnings = computeQuoteWarnings({ validUntil: stored.valid_until, now: new Date() });
    return { ...stored, totals, warnings: [...warnings] };
  }

  private linesOf(quoteId: string): QuoteLineDto[] {
    return [...this.lines.values()]
      .filter((line) => line.quote_id === quoteId)
      .sort((a, b) => a.position - b.position)
      .map((line) => toDto(line));
  }

  private assertDraft(quoteId: string): StoredQuote {
    const quote = this.quotes.get(quoteId);
    if (!quote) throw new QuoteNotFoundError();
    if (quote.status !== 'draft') throw new QuoteLineQuoteNotDraftError();
    return quote;
  }

  /**
   * B1 (qa-review, BLOQUANT) — avance `updated_at` du devis PARENT, appele
   * par TOUTE methode qui ecrit une ligne (`addLine`/`updateLine`/
   * `removeLine`/`reorderLines`), meme quand la mutation en elle-meme ne
   * change aucun champ visible de la ligne (le trigger SQL reel n a pas de
   * `when` non plus, cf. migration 20260904000100).
   */
  private touchQuoteUpdatedAt(quoteId: string): void {
    const quote = this.quotes.get(quoteId);
    if (!quote) return;
    this.quotes.set(quoteId, { ...quote, updated_at: monotonicIsoTimestamp() });
  }

  private pushAudit(entry: Omit<QuoteLineAuditRow, 'id' | 'occurred_at'>): void {
    this.auditEntries.push({
      ...entry,
      id: fakeQuoteUuid(),
      occurred_at: monotonicIsoTimestamp(),
    });
  }

  /** E10.10a — journal d audit de l ENTETE, distinct du journal des lignes. */
  private pushHeaderAudit(entry: Omit<QuoteAuditEntryDto, 'id' | 'occurred_at'>): void {
    this.headerAuditEntries.push({
      ...entry,
      id: fakeQuoteUuid(),
      occurred_at: monotonicIsoTimestamp(),
    });
  }

  async createFromProjectItems(
    tenantId: TenantId,
    actor: UserId,
    command: CreateQuoteFromProjectCommand,
  ): Promise<QuoteDetailDto> {
    const requested = command.item_ids;
    if (requested.length === 0) {
      throw itemsInvalidError();
    }

    const project: ProjectDto | null = await this.projects.findById(tenantId, command.project_id);
    if (!project) throw new QuoteProjectNotFoundError();

    const detail = await this.projects.findDetailById(tenantId, command.project_id);
    const items: readonly ProjectItemDto[] = (detail?.items ?? []).filter((item) =>
      requested.includes(item.id),
    );
    if (items.length !== requested.length) {
      throw itemsInvalidError();
    }

    // ── Section critique NON interrompue par un await (voir en-tete) ──────
    const year = new Date().getUTCFullYear();
    const counterKey = `${tenantId}:${year}`;
    const next = (this.counters.get(counterKey) ?? 0) + 1;
    this.counters.set(counterKey, next);
    const number = `DEV-${year}-${String(next).padStart(5, '0')}`;

    const now = new Date().toISOString();
    const quote: StoredQuote = {
      id: fakeQuoteUuid(),
      tenant_id: tenantId,
      customer_id: project.customer_id,
      project_id: command.project_id,
      source_quote_id: null,
      number,
      status: 'draft',
      valid_until: null,
      show_discounts: false,
      global_discount_rate: null,
      target_net_total: null,
      vat_rate: null,
      sent_at: null,
      last_sent_at: null,
      sent_by: null,
      created_by: actor,
      created_at: now,
      updated_at: now,
    };
    this.quotes.set(quote.id, quote);
    // ── Fin de section critique ────────────────────────────────────────────

    items.forEach((item, index) => {
      const payload = item.quote_payload as Readonly<Record<string, unknown>>;
      const amounts = (payload['amounts'] ?? {}) as Readonly<Record<string, unknown>>;
      const production = toMoneyString(amounts['clariprint_price_ht'] ?? amounts['price'] ?? 0);
      const quantity = Math.max(Math.trunc(Number(payload['quantity'] ?? 1)) || 1, 1);
      const stored: StoredQuoteLine = {
        id: fakeQuoteUuid(),
        quote_id: quote.id,
        origin: 'project_item',
        project_item_id: item.id,
        label: item.label,
        product_config: payload,
        quantity,
        position: index,
        production_price: production,
        public_price: production,
        customer_price: production,
        applied_margin_rate: '0.0000',
        applied_rule_id: null,
        sale_price: production,
        sale_margin_rate: production === '0.00' ? null : '0.0000',
        discount_rate: production === '0.00' ? null : '0.0000',
        margin_variation: production === '0.00' ? null : '0.0000',
        breakdown: [{ post: 'total', cost: production, margin_rate: '0.0000', price: production, source: 'clariprint' }],
        warnings: [],
        created_at: now,
        chiffrage_quantity: quantity,
      };
      this.lines.set(stored.id, stored);
      this.pushAudit({
        quote_id: quote.id,
        quote_line_id: stored.id,
        change_set_id: fakeQuoteUuid(),
        action: 'added',
        field: null,
        previous_value: null,
        new_value: null,
        line_snapshot: stored as unknown as Readonly<Record<string, unknown>>,
        actor_id: actor,
        actor_label: null,
      });
    });

    const detailResult = await this.findDetailById(tenantId, quote.id);
    if (!detailResult) throw new Error('devis introuvable juste apres sa creation (faux repository)');
    return detailResult;
  }

  async update(tenantId: TenantId, quoteId: string, command: UpdateQuoteCommand): Promise<QuoteDto> {
    const current = this.quotes.get(quoteId);
    if (!current || current.tenant_id !== tenantId) throw new QuoteNotFoundError();
    // E10.10a — GARDE D ETAT (409 `quote.update_requires_draft`), meme
    // condition d ecriture que `remove()` (CA6).
    if (current.status !== 'draft') throw new QuoteUpdateRequiresDraftError();

    const changeSetId = fakeQuoteUuid();
    const next: MutableStoredQuote = { ...current };

    const auditField = (field: QuoteAuditField, previousValue: string | null, newValue: string | null): void => {
      if (previousValue === newValue) return;
      this.pushHeaderAudit({
        quote_id: quoteId,
        change_set_id: changeSetId,
        action: 'updated',
        field,
        previous_value: previousValue,
        new_value: newValue,
        quote_snapshot: null,
        actor_id: null,
        actor_label: null,
      });
    };

    if ('valid_until' in command && command.valid_until !== undefined) {
      auditField('valid_until', current.valid_until, command.valid_until);
      next.valid_until = command.valid_until;
    }
    if ('show_discounts' in command && command.show_discounts !== undefined) {
      auditField('show_discounts', String(current.show_discounts), String(command.show_discounts));
      next.show_discounts = command.show_discounts;
    }
    // Remise globale : prix cible XOR taux (deja garanti par le schema Zod).
    // Poser l un des deux met l AUTRE a `null`, meme non mentionne.
    if ('global_discount_rate' in command) {
      const value = command.global_discount_rate ?? null;
      auditField('global_discount_rate', current.global_discount_rate, value);
      if (current.target_net_total !== null) auditField('target_net_total', current.target_net_total, null);
      next.global_discount_rate = value;
      next.target_net_total = null;
    }
    if ('target_net_total' in command) {
      const value = command.target_net_total ?? null;
      auditField('target_net_total', current.target_net_total, value);
      if (current.global_discount_rate !== null) auditField('global_discount_rate', current.global_discount_rate, null);
      next.target_net_total = value;
      next.global_discount_rate = null;
    }
    if ('vat_rate' in command) {
      const value = command.vat_rate ?? null;
      auditField('vat_rate', current.vat_rate, value);
      next.vat_rate = value;
    }

    next.updated_at = new Date().toISOString();
    this.quotes.set(quoteId, next);
    return this.toQuoteDto(next);
  }

  /**
   * TEST UNIQUEMENT — permet d exercer un statut sans passer par `sendQuote`
   * (utile pour les scenarios herites d E10.3/E10.9, ex. `quote.delete_
   * requires_draft` sur un devis force a `sent`).
   */
  forceStatusForTest(quoteId: string, status: QuoteDto['status']): void {
    const current = this.quotes.get(quoteId);
    if (!current) throw new Error(`devis ${quoteId} introuvable (forceStatusForTest)`);
    this.quotes.set(quoteId, { ...current, status });
  }

  async remove(tenantId: TenantId, quoteId: string): Promise<void> {
    const current = this.quotes.get(quoteId);
    if (!current || current.tenant_id !== tenantId) throw new QuoteNotFoundError();
    // CA6 — meme condition d ecriture que l adaptateur reel : le filtre par
    // statut fait partie de l operation elle-meme, pas d une verification
    // separee qui pourrait courir avec une autre modification.
    if (current.status !== 'draft') throw new QuoteDeleteRequiresDraftError();
    this.quotes.delete(quoteId);
    for (const [id, line] of this.lines) {
      if (line.quote_id === quoteId) this.lines.delete(id);
    }
  }

  // ---------------------------------------------------------------------------
  // E10.10a — envoi/renvoi, duplication, journal d audit d entete.
  // ---------------------------------------------------------------------------

  /**
   * Reimplemente en memoire ce que `api_send_commercial_quote` fait en une
   * seule transaction Postgres (migration `20260906000100`) : distinction
   * premier envoi (`draft`) / renvoi (`sent`), calcul de `valid_until` depuis
   * `commercial_settings.default_validity_days` UNIQUEMENT si elle est encore
   * `null`, entree d audit `sent` (snapshot complet) ou `resent` (rien),
   * `show_discounts` fige sur un renvoi divergent (`quote.resend_immutable`).
   */
  async sendQuote(
    tenantId: TenantId,
    actor: UserId,
    quoteId: string,
    command: SendQuoteCommand,
  ): Promise<QuoteDetailDto> {
    const current = this.quotes.get(quoteId);
    if (!current || current.tenant_id !== tenantId) throw new QuoteNotFoundError();
    if (current.status !== 'draft' && current.status !== 'sent') {
      throw new QuoteSendForbiddenStatusError();
    }

    const changeSetId = fakeQuoteUuid();
    const next: MutableStoredQuote = { ...current };

    if (current.status === 'draft') {
      if (this.linesOf(quoteId).length === 0) throw new QuoteSendRequiresLinesError();

      if (command.show_discounts !== undefined && command.show_discounts !== current.show_discounts) {
        this.pushHeaderAudit({
          quote_id: quoteId,
          change_set_id: changeSetId,
          action: 'updated',
          field: 'show_discounts',
          previous_value: String(current.show_discounts),
          new_value: String(command.show_discounts),
          quote_snapshot: null,
          actor_id: actor,
          actor_label: null,
        });
        next.show_discounts = command.show_discounts;
      }

      if (current.valid_until === null) {
        const defaultDays = this.defaultValidityDays.get(tenantId) ?? null;
        if (defaultDays !== null) {
          const boundary = new Date();
          boundary.setUTCDate(boundary.getUTCDate() + defaultDays);
          const computed = boundary.toISOString().slice(0, 10);
          this.pushHeaderAudit({
            quote_id: quoteId,
            change_set_id: changeSetId,
            action: 'updated',
            field: 'valid_until',
            previous_value: null,
            new_value: computed,
            quote_snapshot: null,
            actor_id: actor,
            actor_label: null,
          });
          next.valid_until = computed;
        }
      }

      const now = monotonicIsoTimestamp();
      next.status = 'sent';
      next.sent_at = now;
      next.last_sent_at = now;
      next.sent_by = actor;
      next.updated_at = now;
      this.quotes.set(quoteId, next);

      this.pushHeaderAudit({
        quote_id: quoteId,
        change_set_id: changeSetId,
        action: 'sent',
        field: null,
        previous_value: null,
        new_value: null,
        quote_snapshot: {
          quote: this.toQuoteDto(next),
          lines: this.linesOf(quoteId),
        } as unknown as Readonly<Record<string, unknown>>,
        actor_id: actor,
        actor_label: null,
      });
    } else {
      // Renvoi : le contenu ne bouge pas. Une divergence de show_discounts
      // est un refus, jamais une modification silencieuse.
      if (command.show_discounts !== undefined && command.show_discounts !== current.show_discounts) {
        throw new QuoteResendImmutableError();
      }
      const now = monotonicIsoTimestamp();
      next.last_sent_at = now;
      next.updated_at = now;
      this.quotes.set(quoteId, next);

      this.pushHeaderAudit({
        quote_id: quoteId,
        change_set_id: changeSetId,
        action: 'resent',
        field: null,
        previous_value: null,
        new_value: null,
        quote_snapshot: null,
        actor_id: actor,
        actor_label: null,
      });
    }

    const detail = await this.findDetailById(tenantId, quoteId);
    if (!detail) throw new QuoteNotFoundError();
    return detail;
  }

  /**
   * Reimplemente en memoire ce que `api_duplicate_commercial_quote` fait en
   * une seule transaction : nouveau devis `draft`, nouveau numero (MEME
   * compteur que la creation depuis un projet), lignes recopiees avec leur
   * geste commercial fige, `valid_until` remise a `null`, entree d audit
   * `duplicated` sur l ORIGINAL.
   */
  async duplicateQuote(tenantId: TenantId, actor: UserId, quoteId: string): Promise<QuoteDetailDto> {
    const source = this.quotes.get(quoteId);
    if (!source || source.tenant_id !== tenantId) throw new QuoteNotFoundError();

    // ── Section critique NON interrompue par un await (voir en-tete) ──────
    const year = new Date().getUTCFullYear();
    const counterKey = `${tenantId}:${year}`;
    const nextCounter = (this.counters.get(counterKey) ?? 0) + 1;
    this.counters.set(counterKey, nextCounter);
    const number = `DEV-${year}-${String(nextCounter).padStart(5, '0')}`;

    const now = monotonicIsoTimestamp();
    const copy: StoredQuote = {
      id: fakeQuoteUuid(),
      tenant_id: tenantId,
      customer_id: source.customer_id,
      project_id: source.project_id,
      source_quote_id: source.id,
      number,
      status: 'draft',
      valid_until: null,
      show_discounts: source.show_discounts,
      global_discount_rate: source.global_discount_rate,
      target_net_total: source.target_net_total,
      vat_rate: source.vat_rate,
      sent_at: null,
      last_sent_at: null,
      sent_by: null,
      created_by: actor,
      created_at: now,
      updated_at: now,
    };
    this.quotes.set(copy.id, copy);
    // ── Fin de section critique ────────────────────────────────────────────

    const sourceLines = [...this.lines.values()]
      .filter((line) => line.quote_id === quoteId)
      .sort((a, b) => a.position - b.position);
    sourceLines.forEach((line) => {
      const newLineId = fakeQuoteUuid();
      const copiedLine: StoredQuoteLine = { ...line, id: newLineId, quote_id: copy.id, created_at: now };
      this.lines.set(newLineId, copiedLine);
      // Le journal des LIGNES de la copie est alimente comme celui de tout
      // ajout (meme mecanisme que le trigger SQL reel, E10.9).
      this.pushAudit({
        quote_id: copy.id,
        quote_line_id: newLineId,
        change_set_id: fakeQuoteUuid(),
        action: 'added',
        field: null,
        previous_value: null,
        new_value: null,
        line_snapshot: copiedLine as unknown as Readonly<Record<string, unknown>>,
        actor_id: actor,
        actor_label: null,
      });
    });

    this.pushHeaderAudit({
      quote_id: quoteId,
      change_set_id: fakeQuoteUuid(),
      action: 'duplicated',
      field: null,
      previous_value: null,
      new_value: copy.id,
      quote_snapshot: null,
      actor_id: actor,
      actor_label: null,
    });

    const detail = await this.findDetailById(tenantId, copy.id);
    if (!detail) throw new Error('le devis duplique est introuvable juste apres sa creation (faux repository)');
    return detail;
  }

  async listHeaderAuditEntries(
    tenantId: TenantId,
    params: ListQuoteHeaderAuditParams,
  ): Promise<ListQuoteHeaderAuditResult> {
    void tenantId;
    let rows = this.headerAuditEntries
      .filter((entry) => entry.quote_id === params.quoteId)
      .sort((a, b) => {
        if (a.occurred_at !== b.occurred_at) return a.occurred_at < b.occurred_at ? 1 : -1;
        if (a.id === b.id) return 0;
        return a.id < b.id ? 1 : -1;
      });

    if (params.cursor) {
      const cursor = params.cursor;
      rows = rows.filter((entry) => isStrictlyAfterCursor({ sort: entry.occurred_at, id: entry.id }, cursor));
    }
    return { rows: rows.slice(0, params.size + 1) };
  }

  // ---------------------------------------------------------------------------
  // E10.9 — lignes de devis.
  // ---------------------------------------------------------------------------

  async findLineById(tenantId: TenantId, quoteId: string, lineId: string): Promise<QuoteLineDto | null> {
    void tenantId;
    const found = this.lines.get(lineId);
    return found && found.quote_id === quoteId ? toDto(found) : null;
  }

  async addLine(tenantId: TenantId, quoteId: string, line: PricedQuoteLineWrite): Promise<QuoteLineDto> {
    void tenantId;
    this.assertDraft(quoteId);
    const position = this.linesOf(quoteId).length;
    const now = new Date().toISOString();
    const stored: StoredQuoteLine = {
      id: fakeQuoteUuid(),
      quote_id: quoteId,
      origin: line.origin,
      project_item_id: line.projectItemId,
      label: line.label,
      product_config: line.productConfig,
      quantity: line.quantity,
      position,
      production_price: line.productionPrice,
      public_price: line.publicPrice,
      customer_price: line.customerPrice,
      applied_margin_rate: line.appliedMarginRate,
      applied_rule_id: line.appliedRuleId,
      sale_price: line.salePrice,
      sale_margin_rate: line.saleMarginRate,
      discount_rate: line.discountRate,
      margin_variation: line.marginVariation,
      breakdown: [...line.breakdown],
      warnings: [],
      created_at: now,
      chiffrage_quantity: line.chiffrageQuantity,
    };
    this.lines.set(stored.id, stored);
    this.pushAudit({
      quote_id: quoteId,
      quote_line_id: stored.id,
      change_set_id: fakeQuoteUuid(),
      action: 'added',
      field: null,
      previous_value: null,
      new_value: null,
      line_snapshot: stored as unknown as Readonly<Record<string, unknown>>,
      actor_id: null,
      actor_label: null,
    });
    this.touchQuoteUpdatedAt(quoteId);
    return toDto(stored);
  }

  async updateLine(
    tenantId: TenantId,
    quoteId: string,
    lineId: string,
    update: QuoteLineWriteUpdate,
  ): Promise<QuoteLineDto> {
    void tenantId;
    this.assertDraft(quoteId);
    const current = this.lines.get(lineId);
    if (!current || current.quote_id !== quoteId) throw new QuoteLineNotFoundError();

    const next: StoredQuoteLine = { ...current };
    const changeSetId = fakeQuoteUuid();

    if (update.quantity !== undefined && update.quantity !== current.quantity) {
      this.pushAudit({
        quote_id: quoteId,
        quote_line_id: lineId,
        change_set_id: changeSetId,
        action: 'updated',
        field: 'quantity',
        previous_value: String(current.quantity),
        new_value: String(update.quantity),
        line_snapshot: null,
        actor_id: null,
        actor_label: null,
      });
      next.quantity = update.quantity;
    }
    if (update.salePrice !== undefined && update.salePrice !== current.sale_price) {
      this.pushAudit({
        quote_id: quoteId,
        quote_line_id: lineId,
        change_set_id: changeSetId,
        action: 'updated',
        field: 'sale_price',
        previous_value: current.sale_price,
        new_value: update.salePrice,
        line_snapshot: null,
        actor_id: null,
        actor_label: null,
      });
      next.sale_price = update.salePrice;
    }
    if (update.saleMarginRate !== undefined) next.sale_margin_rate = update.saleMarginRate;
    if (update.discountRate !== undefined && update.discountRate !== current.discount_rate) {
      this.pushAudit({
        quote_id: quoteId,
        quote_line_id: lineId,
        change_set_id: changeSetId,
        action: 'updated',
        field: 'discount_rate',
        previous_value: current.discount_rate,
        new_value: update.discountRate,
        line_snapshot: null,
        actor_id: null,
        actor_label: null,
      });
      next.discount_rate = update.discountRate;
    }
    if (
      update.marginVariation !== undefined &&
      update.marginVariation !== current.margin_variation
    ) {
      this.pushAudit({
        quote_id: quoteId,
        quote_line_id: lineId,
        change_set_id: changeSetId,
        action: 'updated',
        field: 'margin_variation',
        previous_value: current.margin_variation,
        new_value: update.marginVariation,
        line_snapshot: null,
        actor_id: null,
        actor_label: null,
      });
      next.margin_variation = update.marginVariation;
    }

    this.lines.set(lineId, next);
    this.touchQuoteUpdatedAt(quoteId);
    return toDto(next);
  }

  async removeLine(tenantId: TenantId, quoteId: string, lineId: string): Promise<void> {
    void tenantId;
    this.assertDraft(quoteId);
    const current = this.lines.get(lineId);
    if (!current || current.quote_id !== quoteId) throw new QuoteLineNotFoundError();

    const changeSetId = fakeQuoteUuid();
    this.lines.delete(lineId);
    this.pushAudit({
      quote_id: quoteId,
      quote_line_id: lineId,
      change_set_id: changeSetId,
      action: 'removed',
      field: null,
      previous_value: null,
      new_value: null,
      line_snapshot: current as unknown as Readonly<Record<string, unknown>>,
      actor_id: null,
      actor_label: null,
    });

    // Resserre les positions des lignes restantes, MEME change_set_id que le
    // retrait (une seule requete logique) — meme discipline que
    // `api_delete_commercial_quote_line`.
    const remaining = [...this.lines.values()]
      .filter((line) => line.quote_id === quoteId)
      .sort((a, b) => a.position - b.position);
    remaining.forEach((line, index) => {
      if (line.position !== index) {
        this.pushAudit({
          quote_id: quoteId,
          quote_line_id: line.id,
          change_set_id: changeSetId,
          action: 'reordered',
          field: 'position',
          previous_value: String(line.position),
          new_value: String(index),
          line_snapshot: null,
          actor_id: null,
          actor_label: null,
        });
        this.lines.set(line.id, { ...line, position: index });
      }
    });
    this.touchQuoteUpdatedAt(quoteId);
  }

  async reorderLines(
    tenantId: TenantId,
    quoteId: string,
    lineIds: readonly string[],
  ): Promise<QuoteDetailDto> {
    this.assertDraft(quoteId);
    const existing = [...this.lines.values()].filter((line) => line.quote_id === quoteId);
    const existingIds = new Set(existing.map((line) => line.id));
    const requestedIds = new Set(lineIds);
    if (
      lineIds.length !== existing.length ||
      requestedIds.size !== lineIds.length ||
      [...requestedIds].some((id) => !existingIds.has(id))
    ) {
      throw new QuoteLinePositionsMismatchError();
    }

    const changeSetId = fakeQuoteUuid();
    // B1 — comme le trigger SQL reel (`where l.position <> ranked.new_position`,
    // qui ne s execute QUE sur les lignes reellement mises a jour), `updated_at`
    // n avance que si AU MOINS une ligne a effectivement change de position :
    // un reordonnancement demande qui reproduit l ordre courant n ecrit rien.
    let anyPositionChanged = false;
    lineIds.forEach((id, index) => {
      const line = this.lines.get(id)!;
      if (line.position !== index) {
        anyPositionChanged = true;
        this.pushAudit({
          quote_id: quoteId,
          quote_line_id: id,
          change_set_id: changeSetId,
          action: 'reordered',
          field: 'position',
          previous_value: String(line.position),
          new_value: String(index),
          line_snapshot: null,
          actor_id: null,
          actor_label: null,
        });
        this.lines.set(id, { ...line, position: index });
      }
    });
    if (anyPositionChanged) this.touchQuoteUpdatedAt(quoteId);

    const detail = await this.findDetailById(tenantId, quoteId);
    if (!detail) throw new QuoteNotFoundError();
    return detail;
  }

  async listLineAuditEntries(
    tenantId: TenantId,
    params: ListQuoteLineAuditParams,
  ): Promise<ListQuoteLineAuditResult> {
    void tenantId;
    let rows = this.auditEntries
      .filter((entry) => entry.quote_id === params.quoteId)
      .filter((entry) => !params.lineId || entry.quote_line_id === params.lineId)
      .sort((a, b) => {
        if (a.occurred_at !== b.occurred_at) return a.occurred_at < b.occurred_at ? 1 : -1;
        if (a.id === b.id) return 0;
        return a.id < b.id ? 1 : -1;
      });

    if (params.cursor) {
      const cursor = params.cursor;
      rows = rows.filter((entry) => isStrictlyAfterCursor({ sort: entry.occurred_at, id: entry.id }, cursor));
    }
    return { rows: rows.slice(0, params.size + 1) };
  }
}

/** `StoredQuoteLine` -> `QuoteLineDto` : recalcule `warnings` a chaque lecture, jamais stocke. */
function toDto(line: StoredQuoteLine): QuoteLineDto {
  const { chiffrage_quantity, ...rest } = line;
  return {
    ...rest,
    warnings: computeQuoteLineWarnings({
      origin: line.origin,
      quantity: line.quantity,
      chiffrageQuantity: chiffrage_quantity,
      salePrice: line.sale_price,
      productionPrice: line.production_price,
    }),
  };
}

function itemsInvalidError(): QuoteCommandRejectedError {
  return new QuoteCommandRejectedError(
    'quote.items_invalid',
    'Un ou plusieurs elements ne correspondent pas a ce projet.',
    [{ field: 'item_ids', message: 'Un ou plusieurs elements ne correspondent pas a ce projet.' }],
  );
}

export {
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
};
