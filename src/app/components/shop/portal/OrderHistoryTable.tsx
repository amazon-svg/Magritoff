/**
 * OrderHistoryTable — composant reutilisable pour afficher un historique de
 * commandes filtrable + triable (Story S3.1 Sprint 5).
 *
 * Consomme :
 *  - PortalOrders.tsx (acheteur sur /shop/<slug>/orders)
 *  - DashboardOrders.tsx (admin tenant sur /dashboard/orders, avec extraColumn
 *    Boutique)
 *
 * Le composant est PUR cote data : il recoit `orders: OrderUI[]` deja
 * fetches + normalises par le parent. Il gere uniquement l etat UI local
 * (filtres + tri + persistence localStorage).
 *
 * Filtres :
 *  - Statut : multi-select sur les statuts presents dans les orders
 *  - Periode : preset (Tous / 7j / 30j / 90j / Cette annee) + custom range
 *  - Montant HT min : input numerique optionnel
 *
 * Tri : click sur header colonne triable (Date / Total HT / Total TTC),
 * toggle asc/desc/none avec indicateur visuel + aria-sort (a11y).
 *
 * Persistence : si `persistKey` fourni, sauvegarde filtres + tri dans
 * localStorage. Restauration au mount, fallback safe si corrompu.
 */

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Ban, Loader2, Package, RotateCcw, RotateCw } from 'lucide-react';
import type { OrderUI } from './PortalOrders.helpers';
import { getStatusInfo, type OrderStatus } from '../../../lib/orderStatus';
import { TEST_IDS } from '../../../lib/testIds';

// ─── Types ────────────────────────────────────────────────────────────────

/**
 * Colonnes triables natives (toujours presentes dans OrderUI).
 * 'extra' est un cas dynamique : le tri delegue a ExtraColumn.sortValue.
 */
export type SortableColumn = 'date' | 'customer_name' | 'total_ht' | 'total_ttc' | 'extra';
export type SortDirection = 'asc' | 'desc';

export type PeriodPreset = 'all' | '7d' | '30d' | '90d' | 'year' | 'custom';

export interface ExtraColumn {
  /** Label header colonne (ex: 'Boutique'). */
  header: string;
  /** Render fn pour la cellule. */
  render: (order: OrderUI) => ReactNode;
  /** Position : 'before-status' (defaut) ou 'after-date'. */
  position?: 'before-status' | 'after-date';
  /**
   * Si fournie, rend la colonne triable. Le composant trie via cette fn
   * (cas DashboardOrders : sortValue = shopSlugById.get(o.shop_id) pour trier
   * par boutique alors que `shop_id` n'est pas dans OrderUI natif).
   */
  sortValue?: (order: OrderUI) => string | number;
}

export interface OrderHistoryTableProps {
  /** Orders deja fetches + normalises par le parent. */
  orders: OrderUI[];
  /** Loading state remonte par le parent. */
  loading?: boolean;
  /** Erreur remontee par le parent. */
  error?: string | null;
  /** Colonne supplementaire (cas DashboardOrders avec Boutique). */
  extraColumn?: ExtraColumn;
  /** Cle localStorage pour persistance filtres + tri (optionnel). */
  persistKey?: string;
  /**
   * S3.3 (Sprint 5) : callback Renouveler 1-clic. Si fourni, une colonne
   * Actions affiche un bouton 'Renouveler' sur chaque ligne eligible
   * (cohort v1.1 + status != draft/cancelled). Le parent (PortalOrders →
   * PublicShop) implemente la logique : query items + rebuild cart +
   * view='cart'. Si omis (cas DashboardOrders admin), pas de colonne
   * Actions affichee.
   */
  onRenewOrder?: (order: OrderUI) => void | Promise<void>;
  /**
   * S3.4 (Sprint 5) : callback Annuler. Si fourni, un bouton 'Annuler'
   * apparait sur les lignes en statut draft (cohort v1.1 uniquement —
   * le RPC update_tenant_order_status ne s'applique pas a shop_orders
   * legacy). Le parent ouvre le CancelOrderConfirmDialog avec orderId.
   */
  onCancelOrder?: (order: OrderUI) => void | Promise<void>;
}

interface TableState {
  selectedStatuses: OrderStatus[]; // [] = tous
  period: PeriodPreset;
  customDateFrom: string; // ISO date (YYYY-MM-DD), vide si pas custom
  customDateTo: string;
  amountMinHt: string; // input controle (string pour gerer vide)
  sortBy: SortableColumn;
  sortDir: SortDirection;
}

const DEFAULT_STATE: TableState = {
  selectedStatuses: [],
  period: 'all',
  customDateFrom: '',
  customDateTo: '',
  amountMinHt: '',
  sortBy: 'date',
  sortDir: 'desc',
};

// ─── Utils ────────────────────────────────────────────────────────────────

function formatEuro(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function periodToCutoffMs(period: PeriodPreset): number | null {
  const now = Date.now();
  switch (period) {
    case '7d':
      return now - 7 * 86_400_000;
    case '30d':
      return now - 30 * 86_400_000;
    case '90d':
      return now - 90 * 86_400_000;
    case 'year': {
      const startYear = new Date(new Date().getFullYear(), 0, 1).getTime();
      return startYear;
    }
    default:
      return null;
  }
}

function loadState(key: string | undefined): TableState {
  if (!key || typeof window === 'undefined') return { ...DEFAULT_STATE };
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<TableState>;
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState(key: string | undefined, state: TableState): void {
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // localStorage plein / desactive : silent fail
  }
}

// ─── Filtrage + tri (extraits purs, testables) ───────────────────────────

export function applyFilters(orders: OrderUI[], state: TableState): OrderUI[] {
  let result = orders;

  // Filtre statut (si selection non vide)
  if (state.selectedStatuses.length > 0) {
    const set = new Set(state.selectedStatuses);
    result = result.filter((o) => set.has(o.status as OrderStatus));
  }

  // Filtre periode preset
  if (state.period !== 'all' && state.period !== 'custom') {
    const cutoff = periodToCutoffMs(state.period);
    if (cutoff !== null) {
      result = result.filter((o) => new Date(o.date).getTime() >= cutoff);
    }
  }

  // Filtre periode custom (date range)
  if (state.period === 'custom') {
    if (state.customDateFrom) {
      const from = new Date(state.customDateFrom).getTime();
      result = result.filter((o) => new Date(o.date).getTime() >= from);
    }
    if (state.customDateTo) {
      // inclusif fin de journee
      const to = new Date(state.customDateTo + 'T23:59:59').getTime();
      result = result.filter((o) => new Date(o.date).getTime() <= to);
    }
  }

  // Filtre montant min
  const min = parseFloat(state.amountMinHt);
  if (Number.isFinite(min) && min > 0) {
    result = result.filter((o) => o.total_ht >= min);
  }

  return result;
}

export function applySort(
  orders: OrderUI[],
  state: TableState,
  extraSortValue?: (o: OrderUI) => string | number,
): OrderUI[] {
  const sorted = [...orders];
  const dir = state.sortDir === 'asc' ? 1 : -1;
  // Collator fr pour comparer strings (Client, Boutique) en respectant les
  // accents et la casse insensible (Etienne ~ etienne ~ Étienne).
  const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
  sorted.sort((a, b) => {
    switch (state.sortBy) {
      case 'date':
        return (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir;
      case 'customer_name':
        return collator.compare(a.customer_name ?? '', b.customer_name ?? '') * dir;
      case 'total_ht':
        return (a.total_ht - b.total_ht) * dir;
      case 'total_ttc':
        return (a.total_ttc - b.total_ttc) * dir;
      case 'extra': {
        if (!extraSortValue) return 0;
        const va = extraSortValue(a);
        const vb = extraSortValue(b);
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
        return collator.compare(String(va), String(vb)) * dir;
      }
      default:
        return 0;
    }
  });
  return sorted;
}

// ─── Composant ────────────────────────────────────────────────────────────

export function OrderHistoryTable({
  orders,
  loading = false,
  error = null,
  extraColumn,
  persistKey,
  onRenewOrder,
  onCancelOrder,
}: OrderHistoryTableProps) {
  // S3.3 : une commande est renouvelable si v1.1 + status workflow/terminal
  // (pas draft = rien à renouveler depuis un brouillon, pas cancelled =
  // pas de re-commande depuis une commande abandonnée). Legacy non éligible
  // (items inline JSONB sans product_id stable).
  const RENEWABLE_STATUSES = new Set([
    'validated',
    'in_production',
    'shipped',
    'delivered',
    'invoiced',
  ]);
  const canRenew = (o: OrderUI) =>
    !!onRenewOrder && o.source === 'v1_1' && RENEWABLE_STATUSES.has(o.status);

  // S3.4 : une commande est annulable si v1.1 + status draft (RPC restreint
  // les transitions, ne propose pas autre chose en v1.1).
  const canCancel = (o: OrderUI) =>
    !!onCancelOrder && o.source === 'v1_1' && o.status === 'draft';

  // Affiche la colonne Actions si au moins un callback est fourni.
  const showActionsColumn = !!onRenewOrder || !!onCancelOrder;
  const [state, setState] = useState<TableState>(() => loadState(persistKey));

  useEffect(() => {
    saveState(persistKey, state);
  }, [persistKey, state]);

  // Statuts presents dans les orders (pour limiter le multi-select aux
  // statuts effectivement representes).
  const availableStatuses = useMemo<OrderStatus[]>(() => {
    const set = new Set<string>();
    for (const o of orders) set.add(o.status);
    return Array.from(set) as OrderStatus[];
  }, [orders]);

  const filtered = useMemo(() => applyFilters(orders, state), [orders, state]);
  const sorted = useMemo(
    () => applySort(filtered, state, extraColumn?.sortValue),
    [filtered, state, extraColumn?.sortValue],
  );

  const isFiltered =
    state.selectedStatuses.length > 0 ||
    state.period !== 'all' ||
    state.amountMinHt.trim() !== '';

  function resetFilters() {
    setState((s) => ({
      ...DEFAULT_STATE,
      sortBy: s.sortBy,
      sortDir: s.sortDir,
    }));
  }

  function toggleStatus(status: OrderStatus) {
    setState((s) => {
      const has = s.selectedStatuses.includes(status);
      return {
        ...s,
        selectedStatuses: has
          ? s.selectedStatuses.filter((x) => x !== status)
          : [...s.selectedStatuses, status],
      };
    });
  }

  function handleSortClick(col: SortableColumn) {
    setState((s) => {
      if (s.sortBy !== col) return { ...s, sortBy: col, sortDir: 'asc' };
      if (s.sortDir === 'asc') return { ...s, sortDir: 'desc' };
      // 3e click meme colonne : retour defaults
      return { ...s, sortBy: 'date', sortDir: 'desc' };
    });
  }

  function ariaSortFor(col: SortableColumn): 'ascending' | 'descending' | 'none' {
    if (state.sortBy !== col) return 'none';
    return state.sortDir === 'asc' ? 'ascending' : 'descending';
  }

  function SortIndicator({ col }: { col: SortableColumn }) {
    if (state.sortBy !== col) return null;
    return state.sortDir === 'asc' ? (
      <ArrowUp className="inline w-3 h-3 ml-1" strokeWidth={2} aria-hidden="true" />
    ) : (
      <ArrowDown className="inline w-3 h-3 ml-1" strokeWidth={2} aria-hidden="true" />
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ink-muted">
        <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
        <span style={{ fontSize: '13px' }}>Chargement…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-err-bg border border-err-fg/20 text-err-fg"
        style={{ fontSize: '13px', fontWeight: 400 }}
      >
        Erreur : {error}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-16">
        <Package className="w-10 h-10 text-ink-mute-2 mx-auto mb-3" strokeWidth={1.2} />
        <p className="text-ink-muted m-0" style={{ fontSize: '14px', lineHeight: 1.55 }}>
          Aucune commande pour le moment.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* ─── Barre de filtres ──────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-end gap-4 mb-5 pb-4 border-b border-line"
        style={{ fontSize: '12.5px' }}
      >
        {/* Filtre Statut */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="order-filter-status"
            className="font-mono uppercase text-ink-mute-2"
            style={{ fontSize: '10px', letterSpacing: '0.08em', fontWeight: 500 }}
          >
            Statut
          </label>
          <div className="flex flex-wrap gap-1.5" id="order-filter-status">
            {availableStatuses.map((status) => {
              const info = getStatusInfo(status);
              const active = state.selectedStatuses.includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleStatus(status)}
                  data-testid={TEST_IDS.shop.orderFilterStatus}
                  data-status={status}
                  aria-pressed={active}
                  className={`inline-flex items-center px-2 py-1 rounded border font-mono uppercase transition-colors ${
                    active
                      ? info.className
                      : 'bg-paper text-ink-muted border-line hover:border-ink-mute-2'
                  }`}
                  style={{ fontSize: '10px', letterSpacing: '0.06em', fontWeight: 500 }}
                >
                  {info.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filtre Periode */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="order-filter-period-select"
            className="font-mono uppercase text-ink-mute-2"
            style={{ fontSize: '10px', letterSpacing: '0.08em', fontWeight: 500 }}
          >
            Période
          </label>
          <select
            id="order-filter-period-select"
            data-testid={TEST_IDS.shop.orderFilterPeriod}
            value={state.period}
            onChange={(e) => setState((s) => ({ ...s, period: e.target.value as PeriodPreset }))}
            className="px-2 py-1 border border-line rounded bg-paper text-ink"
            style={{ fontSize: '12.5px' }}
          >
            <option value="all">Toutes</option>
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
            <option value="90d">90 derniers jours</option>
            <option value="year">Cette année</option>
            <option value="custom">Personnalisée…</option>
          </select>
        </div>

        {state.period === 'custom' && (
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="order-filter-date-from"
                className="font-mono uppercase text-ink-mute-2"
                style={{ fontSize: '10px', letterSpacing: '0.08em', fontWeight: 500 }}
              >
                Du
              </label>
              <input
                id="order-filter-date-from"
                type="date"
                value={state.customDateFrom}
                onChange={(e) =>
                  setState((s) => ({ ...s, customDateFrom: e.target.value }))
                }
                className="px-2 py-1 border border-line rounded bg-paper text-ink"
                style={{ fontSize: '12.5px' }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="order-filter-date-to"
                className="font-mono uppercase text-ink-mute-2"
                style={{ fontSize: '10px', letterSpacing: '0.08em', fontWeight: 500 }}
              >
                Au
              </label>
              <input
                id="order-filter-date-to"
                type="date"
                value={state.customDateTo}
                onChange={(e) =>
                  setState((s) => ({ ...s, customDateTo: e.target.value }))
                }
                className="px-2 py-1 border border-line rounded bg-paper text-ink"
                style={{ fontSize: '12.5px' }}
              />
            </div>
          </div>
        )}

        {/* Filtre Montant min */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="order-filter-amount-min"
            className="font-mono uppercase text-ink-mute-2"
            style={{ fontSize: '10px', letterSpacing: '0.08em', fontWeight: 500 }}
          >
            Montant HT ≥
          </label>
          <input
            id="order-filter-amount-min"
            type="number"
            min="0"
            step="10"
            placeholder="€"
            value={state.amountMinHt}
            onChange={(e) =>
              setState((s) => ({ ...s, amountMinHt: e.target.value }))
            }
            data-testid={TEST_IDS.shop.orderFilterAmountMin}
            className="px-2 py-1 border border-line rounded bg-paper text-ink w-24 font-mono"
            style={{ fontSize: '12.5px', fontVariantNumeric: 'tabular-nums' }}
          />
        </div>

        {/* Bouton Reset */}
        {isFiltered && (
          <button
            type="button"
            onClick={resetFilters}
            data-testid={TEST_IDS.shop.orderFilterReset}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-line bg-paper text-ink-muted hover:text-ink hover:border-ink-mute-2 transition-colors"
            style={{ fontSize: '12px' }}
          >
            <RotateCcw className="w-3 h-3" strokeWidth={2} aria-hidden="true" />
            Réinitialiser
          </button>
        )}

        {/* Compteur */}
        <div
          className="ml-auto text-ink-muted font-mono"
          style={{ fontSize: '11.5px', fontVariantNumeric: 'tabular-nums' }}
        >
          {sorted.length} / {orders.length} commande{orders.length > 1 ? 's' : ''}
        </div>
      </div>

      {/* ─── Empty state filtre ───────────────────────────────────────── */}
      {sorted.length === 0 && (
        <div className="text-center py-12" data-testid={TEST_IDS.shop.orderFilteredEmpty}>
          <p className="text-ink-muted m-0 mb-3" style={{ fontSize: '14px', lineHeight: 1.55 }}>
            Aucune commande ne correspond aux filtres.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-line bg-paper text-ink-muted hover:text-ink hover:border-ink-mute-2 transition-colors"
            style={{ fontSize: '12.5px' }}
          >
            <RotateCcw className="w-3 h-3" strokeWidth={2} aria-hidden="true" />
            Réinitialiser les filtres
          </button>
        </div>
      )}

      {/* ─── Table ────────────────────────────────────────────────────── */}
      {sorted.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ fontSize: '13px' }}>
            <thead>
              <tr className="border-b border-line">
                <th
                  scope="col"
                  aria-sort={ariaSortFor('date')}
                  className="py-2.5 pr-4 font-mono uppercase text-ink-mute-2"
                  style={{ fontSize: '10.5px', letterSpacing: '0.08em', fontWeight: 500 }}
                >
                  <button
                    type="button"
                    onClick={() => handleSortClick('date')}
                    data-testid={TEST_IDS.shop.orderSortHeaderDate}
                    className="inline-flex items-center hover:text-ink transition-colors"
                  >
                    Date
                    <SortIndicator col="date" />
                  </button>
                </th>
                {extraColumn?.position === 'after-date' && (
                  <th
                    scope="col"
                    aria-sort={extraColumn.sortValue ? ariaSortFor('extra') : undefined}
                    className="py-2.5 pr-4 font-mono uppercase text-ink-mute-2"
                    style={{ fontSize: '10.5px', letterSpacing: '0.08em', fontWeight: 500 }}
                  >
                    {extraColumn.sortValue ? (
                      <button
                        type="button"
                        onClick={() => handleSortClick('extra')}
                        data-testid={TEST_IDS.shop.orderSortHeaderExtra}
                        className="inline-flex items-center hover:text-ink transition-colors"
                      >
                        {extraColumn.header}
                        <SortIndicator col="extra" />
                      </button>
                    ) : (
                      extraColumn.header
                    )}
                  </th>
                )}
                <th
                  scope="col"
                  aria-sort={ariaSortFor('customer_name')}
                  className="py-2.5 pr-4 font-mono uppercase text-ink-mute-2"
                  style={{ fontSize: '10.5px', letterSpacing: '0.08em', fontWeight: 500 }}
                >
                  <button
                    type="button"
                    onClick={() => handleSortClick('customer_name')}
                    data-testid={TEST_IDS.shop.orderSortHeaderClient}
                    className="inline-flex items-center hover:text-ink transition-colors"
                  >
                    Client
                    <SortIndicator col="customer_name" />
                  </button>
                </th>
                <th
                  scope="col"
                  className="py-2.5 pr-4 font-mono uppercase text-ink-mute-2"
                  style={{ fontSize: '10.5px', letterSpacing: '0.08em', fontWeight: 500 }}
                >
                  Articles
                </th>
                <th
                  scope="col"
                  aria-sort={ariaSortFor('total_ht')}
                  className="py-2.5 pr-4 font-mono uppercase text-ink-mute-2 text-right"
                  style={{ fontSize: '10.5px', letterSpacing: '0.08em', fontWeight: 500 }}
                >
                  <button
                    type="button"
                    onClick={() => handleSortClick('total_ht')}
                    data-testid={TEST_IDS.shop.orderSortHeaderTotalHt}
                    className="inline-flex items-center hover:text-ink transition-colors"
                  >
                    Total HT
                    <SortIndicator col="total_ht" />
                  </button>
                </th>
                <th
                  scope="col"
                  aria-sort={ariaSortFor('total_ttc')}
                  className="py-2.5 pr-4 font-mono uppercase text-ink-mute-2 text-right"
                  style={{ fontSize: '10.5px', letterSpacing: '0.08em', fontWeight: 500 }}
                >
                  <button
                    type="button"
                    onClick={() => handleSortClick('total_ttc')}
                    data-testid={TEST_IDS.shop.orderSortHeaderTotalTtc}
                    className="inline-flex items-center hover:text-ink transition-colors"
                  >
                    Total TTC
                    <SortIndicator col="total_ttc" />
                  </button>
                </th>
                {(extraColumn?.position === 'before-status' || (extraColumn && !extraColumn.position)) && (
                  <th
                    scope="col"
                    aria-sort={extraColumn.sortValue ? ariaSortFor('extra') : undefined}
                    className="py-2.5 pr-4 font-mono uppercase text-ink-mute-2"
                    style={{ fontSize: '10.5px', letterSpacing: '0.08em', fontWeight: 500 }}
                  >
                    {extraColumn.sortValue ? (
                      <button
                        type="button"
                        onClick={() => handleSortClick('extra')}
                        data-testid={TEST_IDS.shop.orderSortHeaderExtra}
                        className="inline-flex items-center hover:text-ink transition-colors"
                      >
                        {extraColumn.header}
                        <SortIndicator col="extra" />
                      </button>
                    ) : (
                      extraColumn.header
                    )}
                  </th>
                )}
                <th
                  scope="col"
                  className="py-2.5 font-mono uppercase text-ink-mute-2"
                  style={{ fontSize: '10.5px', letterSpacing: '0.08em', fontWeight: 500 }}
                >
                  Statut
                </th>
                {showActionsColumn && (
                  <th
                    scope="col"
                    className="py-2.5 font-mono uppercase text-ink-mute-2 text-right"
                    style={{ fontSize: '10.5px', letterSpacing: '0.08em', fontWeight: 500 }}
                  >
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((o) => {
                const itemsCount = o.items.reduce((s, it) => s + (it.qty ?? 1), 0);
                const linesCount = o.items.length;
                const statusInfo = getStatusInfo(o.status);
                return (
                  <tr
                    key={o.id}
                    data-testid={TEST_IDS.shop.ordersRow}
                    data-order-id={o.id}
                    data-order-source={o.source}
                    className="border-b border-line hover:bg-bg transition-colors"
                  >
                    <td
                      className="py-3 pr-4 text-ink-2 font-mono"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatDate(o.date)}
                    </td>
                    {extraColumn?.position === 'after-date' && (
                      <td className="py-3 pr-4 text-ink-muted">{extraColumn.render(o)}</td>
                    )}
                    <td className="py-3 pr-4 text-ink">{o.customer_name || '—'}</td>
                    <td className="py-3 pr-4 text-ink-muted">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-line bg-paper text-ink-2"
                        style={{ fontSize: '11.5px' }}
                      >
                        {linesCount} ligne{linesCount > 1 ? 's' : ''} · {itemsCount} ex.
                      </span>
                    </td>
                    <td
                      className="py-3 pr-4 text-ink font-mono text-right"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatEuro(o.total_ht)}
                    </td>
                    <td
                      className="py-3 pr-4 text-ink font-mono text-right font-medium"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatEuro(o.total_ttc)}
                    </td>
                    {(extraColumn?.position === 'before-status' || (extraColumn && !extraColumn.position)) && (
                      <td className="py-3 pr-4 text-ink-muted">{extraColumn.render(o)}</td>
                    )}
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {o.source === 'legacy' && (
                          <>
                            <span
                              className="bg-ink-mute-2 w-1.5 h-1.5 rounded-full shrink-0"
                              aria-hidden="true"
                              title="Commande antérieure au 17/05/2026 (modèle legacy)"
                              data-testid={TEST_IDS.shop.ordersRowLegacyMarker}
                            />
                            <span className="sr-only">Commande au format antérieur. </span>
                          </>
                        )}
                        <span
                          aria-label={`Statut: ${statusInfo.label}`}
                          className={`inline-block px-2 py-0.5 rounded border font-mono uppercase ${statusInfo.className}`}
                          style={{ fontSize: '10px', letterSpacing: '0.06em', fontWeight: 500 }}
                        >
                          {statusInfo.label}
                        </span>
                      </div>
                    </td>
                    {showActionsColumn && (
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {canRenew(o) && (
                            <button
                              type="button"
                              onClick={() => onRenewOrder?.(o)}
                              data-testid={TEST_IDS.shop.orderRenewBtn}
                              data-order-id={o.id}
                              aria-label={`Renouveler la commande ${o.id}`}
                              title="Renouveler cette commande (pré-remplit le panier)"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-line bg-paper text-ink-muted hover:text-ink hover:border-ink-mute-2 transition-colors"
                              style={{ fontSize: '11.5px' }}
                            >
                              <RotateCw className="w-3 h-3" strokeWidth={2} aria-hidden="true" />
                              Renouveler
                            </button>
                          )}
                          {canCancel(o) && (
                            <button
                              type="button"
                              onClick={() => onCancelOrder?.(o)}
                              data-testid={TEST_IDS.shop.orderCancelBtn}
                              data-order-id={o.id}
                              aria-label={`Annuler la commande draft ${o.id}`}
                              title="Annuler cette commande (statut draft uniquement)"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-err-fg/30 bg-paper text-err-fg hover:bg-err-bg transition-colors"
                              style={{ fontSize: '11.5px' }}
                            >
                              <Ban className="w-3 h-3" strokeWidth={2} aria-hidden="true" />
                              Annuler
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
