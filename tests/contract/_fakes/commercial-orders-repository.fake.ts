/**
 * Faux repository Commandes de gestion commerciale (E10.12), sur le meme
 * principe que `commercial-quotes-repository.fake.ts` : partage entre les
 * tests de contrat, jamais reecrit a la main deux fois.
 *
 * ── Delegation au faux CommercialQuotesRepository, PAS de reimplementation ──
 * La transition du DEVIS source (`sent`/`accepted` -> `converted`, garde de
 * statut, audit d entete) est deja reimplementee fidelement par
 * `InMemoryCommercialQuotesRepository.applyConversionForTest()` — CE faux ne
 * fait QUE construire la commande et ses lignes a partir du resultat qu elle
 * rend, exactement comme l adaptateur Supabase delegue la meme transition a
 * `api_convert_commercial_quote()` et se contente de lire ensuite ce que
 * cette fonction a ecrit.
 */
import type { TenantId, UserId } from '@/kernel';
import { computeQuoteTotals } from '@/modules/commercial-quotes/application/quote-totals';
import type { TaxRegimeDto } from '@/modules/commercial-quotes/api/contracts';
import type {
  CommercialOrderDetailDto,
  CommercialOrderDto,
  CommercialOrderLineDto,
} from '@/modules/commercial-orders/api/contracts';
import {
  QuoteConversionForbiddenStatusError,
  type CommercialOrdersRepository,
  type ListCommercialOrdersParams,
  type ListCommercialOrdersResult,
} from '@/modules/commercial-orders/application/commercial-orders-repository';
import type { InMemoryCommercialQuotesRepository } from './commercial-quotes-repository.fake.ts';

let sequence = 0;
/** UUID v4 valide : le 4e groupe DOIT commencer par 8/9/a/b (bits de variant RFC 4122) — jamais `c`. */
function fakeOrderUuid(): string {
  sequence += 1;
  return `00000000-0000-4000-a000-${String(sequence).padStart(12, '0')}`;
}

type StoredOrder = CommercialOrderDto;

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
  ascending: boolean,
): boolean {
  if (ascending) {
    if (row.sort > cursor.sort) return true;
    if (row.sort < cursor.sort) return false;
    return row.id > cursor.id;
  }
  if (row.sort < cursor.sort) return true;
  if (row.sort > cursor.sort) return false;
  return row.id < cursor.id;
}

export class InMemoryCommercialOrdersRepository implements CommercialOrdersRepository {
  private readonly orders = new Map<string, StoredOrder>();
  private readonly lines = new Map<string, CommercialOrderLineDto[]>();
  private readonly counters = new Map<string, number>();
  /** `tenants.tax_regime` par tenant. Absent = `metropole_fr` (meme defaut que le faux Devis). */
  private readonly tenantTaxRegimes = new Map<string, TaxRegimeDto>();
  /**
   * E10.13 CA6 — position d une etape de production, TEST UNIQUEMENT : ce
   * faux ne connait pas `production_steps`, un scenario qui exerce
   * `sort=production_step` doit la poser explicitement. Absente -> traitee
   * comme « sans etape », toujours en dernier (meme regle que la fonction SQL
   * `list_commercial_orders_by_production_step`).
   */
  private readonly stepPositions = new Map<string, number>();

  constructor(private readonly quotes: InMemoryCommercialQuotesRepository) {}

  /** TEST UNIQUEMENT — meme regime fiscal que celui pose sur le faux Devis (`setTenantTaxRegimeForTest`). */
  setTenantTaxRegimeForTest(tenantId: string, regime: TaxRegimeDto): void {
    this.tenantTaxRegimes.set(tenantId, regime);
  }

  /** TEST UNIQUEMENT — position d une etape, pour exercer `sort=production_step`. */
  setStepPositionForTest(stepId: string, position: number): void {
    this.stepPositions.set(stepId, position);
  }

  /** TEST UNIQUEMENT — pose l etape courante d une commande deja creee (ce faux ne la pose jamais a la conversion). */
  setCurrentProductionStepIdForTest(orderId: string, stepId: string | null): void {
    const current = this.orders.get(orderId);
    if (!current) return;
    this.orders.set(orderId, { ...current, current_production_step_id: stepId });
  }

  async list(tenantId: TenantId, params: ListCommercialOrdersParams): Promise<ListCommercialOrdersResult> {
    let rows = [...this.orders.values()]
      .filter((o) => o.tenant_id === tenantId)
      .filter((o) => !params.customerId || o.customer_id === params.customerId)
      .filter((o) => !params.quoteId || o.quote_id === params.quoteId)
      .filter((o) => !params.status || o.status === params.status)
      .filter((o) => !params.currentProductionStepId || o.current_production_step_id === params.currentProductionStepId);

    if (params.sort === 'production_step' || params.sort === '-production_step') {
      const descending = params.sort === '-production_step';
      const positionOf = (o: StoredOrder): number | null =>
        o.current_production_step_id === null ? null : (this.stepPositions.get(o.current_production_step_id) ?? null);
      rows = rows.sort((a, b) => {
        const pa = positionOf(a);
        const pb = positionOf(b);
        // Nulls TOUJOURS en dernier, dans les DEUX sens (meme regle que la
        // fonction SQL).
        if (pa === null && pb === null) return compareCreatedAtThenIdDesc(a, b);
        if (pa === null) return 1;
        if (pb === null) return -1;
        if (pa !== pb) return descending ? pb - pa : pa - pb;
        return compareCreatedAtThenIdDesc(a, b);
      });
      if (params.cursor) {
        const cursor = params.cursor;
        const separator = cursor.sort.lastIndexOf('|');
        const cursorStepId = separator === -1 ? null : cursor.sort.slice(0, separator) || null;
        const cursorCreatedAt = separator === -1 ? cursor.sort : cursor.sort.slice(separator + 1);
        const cursorPosition = cursorStepId === null ? null : (this.stepPositions.get(cursorStepId) ?? null);
        rows = rows.filter((o) => {
          const position = positionOf(o);
          if (cursorPosition === null) {
            return (
              position === null &&
              isStrictlyAfterCursor({ sort: o.created_at, id: o.id }, { sort: cursorCreatedAt, id: cursor.id }, false)
            );
          }
          if (position === null) return false;
          if (position !== cursorPosition) return descending ? position < cursorPosition : position > cursorPosition;
          return isStrictlyAfterCursor({ sort: o.created_at, id: o.id }, { sort: cursorCreatedAt, id: cursor.id }, false);
        });
      }
      return { rows: rows.slice(0, params.size + 1) };
    }

    const ascending = params.sort === 'created_at';
    rows = rows.sort((a, b) => (ascending ? -compareCreatedAtThenIdDesc(a, b) : compareCreatedAtThenIdDesc(a, b)));

    if (params.cursor) {
      const cursor = params.cursor;
      rows = rows.filter((o) => isStrictlyAfterCursor({ sort: o.created_at, id: o.id }, cursor, ascending));
    }
    return { rows: rows.slice(0, params.size + 1) };
  }

  async findById(tenantId: TenantId, orderId: string): Promise<CommercialOrderDto | null> {
    const found = this.orders.get(orderId);
    return found && found.tenant_id === tenantId ? found : null;
  }

  async findDetailById(tenantId: TenantId, orderId: string): Promise<CommercialOrderDetailDto | null> {
    const order = await this.findById(tenantId, orderId);
    if (!order) return null;
    return { ...order, lines: this.lines.get(orderId) ?? [] };
  }

  async convertQuote(tenantId: TenantId, actor: UserId, quoteId: string): Promise<CommercialOrderDetailDto> {
    const applied = this.quotes.applyConversionForTest(tenantId, quoteId, actor);
    if (!applied) throw new QuoteConversionForbiddenStatusError();

    const detail = await this.quotes.findDetailById(tenantId, quoteId);
    if (!detail) throw new Error('devis introuvable juste apres sa conversion (faux repository)');

    const totals = computeQuoteTotals({
      linesSubtotal: detail.totals.lines_subtotal,
      globalDiscountRate: detail.global_discount_rate,
      targetNetTotal: detail.target_net_total,
      quoteVatRateOverride: detail.vat_rate,
      tenantTaxRegime: this.tenantTaxRegimes.get(tenantId) ?? 'metropole_fr',
    });

    const year = new Date().getUTCFullYear();
    const counterKey = `${tenantId}:${year}`;
    const next = (this.counters.get(counterKey) ?? 0) + 1;
    this.counters.set(counterKey, next);
    const number = `CDE-${year}-${String(next).padStart(5, '0')}`;

    const now = new Date().toISOString();
    const orderId = fakeOrderUuid();
    const order: StoredOrder = {
      id: orderId,
      tenant_id: tenantId,
      customer_id: detail.customer_id,
      quote_id: quoteId,
      number,
      status: 'validated',
      source_quote_status: applied.sourceStatus,
      // E10.13 — ce faux ne modelise pas `production_steps` : `null` est un
      // etat CONTRACTUELLEMENT valide (tenant sans etape active). Un
      // scenario qui exerce la pose de l etape initiale passe par
      // `setCurrentProductionStepIdForTest()` ci-dessus ; le comportement
      // REEL (etape active de position la plus basse, cote SQL) est verifie
      // par tests/sql/gescom-e10-13-production-steps.sql, pas ici.
      current_production_step_id: null,
      totals,
      created_by: actor,
      created_at: now,
      updated_at: now,
    };
    this.orders.set(orderId, order);

    const orderLines: CommercialOrderLineDto[] = detail.lines.map((line) => ({
      id: fakeOrderUuid(),
      order_id: orderId,
      source_quote_line_id: line.id,
      origin: line.origin,
      label: line.label,
      product_config: line.product_config,
      quantity: line.quantity,
      position: line.position,
      production_price: line.production_price,
      public_price: line.public_price,
      customer_price: line.customer_price,
      applied_margin_rate: line.applied_margin_rate,
      applied_rule_id: line.applied_rule_id,
      sale_price: line.sale_price,
      sale_margin_rate: line.sale_margin_rate,
      discount_rate: line.discount_rate,
      margin_variation: line.margin_variation,
      breakdown: line.breakdown,
      created_at: now,
    }));
    this.lines.set(orderId, orderLines);

    return { ...order, lines: orderLines };
  }
}
