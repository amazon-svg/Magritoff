/**
 * Faux repository Devis commerciaux (E10.3), sur le meme principe que
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
 */
import type { TenantId, UserId } from '@/kernel';
import type { ProjectDto, ProjectItemDto } from '@/modules/projects/api/contracts';
import type { ProjectsRepository } from '@/modules/projects/application/projects-repository';
import {
  QuoteCommandRejectedError,
  QuoteDeleteRequiresDraftError,
  QuoteNotFoundError,
  QuoteProjectNotFoundError,
  type CommercialQuotesRepository,
  type ListQuotesParams,
  type ListQuotesResult,
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
  row: QuoteDto,
  cursor: Readonly<{ sort: string; id: string }>,
): boolean {
  if (row.created_at < cursor.sort) return true;
  if (row.created_at > cursor.sort) return false;
  return row.id < cursor.id;
}

export class InMemoryCommercialQuotesRepository implements CommercialQuotesRepository {
  private readonly quotes = new Map<string, QuoteDto>();
  private readonly lines = new Map<string, QuoteLineDto>();
  /** Compteur par `${tenantId}:${year}`, meme portee que commercial_quote_number_counters. */
  private readonly counters = new Map<string, number>();

  constructor(private readonly projects: ProjectsRepository) {}

  async list(tenantId: TenantId, params: ListQuotesParams): Promise<ListQuotesResult> {
    let rows = [...this.quotes.values()]
      .filter((q) => q.tenant_id === tenantId)
      .filter((q) => !params.customerId || q.customer_id === params.customerId)
      .filter((q) => !params.projectId || q.project_id === params.projectId)
      .filter((q) => !params.status || q.status === params.status)
      .sort(compareCreatedAtThenIdDesc);

    if (params.cursor) {
      const cursor = params.cursor;
      rows = rows.filter((q) => isStrictlyAfterCursor(q, cursor));
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
    const lines = [...this.lines.values()]
      .filter((line) => line.quote_id === quoteId)
      .sort((a, b) => a.position - b.position);
    return { ...quote, lines };
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
      const line: QuoteLineDto = {
        id: fakeQuoteUuid(),
        quote_id: quote.id,
        project_item_id: item.id,
        label: item.label,
        product_config: payload,
        quantity,
        position: index,
        production_price: production,
        public_price: null,
        customer_price: null,
        applied_margin_rate: null,
        applied_rule_id: null,
        breakdown: [],
        created_at: now,
      };
      this.lines.set(line.id, line);
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
  QuoteNotFoundError,
  QuoteProjectNotFoundError,
};
