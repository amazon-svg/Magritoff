/**
 * QuoteEditorPage — E10.3 (CA5/CA6), reconstruite par E10.9.
 *
 * Ecran d edition du devis : entete (numero, client, statut), table de
 * lignes editable (quantite, prix de vente ET marge affiches simultanement,
 * remise deduite en lecture seule), panneau d audit, et les capacites
 * reprises de l ancien editeur de devis (decision d Arnaud du 01/09) :
 * ajout d une ligne (chiffrage du projet OU ligne libre), suppression,
 * reordonnancement.
 *
 * ── Aucun calcul cote navigateur (regle du sprint) ─────────────────────────
 * `discount_rate`/`margin_variation`/`sale_margin_rate`/`warnings` sont
 * TOUJOURS ceux rendus par la reponse API — jamais recalcules ici, meme pour
 * un affichage "optimiste". Un champ de saisie (prix de vente OU marge)
 * declenche un `PATCH` AU BLUR (Dev Notes E10.9, pas a chaque frappe : evite
 * une boucle d arrondi si l utilisateur tape "1", "12", "120" et que chaque
 * frappe intermediaire etait renvoyee au serveur).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowDown, ArrowLeft, ArrowUp, History, Loader2, Trash2 } from 'lucide-react';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { CustomersApiClient, type CustomerDto } from '@/modules/customers';
import { customerDisplayName } from '@/modules/projects/ui';
import { ProjectsApiClient, type ProjectItemDto } from '@/modules/projects';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { CommercialQuotesApiClient } from '../../api/client';
import type { QuoteDetailDto, QuoteLineAuditEntryDto, QuoteLineDto } from '../../api/contracts';
import { statusLabel } from '../helpers';

/** Brouillon de saisie d une ligne, avant commit AU BLUR (jamais a la frappe). */
type LineDraft = Readonly<{ salePrice: string; marginRate: string; quantity: string }>;

function draftOf(line: QuoteLineDto): LineDraft {
  return {
    salePrice: line.sale_price,
    marginRate: line.sale_margin_rate ?? '',
    quantity: String(line.quantity),
  };
}

export function QuoteEditorPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const tp = useTenantPath();
  const quotesApi = useWorkspaceApi(CommercialQuotesApiClient);
  const customersApi = useWorkspaceApi(CustomersApiClient);
  const projectsApi = useWorkspaceApi(ProjectsApiClient);

  const [detail, setDetail] = useState<QuoteDetailDto | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerDto | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [projectItems, setProjectItems] = useState<readonly ProjectItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDiscountsDraft, setShowDiscountsDraft] = useState(false);
  const [validUntilDraft, setValidUntilDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const [drafts, setDrafts] = useState<Record<string, LineDraft>>({});
  const [busyLineId, setBusyLineId] = useState<string | null>(null);

  const [addLineOpen, setAddLineOpen] = useState(false);
  const [addLineMode, setAddLineMode] = useState<'project_item' | 'free'>('free');
  const [addLineProjectItemId, setAddLineProjectItemId] = useState('');
  const [addLineLabel, setAddLineLabel] = useState('');
  const [addLineQuantity, setAddLineQuantity] = useState('1');
  const [addLinePrice, setAddLinePrice] = useState('0.00');
  const [addingLine, setAddingLine] = useState(false);

  const [auditOpen, setAuditOpen] = useState(false);
  const [auditEntries, setAuditEntries] = useState<readonly QuoteLineAuditEntryDto[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const load = useCallback(async () => {
    if (!quoteId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await quotesApi.getForEdit(quoteId);
      setDetail(result.data);
      setEtag(result.etag);
      setShowDiscountsDraft(result.data.show_discounts);
      setValidUntilDraft(result.data.valid_until ?? '');
      setDrafts(Object.fromEntries(result.data.lines.map((line) => [line.id, draftOf(line)])));
      try {
        const fetchedCustomer = await customersApi.getDetail(result.data.customer_id);
        setCustomer(fetchedCustomer);
      } catch {
        setCustomer(null);
      }
      try {
        const fetchedProject = await projectsApi.getDetail(result.data.project_id);
        setProjectName(fetchedProject.name);
        setProjectItems(fetchedProject.items);
      } catch {
        setProjectName(null);
        setProjectItems([]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chargement du devis impossible.');
    } finally {
      setLoading(false);
    }
  }, [quotesApi, customersApi, projectsApi, quoteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isDraft = detail?.status === 'draft';

  const hasNegativeMargin = useMemo(
    () => (detail?.lines ?? []).some((line) => line.warnings.some((w) => w.code === 'negative_margin')),
    [detail],
  );

  const submitHeaderChanges = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detail || !etag) return;
    setSaving(true);
    setError(null);
    try {
      await quotesApi.update(
        detail.id,
        { show_discounts: showDiscountsDraft, valid_until: validUntilDraft || null },
        etag,
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Modification du devis impossible.');
    } finally {
      setSaving(false);
    }
  };

  function updateDraft(lineId: string, patch: Partial<LineDraft>): void {
    setDrafts((current) => ({ ...current, [lineId]: { ...(current[lineId] ?? draftOf(detail!.lines.find((l) => l.id === lineId)!)), ...patch } }));
  }

  async function commitSalePrice(line: QuoteLineDto): Promise<void> {
    const draft = drafts[line.id];
    if (!draft || draft.salePrice === line.sale_price || draft.salePrice.trim() === '') return;
    await commitLinePatch(line.id, { sale_price: draft.salePrice });
  }

  async function commitMarginRate(line: QuoteLineDto): Promise<void> {
    const draft = drafts[line.id];
    if (!draft || draft.marginRate.trim() === '' || draft.marginRate === (line.sale_margin_rate ?? '')) return;
    await commitLinePatch(line.id, { margin_rate: draft.marginRate });
  }

  async function commitQuantity(line: QuoteLineDto): Promise<void> {
    const draft = drafts[line.id];
    const nextQuantity = draft ? Number(draft.quantity) : line.quantity;
    if (!Number.isInteger(nextQuantity) || nextQuantity < 1 || nextQuantity === line.quantity) return;
    await commitLinePatch(line.id, { quantity: nextQuantity });
  }

  async function commitLinePatch(
    lineId: string,
    command: { sale_price?: string; margin_rate?: string; quantity?: number },
  ): Promise<void> {
    if (!detail) return;
    setBusyLineId(lineId);
    setError(null);
    try {
      const { etag: lineEtag } = await quotesApi.getLineForEdit(detail.id, lineId);
      if (!lineEtag) throw new Error('ETag de la ligne manquant.');
      await quotesApi.updateLine(detail.id, lineId, command, lineEtag);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Modification de la ligne impossible.');
    } finally {
      setBusyLineId(null);
    }
  }

  async function moveLine(lineId: string, direction: -1 | 1): Promise<void> {
    if (!detail || !etag) return;
    const order = [...detail.lines].sort((a, b) => a.position - b.position).map((l) => l.id);
    const index = order.indexOf(lineId);
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const reordered = [...order];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved!);

    setBusyLineId(lineId);
    setError(null);
    try {
      await quotesApi.reorderLines(detail.id, reordered, etag);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Reordonnancement impossible.');
    } finally {
      setBusyLineId(null);
    }
  }

  async function deleteLine(lineId: string): Promise<void> {
    if (!detail) return;
    setBusyLineId(lineId);
    setError(null);
    try {
      await quotesApi.removeLine(detail.id, lineId);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Suppression de la ligne impossible.');
    } finally {
      setBusyLineId(null);
    }
  }

  async function submitAddLine(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!detail) return;
    setAddingLine(true);
    setError(null);
    try {
      if (addLineMode === 'project_item') {
        if (!addLineProjectItemId) throw new Error('Choisissez un chiffrage du projet.');
        await quotesApi.addLineFromProjectItem(detail.id, { project_item_id: addLineProjectItemId });
      } else {
        await quotesApi.addFreeLine(detail.id, {
          label: addLineLabel,
          quantity: Math.max(Number(addLineQuantity) || 1, 1),
          production_price: addLinePrice,
        });
      }
      setAddLineOpen(false);
      setAddLineProjectItemId('');
      setAddLineLabel('');
      setAddLineQuantity('1');
      setAddLinePrice('0.00');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ajout de la ligne impossible.');
    } finally {
      setAddingLine(false);
    }
  }

  async function toggleAudit(): Promise<void> {
    if (!detail) return;
    const next = !auditOpen;
    setAuditOpen(next);
    if (!next) return;
    setAuditLoading(true);
    try {
      const result = await quotesApi.listAuditEntries(detail.id, { pageSize: 50 });
      setAuditEntries(result.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chargement du journal d audit impossible.');
    } finally {
      setAuditLoading(false);
    }
  }

  if (loading) return <p className="text-sm text-ink-muted">Chargement…</p>;

  if (!detail) {
    return (
      <div className="space-y-3">
        <Link
          to={tp('/dashboard/projects')}
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux projets
        </Link>
        <p className="text-sm text-ink-muted">{error ?? 'Devis introuvable.'}</p>
      </div>
    );
  }

  const sortedLines = [...detail.lines].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-6" data-testid={TEST_IDS.commercialQuote.editorPage}>
      <div>
        <h1 className="text-xl font-bold text-ink flex items-center gap-3">
          Devis
          <span
            className="text-brand font-mono text-base"
            data-testid={TEST_IDS.commercialQuote.numberDisplay}
          >
            {detail.number}
          </span>
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Client : {customer ? customerDisplayName(customer) : '—'}
          {' · '}
          {statusLabel(detail.status)}
        </p>
        <Link
          to={tp(`/dashboard/projects/${detail.project_id}`)}
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink mt-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voir le projet source{projectName ? ` « ${projectName} »` : ''}
        </Link>
      </div>

      {error && <p className="text-sm text-err-fg">{error}</p>}

      {hasNegativeMargin && (
        <p
          data-testid={TEST_IDS.commercialQuote.lineNegativeMarginWarning}
          className="text-sm text-err-fg bg-err-bg border border-err-fg/30 rounded-lg px-3 py-2"
        >
          Une ou plusieurs lignes se vendent sous leur cout de production.
        </p>
      )}

      <section className="border border-line rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink-2 uppercase tracking-wider">
            Lignes ({sortedLines.length})
          </h2>
          {isDraft && (
            <button
              type="button"
              data-testid={TEST_IDS.commercialQuote.addLineBtn}
              onClick={() => setAddLineOpen(true)}
              className="text-sm text-brand hover:underline"
            >
              + Ajouter une ligne
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="py-2 pr-3">Libelle</th>
                <th className="py-2 pr-3">Qte</th>
                <th
                  className="py-2 pr-3"
                  data-testid={TEST_IDS.commercialQuote.lineImmutableCols}
                >
                  Cout / Public / Client
                </th>
                <th className="py-2 pr-3">Prix de vente</th>
                <th className="py-2 pr-3">Marge</th>
                <th className="py-2 pr-3">Remise</th>
                {isDraft && <th className="py-2 pr-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {sortedLines.map((line, index) => {
                const draft = drafts[line.id] ?? draftOf(line);
                const busy = busyLineId === line.id;
                const discountSign =
                  line.discount_rate === null
                    ? null
                    : line.discount_rate.startsWith('-')
                      ? 'negative'
                      : 'positive';
                return (
                  <tr
                    key={line.id}
                    data-testid={TEST_IDS.commercialQuote.lineRow}
                    data-line-id={line.id}
                  >
                    <td className="py-2 pr-3">
                      <p className="text-ink font-medium">{line.label}</p>
                      {line.warnings.map((warning) => (
                        <p key={warning.code} className="text-xs text-err-fg">
                          {warning.message}
                        </p>
                      ))}
                    </td>
                    <td className="py-2 pr-3">
                      {isDraft ? (
                        <input
                          data-testid={TEST_IDS.commercialQuote.lineQuantityInput}
                          data-line-id={line.id}
                          type="number"
                          min={1}
                          disabled={busy}
                          value={draft.quantity}
                          onChange={(event) => updateDraft(line.id, { quantity: event.target.value })}
                          onBlur={() => void commitQuantity(line)}
                          className="w-20 px-2 py-1 border border-line-2 rounded-lg bg-paper text-ink"
                        />
                      ) : (
                        line.quantity
                      )}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-ink-muted">
                      {line.production_price} / {line.public_price} / {line.customer_price}
                    </td>
                    <td className="py-2 pr-3">
                      {isDraft ? (
                        <input
                          data-testid={TEST_IDS.commercialQuote.lineSalePriceInput}
                          data-line-id={line.id}
                          type="text"
                          inputMode="decimal"
                          disabled={busy}
                          value={draft.salePrice}
                          onChange={(event) => updateDraft(line.id, { salePrice: event.target.value })}
                          onBlur={() => void commitSalePrice(line)}
                          className="w-24 px-2 py-1 border border-line-2 rounded-lg bg-paper text-ink font-mono"
                        />
                      ) : (
                        <span className="font-mono">{line.sale_price}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {isDraft ? (
                        <input
                          data-testid={TEST_IDS.commercialQuote.lineMarginInput}
                          data-line-id={line.id}
                          type="text"
                          inputMode="decimal"
                          disabled={busy}
                          value={draft.marginRate}
                          onChange={(event) => updateDraft(line.id, { marginRate: event.target.value })}
                          onBlur={() => void commitMarginRate(line)}
                          className="w-24 px-2 py-1 border border-line-2 rounded-lg bg-paper text-ink font-mono"
                        />
                      ) : (
                        <span className="font-mono">{line.sale_margin_rate ?? '—'}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        data-testid={TEST_IDS.commercialQuote.lineDiscountDisplay}
                        data-line-id={line.id}
                        data-sign={discountSign ?? undefined}
                        className={
                          discountSign === 'negative'
                            ? 'font-mono text-err-fg'
                            : 'font-mono text-ink-2'
                        }
                      >
                        {line.discount_rate ?? '—'}
                      </span>
                    </td>
                    {isDraft && (
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            data-testid={TEST_IDS.commercialQuote.lineMoveUpBtn}
                            data-line-id={line.id}
                            disabled={busy || index === 0}
                            onClick={() => void moveLine(line.id, -1)}
                            className="p-1 text-ink-muted hover:text-ink disabled:opacity-30"
                            aria-label="Monter la ligne"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            data-testid={TEST_IDS.commercialQuote.lineMoveDownBtn}
                            data-line-id={line.id}
                            disabled={busy || index === sortedLines.length - 1}
                            onClick={() => void moveLine(line.id, 1)}
                            className="p-1 text-ink-muted hover:text-ink disabled:opacity-30"
                            aria-label="Descendre la ligne"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            data-testid={TEST_IDS.commercialQuote.lineDeleteBtn}
                            data-line-id={line.id}
                            disabled={busy}
                            onClick={() => void deleteLine(line.id)}
                            className="p-1 text-err-fg hover:opacity-80 disabled:opacity-30"
                            aria-label="Supprimer la ligne"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {isDraft && addLineOpen && (
        <form
          onSubmit={submitAddLine}
          data-testid={TEST_IDS.commercialQuote.addLineDrawer}
          className="border border-line rounded-xl p-4 space-y-3"
        >
          <h2 className="text-sm font-bold text-ink-2 uppercase tracking-wider">Ajouter une ligne</h2>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="add-line-mode"
                data-testid={TEST_IDS.commercialQuote.addLineProjectItemOption}
                checked={addLineMode === 'project_item'}
                onChange={() => setAddLineMode('project_item')}
              />
              Depuis un chiffrage du projet
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="add-line-mode"
                data-testid={TEST_IDS.commercialQuote.addLineFreeOption}
                checked={addLineMode === 'free'}
                onChange={() => setAddLineMode('free')}
              />
              Ligne libre
            </label>
          </div>

          {addLineMode === 'project_item' ? (
            <select
              value={addLineProjectItemId}
              onChange={(event) => setAddLineProjectItemId(event.target.value)}
              className="w-full px-2 py-1 border border-line-2 rounded-lg bg-paper text-ink text-sm"
            >
              <option value="">Choisir un chiffrage…</option>
              {projectItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <input
                data-testid={TEST_IDS.commercialQuote.addLineFreeLabelInput}
                type="text"
                placeholder="Intitule"
                value={addLineLabel}
                onChange={(event) => setAddLineLabel(event.target.value)}
                className="px-2 py-1 border border-line-2 rounded-lg bg-paper text-ink text-sm"
              />
              <input
                data-testid={TEST_IDS.commercialQuote.addLineFreeQuantityInput}
                type="number"
                min={1}
                placeholder="Quantite"
                value={addLineQuantity}
                onChange={(event) => setAddLineQuantity(event.target.value)}
                className="px-2 py-1 border border-line-2 rounded-lg bg-paper text-ink text-sm"
              />
              <input
                data-testid={TEST_IDS.commercialQuote.addLineFreePriceInput}
                type="text"
                inputMode="decimal"
                placeholder="Cout de production"
                value={addLinePrice}
                onChange={(event) => setAddLinePrice(event.target.value)}
                className="px-2 py-1 border border-line-2 rounded-lg bg-paper text-ink text-sm"
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              data-testid={TEST_IDS.commercialQuote.addLineSubmitBtn}
              disabled={addingLine}
              className="px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
            >
              {addingLine && <Loader2 className="w-4 h-4 animate-spin" />}
              Ajouter
            </button>
            <button
              type="button"
              onClick={() => setAddLineOpen(false)}
              className="px-4 py-2 text-sm text-ink-muted hover:text-ink"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {isDraft && (
        <form onSubmit={submitHeaderChanges} className="border border-line rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-ink-2 uppercase tracking-wider">Entete</h2>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={showDiscountsDraft}
              onChange={(event) => setShowDiscountsDraft(event.target.checked)}
            />
            Afficher les remises sur le devis
          </label>
          <label className="block text-sm text-ink-2">
            Valide jusqu au
            <input
              type="date"
              value={validUntilDraft}
              onChange={(event) => setValidUntilDraft(event.target.value)}
              className="ml-2 px-2 py-1 border border-line-2 rounded-lg bg-paper text-ink text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Enregistrer
          </button>
        </form>
      )}

      <section className="border border-line rounded-xl p-4 space-y-3">
        <button
          type="button"
          onClick={() => void toggleAudit()}
          className="flex items-center gap-2 text-sm font-bold text-ink-2 uppercase tracking-wider"
        >
          <History className="w-4 h-4" />
          Journal d audit {auditOpen ? '▲' : '▼'}
        </button>
        {auditOpen && (
          <div data-testid={TEST_IDS.commercialQuote.auditPanel} className="space-y-1">
            {auditLoading && <p className="text-sm text-ink-muted">Chargement…</p>}
            {!auditLoading && auditEntries.length === 0 && (
              <p className="text-sm text-ink-muted">Aucune entree.</p>
            )}
            {!auditLoading &&
              auditEntries.map((entry) => (
                <div
                  key={entry.id}
                  data-testid={TEST_IDS.commercialQuote.auditRow}
                  data-audit-id={entry.id}
                  className="text-xs text-ink-2 flex flex-wrap gap-x-2 border-b border-line/40 py-1"
                >
                  <span className="font-mono text-ink-muted">{entry.occurred_at}</span>
                  <span className="font-medium">{entry.action}</span>
                  {entry.field && <span className="text-ink-muted">({entry.field})</span>}
                  {entry.previous_value !== null && entry.new_value !== null && (
                    <span>
                      {entry.previous_value} → {entry.new_value}
                    </span>
                  )}
                  <span className="text-ink-muted">{entry.actor_label ?? 'inconnu'}</span>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
