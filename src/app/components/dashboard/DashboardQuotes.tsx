import { useMemo, useState } from 'react';
import { FileText, Download, Search, MoreHorizontal, Pencil, Copy, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useQuotes, QuoteRecord } from '../../contexts/QuotesContext';
import { useTenantPath } from '../../hooks/useTenantPath';
import {
  QUOTE_STATUS_GROUPS,
  QuoteStatusGroup,
  statusGroup,
  statusGroupDef,
} from '../../utils/quoteStatus';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { TEST_IDS } from '../../lib/testIds';

// Design source : .design-handoff/designs/04 - Admin dashboard.html
// Pattern : Linear-dense — KPIs inline + sparklines + filtres segmentes + table compacte.
// S-QUOTES-5 : branche sur QuotesContext (scope mine/all + actions ligne).

const T = TEST_IDS.quoteLib;

type FilterKey = 'all' | QuoteStatusGroup;

export function DashboardQuotes() {
  const { user } = useAuth();
  const tp = useTenantPath();
  const navigate = useNavigate();
  const { quotes, loading, scope, canViewAll, setScope, duplicateQuote, deleteQuote } = useQuotes();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<QuoteRecord | null>(null);
  const showOwner = scope === 'all' && canViewAll;

  // ─── KPIs calcules depuis quotes ────────────────────────────────────────
  const kpis = useMemo(() => {
    const now = Date.now();
    const d7 = now - 7 * 86400_000;
    const d30 = now - 30 * 86400_000;

    const inProgress = quotes
      .filter((q) => statusGroup(q.status) === 'en_cours')
      .reduce((s, q) => s + (q.total_ttc || 0), 0);

    const last30 = quotes.filter((q) => new Date(q.created_at).getTime() >= d30);
    const won30 = last30.filter((q) => statusGroup(q.status) === 'valide').length;
    const convRate = last30.length > 0 ? Math.round((won30 / last30.length) * 100) : 0;

    const avgBasket =
      quotes.length > 0 ? quotes.reduce((s, q) => s + (q.total_ttc || 0), 0) / quotes.length : 0;

    const newLast7 = quotes.filter((q) => new Date(q.created_at).getTime() >= d7).length;

    const sparkDays = Array.from({ length: 7 }, (_, i) => {
      const dayStart = now - (6 - i) * 86400_000;
      const dayEnd = dayStart + 86400_000;
      return quotes.filter((q) => {
        const t = new Date(q.created_at).getTime();
        return t >= dayStart && t < dayEnd;
      }).length;
    });
    const maxSpark = Math.max(1, ...sparkDays);

    return { inProgress, convRate, avgBasket, newLast7, sparkDays, maxSpark };
  }, [quotes]);

  // ─── Quotes filtres ──────────────────────────────────────────────────────
  const visible = useMemo(() => {
    return quotes.filter((q) => {
      if (filter !== 'all' && statusGroup(q.status) !== filter) return false;
      if (search.trim()) {
        const needle = search.toLowerCase();
        const hay = `${q.reference} ${q.product_name} ${q.client_name ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [quotes, filter, search]);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: quotes.length, en_cours: 0, valide: 0, rejete: 0 };
    for (const q of quotes) c[statusGroup(q.status)]++;
    return c;
  }, [quotes]);

  const handleDuplicate = async (id: string) => {
    const newId = await duplicateQuote(id);
    if (newId) navigate(tp(`/dashboard/quotes/${newId}/edit`));
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    await deleteQuote(toDelete.id);
    setToDelete(null);
  };

  const filterDefs: Array<{ key: FilterKey; label: string }> = [
    { key: 'all', label: 'Tous' },
    { key: 'en_cours', label: 'En cours' },
    { key: 'valide', label: 'Validé' },
    { key: 'rejete', label: 'Rejeté' },
  ];

  return (
    <div data-testid={T.page} className="max-w-[1400px]" style={{ fontFamily: 'var(--font-ui)' }}>
      {/* ── Titre + actions ─────────────────────────────────────────────── */}
      <div className="flex items-baseline justify-between gap-4 mb-6">
        <h1
          className="text-ink m-0"
          style={{ fontWeight: 300, fontSize: '34px', letterSpacing: '-0.025em', lineHeight: 1.05 }}
        >
          Devis
        </h1>
        <div className="flex items-center gap-2">
          {canViewAll && (
            <div className="inline-flex rounded-md border border-line overflow-hidden">
              <button
                data-testid={T.scopeToggleMine}
                onClick={() => setScope('mine')}
                className={`px-2.5 py-1.5 ${scope === 'mine' ? 'bg-ink text-paper' : 'bg-paper text-ink-muted hover:text-ink'}`}
                style={{ fontSize: '12.5px', fontWeight: scope === 'mine' ? 500 : 400 }}
              >
                Mes devis
              </button>
              <button
                data-testid={T.scopeToggleAll}
                onClick={() => setScope('all')}
                className={`px-2.5 py-1.5 border-l border-line ${scope === 'all' ? 'bg-ink text-paper' : 'bg-paper text-ink-muted hover:text-ink'}`}
                style={{ fontSize: '12.5px', fontWeight: scope === 'all' ? 500 : 400 }}
              >
                Tous (équipe)
              </button>
            </div>
          )}
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line bg-paper text-ink-2 hover:bg-bg"
            style={{ fontSize: '13px', fontWeight: 400 }}
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
            Exporter
          </button>
          <Link
            to={tp('/dashboard/quote-templates')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line bg-paper text-ink-2 hover:bg-bg"
            style={{ fontSize: '13px', fontWeight: 400 }}
          >
            Gabarits
          </Link>
        </div>
      </div>

      {/* ── KPIs inline + sparklines ────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-px bg-line border border-line rounded-md overflow-hidden mb-5">
        <Kpi label="En cours" value={`${kpis.inProgress.toFixed(0)} €`} delta={`+${kpis.newLast7} · 7j`} deltaPositive spark={kpis.sparkDays} max={kpis.maxSpark} />
        <Kpi label="Taux conversion" value={`${kpis.convRate}%`} delta="30 j" deltaPositive={kpis.convRate >= 50} spark={kpis.sparkDays} max={kpis.maxSpark} />
        <Kpi label="Panier moyen" value={`${kpis.avgBasket.toFixed(0)} €`} delta={`${quotes.length} devis`} deltaPositive spark={kpis.sparkDays} max={kpis.maxSpark} />
        <Kpi label="Devis récents" value={String(kpis.newLast7)} delta="7 j" deltaPositive spark={kpis.sparkDays} max={kpis.maxSpark} />
      </div>

      {/* ── Filtres segmentes + search ──────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {filterDefs.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors ${
                active ? 'bg-ink text-paper border-ink' : 'bg-paper text-ink-muted border-line hover:text-ink hover:border-line-2'
              }`}
              style={{ fontSize: '12.5px', fontWeight: active ? 500 : 400 }}
            >
              {f.label}
              <span className={`font-mono ${active ? 'opacity-70' : 'text-ink-mute-2'}`} style={{ fontSize: '11px', fontWeight: 500 }}>
                {counts[f.key]}
              </span>
            </button>
          );
        })}
        <div className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-line bg-paper min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-ink-mute-2" strokeWidth={1.5} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une référence, un produit, un client…"
            className="flex-1 bg-transparent outline-none text-ink placeholder:text-ink-mute-2"
            style={{ fontSize: '12.5px', fontWeight: 400 }}
          />
        </div>
      </div>

      {/* ── Table compacte ──────────────────────────────────────────────── */}
      <div className="border border-line rounded-md overflow-hidden bg-paper">
        {loading ? (
          <div className="py-12 text-center text-ink-muted" style={{ fontSize: '13px' }}>Chargement…</div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center text-ink-mute-2">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" strokeWidth={1.5} />
            <p style={{ fontSize: '13.5px', fontWeight: 400 }}>
              {quotes.length === 0 ? "Aucun devis pour l'instant." : 'Aucun résultat pour ce filtre.'}
            </p>
          </div>
        ) : (
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="border-b border-line bg-bg">
                {['N°', 'Client', 'Produit', ...(showOwner ? ['Émetteur'] : []), 'Montant HT', 'Montant TTC', 'État', 'Créé', ''].map((h, i) => (
                  <th
                    key={i}
                    className="text-left px-4 py-2 font-mono uppercase text-ink-muted"
                    style={{ fontSize: '10.5px', fontWeight: 500, letterSpacing: '0.06em' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((q) => {
                const st = statusGroupDef(q.status);
                return (
                  <tr key={q.id} data-testid={T.row} className="border-b border-line hover:bg-bg transition-colors">
                    <td className="px-4 py-2 font-mono text-ink" style={{ fontSize: '12.5px', fontWeight: 500 }}>
                      <Link to={tp(`/dashboard/quotes/${q.id}/edit`)} className="hover:underline">
                        {q.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-ink-2" style={{ fontSize: '13px' }}>
                      {q.client_name || <span className="text-ink-mute-2">—</span>}
                    </td>
                    <td className="px-4 py-2 text-ink-2" style={{ fontSize: '13px' }}>{q.product_name}</td>
                    {showOwner && (
                      <td className="px-4 py-2 text-ink-muted font-mono" style={{ fontSize: '11.5px' }}>
                        {q.user_id === user?.id ? 'Moi' : q.user_id.slice(0, 8)}
                      </td>
                    )}
                    <td className="px-4 py-2 font-mono text-ink tabular-nums" style={{ fontSize: '12.5px', fontWeight: 500 }}>
                      {(q.total_ht ?? 0).toFixed(2)} €
                    </td>
                    <td className="px-4 py-2 font-mono text-ink tabular-nums" style={{ fontSize: '12.5px', fontWeight: 500 }}>
                      {(q.total_ttc ?? 0).toFixed(2)} €
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex font-mono px-2 py-0.5 rounded ${st.cls}`} style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.02em' }}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-ink-muted" style={{ fontSize: '12px' }}>
                      {new Date(q.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            data-testid={T.rowMenuBtn}
                            className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-line"
                            aria-label="Actions"
                          >
                            <MoreHorizontal className="w-4 h-4" strokeWidth={1.5} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            data-testid={T.rowMenuEdit}
                            onSelect={() => navigate(tp(`/dashboard/quotes/${q.id}/edit`))}
                          >
                            <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                            Éditer
                          </DropdownMenuItem>
                          <DropdownMenuItem data-testid={T.rowMenuDuplicate} onSelect={() => handleDuplicate(q.id)}>
                            <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                            Dupliquer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            data-testid={T.rowMenuDelete}
                            variant="destructive"
                            onSelect={() => setToDelete(q)}
                          >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!loading && visible.length > 0 && (
        <div className="mt-3 flex items-center justify-between font-mono text-ink-mute-2" style={{ fontSize: '11px', letterSpacing: '0.04em' }}>
          <span>{visible.length} / {quotes.length} devis</span>
          <span>Tri par date ↓</span>
        </div>
      )}

      {/* ── Confirmation suppression ────────────────────────────────────── */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent data-testid={T.deleteDialog}>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce devis ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le devis {toDelete?.reference} et toutes ses lignes seront définitivement supprimés. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction data-testid={T.deleteConfirmBtn} onClick={confirmDelete}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── KPI card (inline avec sparkline) ─────────────────────────────────────
function Kpi({
  label,
  value,
  delta,
  deltaPositive,
  spark,
  max,
}: {
  label: string;
  value: string;
  delta: string;
  deltaPositive?: boolean;
  spark: number[];
  max: number;
}) {
  return (
    <div className="bg-paper p-4">
      <div className="font-mono uppercase text-ink-muted mb-1.5" style={{ fontSize: '10.5px', letterSpacing: '0.06em', fontWeight: 500 }}>
        {label}
      </div>
      <div className="text-ink tabular-nums" style={{ fontSize: '24px', fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div className="flex items-end justify-between gap-3 mt-2.5">
        <span className="font-mono" style={{ fontSize: '11px', fontWeight: 500, color: deltaPositive ? 'var(--ok-fg)' : 'var(--err-fg)' }}>
          {delta}
        </span>
        <div className="flex items-end gap-[2px] h-4">
          {spark.map((n, i) => (
            <span
              key={i}
              className="w-[4px] rounded-[1px]"
              style={{ height: `${(n / max) * 100}%`, minHeight: '2px', background: i === spark.length - 1 ? 'var(--brand)' : 'var(--line-2)' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
