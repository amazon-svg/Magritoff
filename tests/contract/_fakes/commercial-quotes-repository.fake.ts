/**
 * Faux repository Devis commerciaux (E10.3, E10.9), sur le meme principe que
 * `projects-repository.fake.ts` (E10.1) : partage entre les tests de
 * contrat, jamais reecrit a la main deux fois (leçon du sprint —
 * docs/api/CONVENTIONS.md, un faux non teste qui diverge de l adaptateur
 * reel passe le typecheck sans etre detecte).
 *
 * ── Point critique : la numerotation DOIT etre atomique, meme en memoire ──
 * `createFromProjectItems()` lit puis ecrit le compteur SANS aucun `await`
 * entre les deux : sous Node/JS (boucle d evenements a un seul thread), deux
 * appels lances via `Promise.all` s executent en fait en SERIE tant qu aucun
 * point de suspension (`await`) ne coupe la section critique. Introduire un
 * `await` entre la lecture et l ecriture du compteur (ex. pour "simuler" un
 * appel reseau) reintroduirait exactement le risque de doublon que la vraie
 * fonction Postgres evite par le verrou de ligne de l UPSERT — et le test de
 * contrat qui exerce des creations concurrentes (voir
 * commercial-quotes.contract.test.ts) cesserait de passer.
 *
 * ── E10.9 — ce que ce faux reimplemente fidelement, pas seulement type ────
 * - La garde "devis brouillon" (`quote_line.quote_not_draft`) sur TOUTE
 *   ecriture de ligne, meme discipline que le trigger BEFORE de la migration
 *   `20260904000100_gescom_e10_9_quote_line_discounts.sql`.
 * - Le journal d audit APPEND-ONLY, une entree PAR CHAMP PERSISTE change,
 *   regroupees par `change_set_id` PAR APPEL (une resequence issue d un
 *   retrait ou d un reordonnancement partage un seul `change_set_id`, comme
 *   le fait le trigger via `magrit.change_set_id` positionne par les
 *   fonctions `api_delete_commercial_quote_line`/
 *   `api_reorder_commercial_quote_lines`).
 * - Les alertes (`warnings`) calculees par `computeQuoteLineWarnings()`, LA
 *   MEME fonction que l adaptateur Supabase (aucune reimplementation
 *   divergente possible).
 */
import type { TenantId, UserId } from '@/kernel';
import type { ProjectDto, ProjectItemDto } from '@/modules/projects/api/contracts';
import type { ProjectsRepository } from '@/modules/projects/application/projects-repository';
import { computeQuoteLineWarnings } from '@/modules/commercial-quotes/application/quote-line-pricing';
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
  type QuoteLineAuditRow,
  type QuoteLineWriteUpdate,
} from '@/modules/commercial-quotes/application/commercial-quotes-repository';
import type {
  CreateQuoteFromProjectCommand,
  QuoteDetailDto,
  QuoteDto,
  QuoteLineDto,
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
function compareCreatedAtThenIdDesc(a: QuoteDto, b: QuoteDto): number {
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
 * Ligne stockee : superset de `QuoteLineDto` avec `chiffrage_quantity`
 * (colonne interne, jamais publiee au contrat — sert uniquement a calculer
 * l alerte `production_cost_stale`, meme discipline que la colonne reelle).
 */
type StoredQuoteLine = QuoteLineDto & { chiffrage_quantity: number | null };

/** `occurred_at` STRICTEMENT croissant : deux entrees d audit nees dans la meme milliseconde de test doivent quand meme se departager. */
let lastAuditTimestampMs = 0;
function monotonicIsoTimestamp(): string {
  lastAuditTimestampMs = Math.max(Date.now(), lastAuditTimestampMs + 1);
  return new Date(lastAuditTimestampMs).toISOString();
}

export class InMemoryCommercialQuotesRepository implements CommercialQuotesRepository {
  private readonly quotes = new Map<string, QuoteDto>();
  private readonly lines = new Map<string, StoredQuoteLine>();
  private readonly auditEntries: QuoteLineAuditRow[] = [];
  /** Compteur par `${tenantId}:${year}`, meme portee que commercial_quote_number_counters. */
  private readonly counters = new Map<string, number>();
  /** Role de l acteur par tenant, pour `findActorTenantRole` (E10.9 CA garde admin). `admin` par defaut. */
  private readonly actorRoles = new Map<string, 'admin' | 'member'>();

  constructor(private readonly projects: ProjectsRepository) {}

  /** TEST UNIQUEMENT — force le role d un acteur pour exercer la garde 403 `identity.role_required`. */
  setActorRoleForTest(tenantId: string, actorId: string, role: 'admin' | 'member' | null): void {
    const key = `${tenantId}:${actorId}`;
    if (role === null) this.actorRoles.delete(key);
    else this.actorRoles.set(key, role);
  }

  async findActorTenantRole(tenantId: TenantId, actorId: UserId): Promise<'admin' | 'member' | null> {
    return this.actorRoles.get(`${tenantId}:${actorId}`) ?? 'admin';
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
    return { rows: rows.slice(0, params.size + 1) };
  }

  async findById(tenantId: TenantId, quoteId: string): Promise<QuoteDto | null> {
    const found = this.quotes.get(quoteId);
    return found && found.tenant_id === tenantId ? found : null;
  }

  async findDetailById(tenantId: TenantId, quoteId: string): Promise<QuoteDetailDto | null> {
    const quote = await this.findById(tenantId, quoteId);
    if (!quote) return null;
    const lines = this.linesOf(quoteId);
    return { ...quote, lines };
  }

  private linesOf(quoteId: string): QuoteLineDto[] {
    return [...this.lines.values()]
      .filter((line) => line.quote_id === quoteId)
      .sort((a, b) => a.position - b.position)
      .map((line) => toDto(line));
  }

  private assertDraft(quoteId: string): QuoteDto {
    const quote = this.quotes.get(quoteId);
    if (!quote) throw new QuoteNotFoundError();
    if (quote.status !== 'draft') throw new QuoteLineQuoteNotDraftError();
    return quote;
  }

  private pushAudit(
    entry: Omit<QuoteLineAuditRow, 'id' | 'occurred_at'>,
  ): void {
    this.auditEntries.push({
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
    const quote: QuoteDto = {
      id: fakeQuoteUuid(),
      tenant_id: tenantId,
      customer_id: project.customer_id,
      project_id: command.project_id,
      number,
      status: 'draft',
      valid_until: null,
      show_discounts: false,
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
      // E10.3 (avant E10.9) ne valorisait aucun prix de vente. Depuis E10.9,
      // le contrat l exige : cette voie de creation historique (par
      // `createQuoteFromProject`) est SANS marge/regle (pas de PriceRulesService
      // injecte ici, hors perimetre de ce chemin) — memes bornes que le
      // backfill SQL de la migration 20260904000100 (marge/regle absentes ->
      // 0.0000, customer_price = production_price). `addLine`, lui, appelle
      // reellement PriceRulesService + PricingEngine (voir plus bas).
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
    const current = await this.findById(tenantId, quoteId);
    if (!current) throw new QuoteNotFoundError();
    const updated: QuoteDto = {
      ...current,
      ...('valid_until' in command && command.valid_until !== undefined
        ? { valid_until: command.valid_until }
        : {}),
      ...('show_discounts' in command && command.show_discounts !== undefined
        ? { show_discounts: command.show_discounts }
        : {}),
      updated_at: new Date().toISOString(),
    };
    this.quotes.set(quoteId, updated);
    return updated;
  }

  /**
   * TEST UNIQUEMENT — aucune route n expose de transition de statut dans
   * cette story (E10.12, future). Permet d exercer le refus CA6 de
   * `remove()` sur un devis non brouillon sans attendre cette story future.
   */
  forceStatusForTest(quoteId: string, status: QuoteDto['status']): void {
    const current = this.quotes.get(quoteId);
    if (!current) throw new Error(`devis ${quoteId} introuvable (forceStatusForTest)`);
    this.quotes.set(quoteId, { ...current, status });
  }

  async remove(tenantId: TenantId, quoteId: string): Promise<void> {
    const current = await this.findById(tenantId, quoteId);
    if (!current) throw new QuoteNotFoundError();
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
    lineIds.forEach((id, index) => {
      const line = this.lines.get(id)!;
      if (line.position !== index) {
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
};
