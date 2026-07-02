/**
 * DashboardQuoteEditor (S-QUOTES-3)
 * ─────────────────────────────────
 * Editeur d'un devis multi-lignes. Route : dashboard/quotes/:id/edit.
 *
 * - Nom client editable
 * - Tableau des lignes : quantite, cout HT (lecture seule), prix vente HT,
 *   marge % (desactivee si cout 0), total ; reordonnancement Monter/Descendre ;
 *   suppression ; ajout de ligne
 * - Synchro live prix <-> marge (quoteMath, markup sur cout)
 * - Totaux HT / TVA / TTC recalcules live
 * - Selecteur de gabarit + statut (En cours / Validé / Rejeté)
 * - Impression (renderQuoteHtml + openQuotePrint)
 * - Sauvegarde (saveQuote : reecrit les lignes + entete)
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Printer, Save, Trash2 } from 'lucide-react';
import { useQuotes, QuoteLineDraft, QuoteWithLines } from '../../contexts/QuotesContext';
import { useQuoteTemplates } from '../../contexts/QuoteTemplatesContext';
import { useTenant } from '../../contexts/TenantContext';
import { useTenantPath } from '../../hooks/useTenantPath';
import {
  getDefaultTemplate,
  openQuotePrint,
  renderQuoteHtml,
} from '../../utils/quote';
import {
  applyTax,
  extractTaxAmount,
  formatTaxLabel,
  getTaxRate,
} from '../../utils/tax';
import {
  isMarginEditable,
  lineTotal,
  marginFromPrice,
  priceFromMargin,
  round2,
  sumLinesHT,
} from '../../utils/quoteMath';
import {
  QUOTE_STATUS_GROUPS,
  QuoteStatusGroup,
  statusGroup,
  storeValueForGroup,
} from '../../utils/quoteStatus';
import { TEST_IDS } from '../../lib/testIds';

const T = TEST_IDS.quoteLib;

export function DashboardQuoteEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const tp = useTenantPath();
  const { getQuote, saveQuote } = useQuotes();
  const { templates, defaultTemplateId } = useQuoteTemplates();
  const { currentTenant } = useTenant();
  const taxRate = getTaxRate(currentTenant);

  const [head, setHead] = useState<QuoteWithLines | null>(null);
  const [clientName, setClientName] = useState('');
  const [statusG, setStatusG] = useState<QuoteStatusGroup>('en_cours');
  const [lines, setLines] = useState<QuoteLineDraft[]>([]);
  const [templateId, setTemplateId] = useState<string>('builtin-classique');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    if (!id) return;
    setLoading(true);
    getQuote(id).then((q) => {
      if (!alive) return;
      if (q) {
        setHead(q);
        setClientName(q.client_name ?? '');
        setStatusG(statusGroup(q.status));
        setLines(
          q.lines.map((l) => ({
            id: l.id,
            product_name: l.product_name,
            product_config: l.product_config,
            quantity: l.quantity,
            unit_cost_ht: l.unit_cost_ht,
            unit_price_ht: l.unit_price_ht,
            margin_pct: l.margin_pct,
            line_total_ht: l.line_total_ht,
            position: l.position,
          }))
        );
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [id, getQuote]);

  useEffect(() => {
    setTemplateId(defaultTemplateId ?? 'builtin-classique');
  }, [defaultTemplateId]);

  const effectiveTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) ?? getDefaultTemplate(),
    [templates, templateId]
  );

  // ─── Mutations de lignes (synchro prix <-> marge) ──────────────────────────
  const mutateLine = (idx: number, patch: Partial<QuoteLineDraft>) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const next = { ...l, ...patch };
        next.line_total_ht = lineTotal(next.quantity, next.unit_price_ht);
        return next;
      })
    );
  };

  const onQtyChange = (idx: number, raw: string) => {
    const q = Math.max(1, Math.round(Number(raw) || 1));
    mutateLine(idx, { quantity: q });
  };

  const onPriceChange = (idx: number, raw: string) => {
    const price = round2(Number(raw) || 0);
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const margin = marginFromPrice(l.unit_cost_ht, price);
        return {
          ...l,
          unit_price_ht: price,
          margin_pct: margin,
          line_total_ht: lineTotal(l.quantity, price),
        };
      })
    );
  };

  const onMarginChange = (idx: number, raw: string) => {
    const margin = round2(Number(raw) || 0);
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const price = priceFromMargin(l.unit_cost_ht, margin);
        return {
          ...l,
          margin_pct: margin,
          unit_price_ht: price,
          line_total_ht: lineTotal(l.quantity, price),
        };
      })
    );
  };

  const moveLine = (idx: number, dir: 'up' | 'down') => {
    setLines((prev) => {
      const j = dir === 'up' ? idx - 1 : idx + 1;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const deleteLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        product_name: 'Nouvelle ligne',
        product_config: null,
        quantity: 1,
        unit_cost_ht: 0,
        unit_price_ht: 0,
        margin_pct: 0,
        line_total_ht: 0,
        position: prev.length,
      },
    ]);
  };

  // ─── Totaux live ───────────────────────────────────────────────────────────
  const totalHT = useMemo(() => sumLinesHT(lines), [lines]);
  const tva = round2(extractTaxAmount(totalHT, taxRate));
  const totalTTC = round2(applyTax(totalHT, taxRate));

  // ─── Actions ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    await saveQuote(id, {
      client_name: clientName.trim() || null,
      status: storeValueForGroup(statusG),
      lines,
    });
    setSaving(false);
    setSavedAt(Date.now());
  };

  const handlePrint = () => {
    if (!head) return;
    const body = renderQuoteHtml({
      template: effectiveTemplate,
      reference: head.reference,
      client: clientName.trim() ? { company: clientName.trim() } : null,
      taxRate,
      items: lines.map((l) => ({
        name: l.product_name,
        quantity: l.quantity,
        priceHT: l.line_total_ht,
      })),
    });
    openQuotePrint(effectiveTemplate, body, `Devis ${head.reference}`);
  };

  // ─── Rendu ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="py-12 text-center text-ink-muted" style={{ fontSize: '13px' }}>
        Chargement du devis…
      </div>
    );
  }

  if (!head) {
    return (
      <div className="py-16 text-center text-ink-mute-2">
        <p style={{ fontSize: '14px' }}>Devis introuvable.</p>
        <Link to={tp('/dashboard/quotes')} className="text-ink underline" style={{ fontSize: '13px' }}>
          Retour a la bibliotheque
        </Link>
      </div>
    );
  }

  return (
    <div
      data-testid={T.editorPage}
      className="max-w-[1100px]"
      style={{ fontFamily: 'var(--font-ui)' }}
    >
      {/* Header */}
      <div className="flex items-baseline justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link
            to={tp('/dashboard/quotes')}
            className="p-1.5 rounded-md border border-line bg-paper text-ink-muted hover:text-ink hover:bg-bg"
            aria-label="Retour"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          </Link>
          <div>
            <h1
              className="text-ink m-0"
              style={{ fontWeight: 300, fontSize: '28px', letterSpacing: '-0.025em', lineHeight: 1.1 }}
            >
              Devis {head.reference}
            </h1>
            <p className="text-ink-mute-2 font-mono mt-0.5" style={{ fontSize: '11.5px' }}>
              {new Date(head.created_at).toLocaleDateString('fr-FR')}
              {savedAt ? ' · enregistré' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid={T.editorPrintBtn}
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line bg-paper text-ink-2 hover:bg-bg"
            style={{ fontSize: '13px', fontWeight: 400 }}
          >
            <Printer className="w-3.5 h-3.5" strokeWidth={1.5} />
            Imprimer
          </button>
          <button
            data-testid={T.editorSaveBtn}
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ink text-paper hover:bg-black disabled:opacity-50"
            style={{ fontSize: '13px', fontWeight: 500 }}
          >
            <Save className="w-3.5 h-3.5" strokeWidth={1.8} />
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Meta : client / gabarit / statut */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div>
          <label className="block text-ink-muted mb-1" style={{ fontSize: '11.5px', fontWeight: 500 }}>
            Nom du client
          </label>
          <input
            data-testid={T.editorClientNameInput}
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Société / destinataire"
            className="w-full px-2.5 py-1.5 border border-line rounded-lg bg-paper text-ink focus:outline-none focus:border-line-2"
            style={{ fontSize: '13px' }}
          />
        </div>
        <div>
          <label className="block text-ink-muted mb-1" style={{ fontSize: '11.5px', fontWeight: 500 }}>
            Gabarit
          </label>
          <select
            data-testid={T.editorTemplateSelect}
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-line rounded-lg bg-paper text-ink focus:outline-none focus:border-line-2"
            style={{ fontSize: '13px' }}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.builtin ? '★ ' : ''}
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-ink-muted mb-1" style={{ fontSize: '11.5px', fontWeight: 500 }}>
            Statut
          </label>
          <select
            data-testid={T.editorStatusSelect}
            value={statusG}
            onChange={(e) => setStatusG(e.target.value as QuoteStatusGroup)}
            className="w-full px-2.5 py-1.5 border border-line rounded-lg bg-paper text-ink focus:outline-none focus:border-line-2"
            style={{ fontSize: '13px' }}
          >
            {QUOTE_STATUS_GROUPS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table des lignes */}
      <div className="border border-line rounded-md overflow-hidden bg-paper">
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="border-b border-line bg-bg">
              {['Produit', 'Qté', 'Coût HT', 'Prix vente HT', 'Marge %', 'Total HT', ''].map((h, i) => (
                <th
                  key={i}
                  className="text-left px-3 py-2 font-mono uppercase text-ink-muted"
                  style={{ fontSize: '10.5px', fontWeight: 500, letterSpacing: '0.06em' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-ink-mute-2" style={{ fontSize: '13px' }}>
                  Aucune ligne. Ajoutez-en une ci-dessous.
                </td>
              </tr>
            ) : (
              lines.map((l, idx) => {
                const marginOk = isMarginEditable(l.unit_cost_ht);
                return (
                  <tr key={l.id ?? `new-${idx}`} data-testid={T.editorLineRow} className="border-b border-line">
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={l.product_name}
                        onChange={(e) => mutateLine(idx, { product_name: e.target.value })}
                        className="w-full min-w-[160px] px-2 py-1 border border-transparent hover:border-line rounded bg-transparent text-ink-2 focus:outline-none focus:border-line-2 focus:bg-paper"
                        style={{ fontSize: '13px' }}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        data-testid={T.editorLineQuantityInput}
                        type="number"
                        min={1}
                        value={l.quantity}
                        onChange={(e) => onQtyChange(idx, e.target.value)}
                        className="w-[72px] px-2 py-1 border border-line rounded bg-paper text-ink font-mono text-right focus:outline-none focus:border-line-2"
                        style={{ fontSize: '12.5px' }}
                      />
                    </td>
                    <td className="px-3 py-1.5 font-mono text-ink-muted tabular-nums" style={{ fontSize: '12.5px' }}>
                      {l.unit_cost_ht.toFixed(2)} €
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        data-testid={T.editorLinePriceInput}
                        type="number"
                        step="0.01"
                        min={0}
                        value={l.unit_price_ht}
                        onChange={(e) => onPriceChange(idx, e.target.value)}
                        className="w-[96px] px-2 py-1 border border-line rounded bg-paper text-ink font-mono text-right focus:outline-none focus:border-line-2"
                        style={{ fontSize: '12.5px' }}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        data-testid={T.editorLineMarginInput}
                        type="number"
                        step="0.1"
                        value={l.margin_pct}
                        disabled={!marginOk}
                        onChange={(e) => onMarginChange(idx, e.target.value)}
                        title={marginOk ? undefined : 'Coût inconnu : marge non calculable, éditez le prix'}
                        className="w-[76px] px-2 py-1 border border-line rounded bg-paper text-ink font-mono text-right focus:outline-none focus:border-line-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ fontSize: '12.5px' }}
                      />
                    </td>
                    <td className="px-3 py-1.5 font-mono text-ink tabular-nums" style={{ fontSize: '12.5px', fontWeight: 500 }}>
                      {l.line_total_ht.toFixed(2)} €
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-0.5 justify-end">
                        <button
                          data-testid={T.editorLineMoveUp}
                          onClick={() => moveLine(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 rounded text-ink-muted hover:text-ink hover:bg-bg disabled:opacity-30"
                          aria-label="Monter"
                        >
                          <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.8} />
                        </button>
                        <button
                          data-testid={T.editorLineMoveDown}
                          onClick={() => moveLine(idx, 'down')}
                          disabled={idx === lines.length - 1}
                          className="p-1 rounded text-ink-muted hover:text-ink hover:bg-bg disabled:opacity-30"
                          aria-label="Descendre"
                        >
                          <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.8} />
                        </button>
                        <button
                          data-testid={T.editorLineDeleteBtn}
                          onClick={() => deleteLine(idx)}
                          className="p-1 rounded text-err-fg hover:bg-err-bg"
                          aria-label="Supprimer la ligne"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-start justify-between mt-3 gap-6">
        <button
          onClick={addLine}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dashed border-line-2 text-ink-muted hover:text-ink hover:border-line"
          style={{ fontSize: '12.5px', fontWeight: 400 }}
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={1.8} />
          Ajouter une ligne
        </button>

        <div className="w-[280px] space-y-1.5">
          <div className="flex justify-between text-ink-2" style={{ fontSize: '13px' }}>
            <span>Total HT</span>
            <span className="font-mono tabular-nums">{totalHT.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between text-ink-muted" style={{ fontSize: '13px' }}>
            <span>TVA ({formatTaxLabel(taxRate)})</span>
            <span className="font-mono tabular-nums">{tva.toFixed(2)} €</span>
          </div>
          <div
            className="flex justify-between text-ink pt-2 border-t border-line"
            style={{ fontSize: '17px', fontWeight: 500 }}
          >
            <span>Total TTC</span>
            <span data-testid={T.editorTotalTtc} className="font-mono tabular-nums">
              {totalTTC.toFixed(2)} €
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
