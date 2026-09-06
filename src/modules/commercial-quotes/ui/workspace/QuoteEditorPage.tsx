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
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowDown, ArrowLeft, ArrowUp, History, Loader2, Trash2 } from 'lucide-react';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { useAccessProfile } from '@/modules/roles/ui/runtime';
import { CustomersApiClient, type CustomerDto } from '@/modules/customers';
import { customerDisplayName } from '@/modules/projects/ui';
import { ProjectsApiClient, type ProjectItemDto } from '@/modules/projects';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { CommercialQuotesApiClient } from '../../api/client';
import type {
  QuoteAuditEntryDto,
  QuoteDetailDto,
  QuoteLineAuditEntryDto,
  QuoteLineDto,
  UpdateQuoteCommand,
} from '../../api/contracts';
import { percentToRate, rateToPercent, statusLabel, vatLegalMention } from '../helpers';

/** Brouillon de saisie d une ligne, avant commit AU BLUR (jamais a la frappe). */
type LineDraft = Readonly<{ salePrice: string; marginRate: string; quantity: string }>;

function draftOf(line: QuoteLineDto): LineDraft {
  return {
    salePrice: line.sale_price,
    marginRate: line.sale_margin_rate ?? '',
    quantity: String(line.quantity),
  };
}

/**
 * Une ligne du panneau de totaux (E10.10a, `QuoteTotals`) — affichage SEUL,
 * la valeur vient toujours telle quelle du serveur (`Quote.totals`), jamais
 * recalculee ici.
 */
function TotalsRow({
  label,
  value,
  testId,
  emphasis,
}: Readonly<{ label: string; value: string; testId: string; emphasis?: boolean }>) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={emphasis ? 'font-semibold text-ink' : 'text-ink-muted'}>{label}</dt>
      <dd data-testid={testId} className={`font-mono ${emphasis ? 'font-semibold text-ink' : 'text-ink-2'}`}>
        {value}
      </dd>
    </div>
  );
}

export function QuoteEditorPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const tp = useTenantPath();
  const navigate = useNavigate();
  const quotesApi = useWorkspaceApi(CommercialQuotesApiClient);
  const customersApi = useWorkspaceApi(CustomersApiClient);
  const projectsApi = useWorkspaceApi(ProjectsApiClient);
  // Journal d entete (E10.10a) reserve `can_manage_pricing` cote serveur —
  // meme mecanisme applicatif que `PricingRulesPage` (E10.11) : l onglet n
  // est meme pas rendu sans ce droit (ergonomie, pas la garde d autorisation
  // elle-meme, tenue par la RLS/le service).
  const { hasCapability } = useAccessProfile();
  const canManagePricing = hasCapability('can_manage_pricing') === true;

  const [detail, setDetail] = useState<QuoteDetailDto | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerDto | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [projectItems, setProjectItems] = useState<readonly ProjectItemDto[]>([]);
  // Numero du devis SOURCE (`source_quote_id`, E10.10a) : le contrat ne rend
  // que l id, un second appel resout le numero pour l affichage (dette
  // documentee dans le rapport de fin de story si le devis source a ete
  // supprime depuis — u4/B6, `source_quote_id` peut etre orphelin).
  const [sourceQuoteNumber, setSourceQuoteNumber] = useState<string | null>(null);
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
  const [auditTab, setAuditTab] = useState<'lines' | 'header'>('lines');
  const [auditEntries, setAuditEntries] = useState<readonly QuoteLineAuditEntryDto[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [headerAuditEntries, setHeaderAuditEntries] = useState<readonly QuoteAuditEntryDto[]>([]);
  const [headerAuditLoading, setHeaderAuditLoading] = useState(false);

  // ── E10.10a — envoi/renvoi (`sendQuote`) ──────────────────────────────────
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendShowDiscounts, setSendShowDiscounts] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<'sent' | 'resent' | null>(null);

  // ── E10.10a — duplication (`duplicateQuote`) ──────────────────────────────
  const [duplicating, setDuplicating] = useState(false);

  // ── E10.10a — remise globale (XOR taux/prix cible) et surcharge de TVA,
  // meme discipline « deux champs visibles, commit AU BLUR » que sale_price/
  // margin_rate au niveau ligne (E10.9) ─────────────────────────────────────
  const [globalDiscountRateDraft, setGlobalDiscountRateDraft] = useState('');
  const [targetNetTotalDraft, setTargetNetTotalDraft] = useState('');
  const [vatRateDraft, setVatRateDraft] = useState('');
  const [headerFieldBusy, setHeaderFieldBusy] = useState(false);

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
      setGlobalDiscountRateDraft(
        result.data.global_discount_rate ? rateToPercent(result.data.global_discount_rate) : '',
      );
      setTargetNetTotalDraft(result.data.target_net_total ?? '');
      setVatRateDraft(result.data.vat_rate ? rateToPercent(result.data.vat_rate) : '');
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
      if (result.data.source_quote_id) {
        try {
          const source = await quotesApi.getDetail(result.data.source_quote_id);
          setSourceQuoteNumber(source.number);
        } catch {
          // Devis source supprime depuis (id orphelin admis, dette u4/B6) :
          // le badge retombe sur l affichage brut de l id.
          setSourceQuoteNumber(null);
        }
      } else {
        setSourceQuoteNumber(null);
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
  const isSent = detail?.status === 'sent';

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
    setAuditTab('lines');
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

  /**
   * Journal de l ENTETE (E10.10a), distinct de celui des lignes ci-dessus —
   * charge a la demande, seulement quand l onglet est selectionne (le
   * bouton lui-meme n est rendu que si `canManagePricing`, defense en
   * profondeur cote UI en plus du 403 deja rendu par le serveur).
   */
  async function loadHeaderAudit(): Promise<void> {
    if (!detail) return;
    setAuditTab('header');
    setHeaderAuditLoading(true);
    try {
      const result = await quotesApi.listHeaderAuditEntries(detail.id, { pageSize: 50 });
      setHeaderAuditEntries(result.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chargement du journal d entete impossible.');
    } finally {
      setHeaderAuditLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // E10.10a — envoi/renvoi, duplication.
  // ---------------------------------------------------------------------------

  function openSendDialog(): void {
    if (!detail) return;
    setSendError(null);
    setSendSuccess(null);
    setSendShowDiscounts(detail.show_discounts);
    setSendDialogOpen(true);
  }

  async function confirmSend(): Promise<void> {
    if (!detail || !etag) return;
    const resend = detail.status === 'sent';
    setSending(true);
    setSendError(null);
    try {
      // Sur un RENVOI, `show_discounts` n est jamais transmis dans le corps :
      // le contrat refuse toute valeur DIVERGENTE de celle enregistree en
      // 422 `quote.resend_immutable`. L UI verrouille deja le champ (lecture
      // seule ci-dessous) ; ne pas l envoyer du tout evite tout risque
      // d ecart de forme (arrondi, etc.) sur ce cas.
      await quotesApi.send(detail.id, resend ? {} : { show_discounts: sendShowDiscounts }, etag);
      setSendSuccess(resend ? 'resent' : 'sent');
      setSendDialogOpen(false);
      await load();
    } catch (cause) {
      setSendError(cause instanceof Error ? cause.message : 'Envoi du devis impossible.');
    } finally {
      setSending(false);
    }
  }

  async function handleDuplicate(): Promise<void> {
    if (!detail) return;
    setDuplicating(true);
    setError(null);
    try {
      const { data: copy } = await quotesApi.duplicate(detail.id);
      navigate(tp(`/dashboard/commercial-quotes/${copy.id}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Duplication du devis impossible.');
    } finally {
      setDuplicating(false);
    }
  }

  // ---------------------------------------------------------------------------
  // E10.10a — remise globale (XOR taux/prix cible) et surcharge de TVA.
  // Meme discipline que les champs de ligne (E10.9) : commit AU BLUR, jamais
  // a la frappe ; JAMAIS de calcul local (remise deduite, TVA) — toujours ce
  // que `load()` relit depuis le serveur.
  // ---------------------------------------------------------------------------

  async function commitHeaderPatch(patch: UpdateQuoteCommand): Promise<void> {
    if (!detail || !etag) return;
    setHeaderFieldBusy(true);
    setError(null);
    try {
      await quotesApi.update(detail.id, patch, etag);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Modification de l entete impossible.');
    } finally {
      setHeaderFieldBusy(false);
    }
  }

  async function commitGlobalDiscountRate(): Promise<void> {
    if (!detail || !isDraft) return;
    if (globalDiscountRateDraft.trim() === '') return;
    const currentPercent = detail.global_discount_rate ? rateToPercent(detail.global_discount_rate) : '';
    if (globalDiscountRateDraft === currentPercent) return;
    const rate = percentToRate(globalDiscountRateDraft);
    if (rate === null) {
      setError('Taux de remise globale invalide.');
      return;
    }
    await commitHeaderPatch({ global_discount_rate: rate });
  }

  async function commitTargetNetTotal(): Promise<void> {
    if (!detail || !isDraft) return;
    if (targetNetTotalDraft.trim() === '') return;
    if (targetNetTotalDraft === (detail.target_net_total ?? '')) return;
    await commitHeaderPatch({ target_net_total: targetNetTotalDraft });
  }

  async function clearGlobalDiscount(): Promise<void> {
    if (!detail || !isDraft) return;
    setGlobalDiscountRateDraft('');
    setTargetNetTotalDraft('');
    await commitHeaderPatch({ global_discount_rate: null });
  }

  async function commitVatRateOverride(): Promise<void> {
    if (!detail || !isDraft) return;
    const currentPercent = detail.vat_rate ? rateToPercent(detail.vat_rate) : '';
    if (vatRateDraft === currentPercent) return;
    if (vatRateDraft.trim() === '') {
      await commitHeaderPatch({ vat_rate: null });
      return;
    }
    const rate = percentToRate(vatRateDraft);
    if (rate === null || rate.startsWith('-')) {
      setError('Taux de TVA invalide (aucune valeur negative).');
      return;
    }
    await commitHeaderPatch({ vat_rate: rate });
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
  const vatMention = vatLegalMention(detail.totals.vat_regime);
  const validityExpiredWarning = detail.warnings.find((w) => w.code === 'validity_expired') ?? null;
  const canSendOrResend = detail.status === 'draft' || detail.status === 'sent';

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
          <span data-testid={TEST_IDS.commercialQuote.statusBadge} data-status={detail.status}>
            {statusLabel(detail.status)}
          </span>
        </p>
        <Link
          to={tp(`/dashboard/projects/${detail.project_id}`)}
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink mt-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voir le projet source{projectName ? ` « ${projectName} »` : ''}
        </Link>
        {detail.source_quote_id && (
          <p
            data-testid={TEST_IDS.commercialQuote.sourceQuoteBadge}
            data-source-quote-id={detail.source_quote_id}
            className="text-xs text-ink-muted mt-2"
          >
            Dupliqué depuis{' '}
            {sourceQuoteNumber ? (
              <Link
                to={tp(`/dashboard/commercial-quotes/${detail.source_quote_id}`)}
                className="font-mono text-brand hover:underline"
              >
                {sourceQuoteNumber}
              </Link>
            ) : (
              <span className="font-mono">{detail.source_quote_id}</span>
            )}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-err-fg">{error}</p>}

      {sendSuccess && (
        <p
          data-testid={TEST_IDS.commercialQuote.sendSuccessBanner}
          className="text-sm text-ok-fg bg-ok-bg border border-ok-fg/30 rounded-lg px-3 py-2"
        >
          {sendSuccess === 'sent' ? 'Devis envoyé au client.' : 'Devis renvoyé au client.'}
        </p>
      )}

      {!isDraft && (
        <p
          data-testid={TEST_IDS.commercialQuote.readOnlyBanner}
          className="text-sm text-warn-fg bg-warn-bg border border-warn-fg/30 rounded-lg px-3 py-2"
        >
          Ce devis n’est plus modifiable ({statusLabel(detail.status)}). Dupliquez-le pour reprendre son
          contenu.
        </p>
      )}

      {validityExpiredWarning && (
        <p
          data-testid={TEST_IDS.commercialQuote.validityExpiredBanner}
          className="text-sm text-warn-fg bg-warn-bg border border-warn-fg/30 rounded-lg px-3 py-2"
        >
          {validityExpiredWarning.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {canSendOrResend && (
          <button
            type="button"
            data-testid={TEST_IDS.commercialQuote.sendBtn}
            onClick={openSendDialog}
            className="px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 text-sm font-medium"
          >
            {detail.status === 'draft' ? 'Envoyer le devis' : 'Renvoyer le devis'}
          </button>
        )}
        <button
          type="button"
          data-testid={TEST_IDS.commercialQuote.duplicateBtn}
          onClick={() => void handleDuplicate()}
          disabled={duplicating}
          className="px-4 py-2 border border-line-2 rounded-lg text-sm text-ink-2 hover:bg-bg disabled:opacity-50 flex items-center gap-2"
        >
          {duplicating && <Loader2 className="w-4 h-4 animate-spin" />}
          Dupliquer
        </button>
      </div>

      {sendDialogOpen && (
        <div
          data-testid={TEST_IDS.commercialQuote.sendDialog}
          className="border border-brand/40 bg-brand/5 rounded-xl p-4 space-y-3"
        >
          <h2 className="text-sm font-bold text-ink-2 uppercase tracking-wider">
            {isSent ? 'Confirmer le renvoi' : 'Confirmer l’envoi'}
          </h2>
          {isSent ? (
            <p className="text-sm text-ink-2">
              Affichage du détail des remises au client :{' '}
              <span className="font-medium">{detail.show_discounts ? 'Oui' : 'Non'}</span>. Non modifiable
              au renvoi — dupliquez le devis pour changer ce choix.
            </p>
          ) : (
            <label className="flex items-center gap-2 text-sm text-ink-2">
              <input
                type="checkbox"
                data-testid={TEST_IDS.commercialQuote.sendShowDiscountsCheckbox}
                checked={sendShowDiscounts}
                onChange={(event) => setSendShowDiscounts(event.target.checked)}
              />
              Afficher le détail des remises au client
            </label>
          )}
          {sendError && <p className="text-sm text-err-fg">{sendError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              data-testid={TEST_IDS.commercialQuote.sendConfirmBtn}
              onClick={() => void confirmSend()}
              disabled={sending}
              className="px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
            >
              {sending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSent ? 'Confirmer le renvoi' : 'Confirmer l’envoi'}
            </button>
            <button
              type="button"
              data-testid={TEST_IDS.commercialQuote.sendCancelBtn}
              onClick={() => {
                setSendDialogOpen(false);
                setSendError(null);
              }}
              disabled={sending}
              className="px-4 py-2 text-sm text-ink-muted hover:text-ink"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <section
        data-testid={TEST_IDS.commercialQuote.totalsPanel}
        className="border border-line rounded-xl p-4 space-y-2 max-w-md ml-auto"
      >
        <h2 className="text-sm font-bold text-ink-2 uppercase tracking-wider">Totaux</h2>
        <dl className="text-sm space-y-1">
          <TotalsRow
            label="Sous-total lignes"
            value={detail.totals.lines_subtotal}
            testId={TEST_IDS.commercialQuote.totalsLinesSubtotal}
          />
          <TotalsRow
            label="Remise globale"
            value={`${detail.totals.global_discount}${
              detail.totals.effective_discount_rate
                ? ` (${rateToPercent(detail.totals.effective_discount_rate)} %)`
                : ''
            }`}
            testId={TEST_IDS.commercialQuote.totalsGlobalDiscount}
          />
          <TotalsRow
            label="Net HT"
            value={detail.totals.net_total}
            testId={TEST_IDS.commercialQuote.totalsNetTotal}
          />
          <TotalsRow
            label={`TVA (${rateToPercent(detail.totals.vat_rate)} %)`}
            value={detail.totals.vat_amount}
            testId={TEST_IDS.commercialQuote.totalsVatAmount}
          />
          <TotalsRow
            label="Total TTC"
            value={detail.totals.total_incl_tax}
            testId={TEST_IDS.commercialQuote.totalsInclTax}
            emphasis
          />
        </dl>
        {vatMention && (
          <p data-testid={TEST_IDS.commercialQuote.vatLegalMention} className="text-xs text-ink-muted pt-1">
            {vatMention}
          </p>
        )}
      </section>

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

      <section className="border border-line rounded-xl p-4 space-y-4">
        <h2 className="text-sm font-bold text-ink-2 uppercase tracking-wider">Entête</h2>

        {/* show_discounts / valid_until — soumis ensemble (E10.3), en lecture
            seule des qu un devis n est plus `draft` (CA garde de statut). */}
        <form onSubmit={submitHeaderChanges} className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              data-testid={TEST_IDS.commercialQuote.showDiscountsCheckbox}
              checked={showDiscountsDraft}
              disabled={!isDraft}
              onChange={(event) => setShowDiscountsDraft(event.target.checked)}
            />
            Afficher les remises sur le devis
          </label>
          <label className="block text-sm text-ink-2">
            Valide jusqu’au{' '}
            {isDraft ? (
              <input
                type="date"
                data-testid={TEST_IDS.commercialQuote.validUntilInput}
                value={validUntilDraft}
                onChange={(event) => setValidUntilDraft(event.target.value)}
                className="ml-2 px-2 py-1 border border-line-2 rounded-lg bg-paper text-ink text-sm"
              />
            ) : (
              <span
                data-testid={TEST_IDS.commercialQuote.validUntilInput}
                className="ml-2 font-mono text-ink-2"
              >
                {detail.valid_until ?? 'Aucune'}
              </span>
            )}
          </label>
          {isDraft && (
            <button
              type="submit"
              data-testid={TEST_IDS.commercialQuote.headerSaveBtn}
              disabled={saving}
              className="px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Enregistrer
            </button>
          )}
        </form>

        {/* Remise globale — XOR taux/prix cible, remise DEDUITE affichee a
            cote en lecture seule, exact miroir du geste ligne (E10.9,
            sale_price/margin_rate). */}
        <div className="space-y-2 pt-3 border-t border-line/60">
          <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Remise globale</h3>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-ink-2 flex items-center gap-2">
              Taux (%)
              {isDraft ? (
                <input
                  type="text"
                  inputMode="decimal"
                  data-testid={TEST_IDS.commercialQuote.globalDiscountRateInput}
                  disabled={headerFieldBusy}
                  value={globalDiscountRateDraft}
                  onChange={(event) => setGlobalDiscountRateDraft(event.target.value)}
                  onBlur={() => void commitGlobalDiscountRate()}
                  className="w-24 px-2 py-1 border border-line-2 rounded-lg bg-paper text-ink font-mono"
                />
              ) : (
                <span className="font-mono">
                  {detail.global_discount_rate ? `${rateToPercent(detail.global_discount_rate)} %` : '—'}
                </span>
              )}
            </label>
            <label className="text-sm text-ink-2 flex items-center gap-2">
              Prix net visé (HT)
              {isDraft ? (
                <input
                  type="text"
                  inputMode="decimal"
                  data-testid={TEST_IDS.commercialQuote.globalDiscountTargetInput}
                  disabled={headerFieldBusy}
                  value={targetNetTotalDraft}
                  onChange={(event) => setTargetNetTotalDraft(event.target.value)}
                  onBlur={() => void commitTargetNetTotal()}
                  className="w-28 px-2 py-1 border border-line-2 rounded-lg bg-paper text-ink font-mono"
                />
              ) : (
                <span className="font-mono">{detail.target_net_total ?? '—'}</span>
              )}
            </label>
            {isDraft && (detail.global_discount_rate !== null || detail.target_net_total !== null) && (
              <button
                type="button"
                data-testid={TEST_IDS.commercialQuote.globalDiscountClearBtn}
                onClick={() => void clearGlobalDiscount()}
                disabled={headerFieldBusy}
                className="text-xs text-ink-muted hover:text-err-fg underline disabled:opacity-50"
              >
                Effacer la remise globale
              </button>
            )}
          </div>
          <p
            data-testid={TEST_IDS.commercialQuote.globalDiscountDisplay}
            className="text-sm text-ink-muted font-mono"
          >
            Remise déduite : {detail.totals.global_discount}
            {detail.totals.effective_discount_rate
              ? ` (${rateToPercent(detail.totals.effective_discount_rate)} %)`
              : ''}
          </p>
        </div>

        {/* TVA — taux/regime effectivement appliques (serveur) + surcharge
            par devis (point 6 du cadrage, §8.12). */}
        <div className="space-y-2 pt-3 border-t border-line/60">
          <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wide">TVA</h3>
          <div className="flex flex-wrap items-center gap-3">
            <span
              data-testid={TEST_IDS.commercialQuote.vatRateDisplay}
              className="text-sm text-ink-2 font-mono"
            >
              Taux appliqué : {rateToPercent(detail.totals.vat_rate)} %
              {detail.totals.vat_regime ? ` (${detail.totals.vat_regime})` : ' (surcharge du devis)'}
            </span>
            <label className="text-sm text-ink-2 flex items-center gap-2">
              Surcharge (%)
              {isDraft ? (
                <input
                  type="text"
                  inputMode="decimal"
                  data-testid={TEST_IDS.commercialQuote.vatRateInput}
                  disabled={headerFieldBusy}
                  value={vatRateDraft}
                  placeholder="Réglage tenant"
                  onChange={(event) => setVatRateDraft(event.target.value)}
                  onBlur={() => void commitVatRateOverride()}
                  className="w-20 px-2 py-1 border border-line-2 rounded-lg bg-paper text-ink font-mono"
                />
              ) : (
                <span className="font-mono">
                  {detail.vat_rate ? `${rateToPercent(detail.vat_rate)} %` : 'Réglage tenant'}
                </span>
              )}
            </label>
          </div>
        </div>
      </section>

      <section className="border border-line rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => void toggleAudit()}
            className="flex items-center gap-2 text-sm font-bold text-ink-2 uppercase tracking-wider"
          >
            <History className="w-4 h-4" />
            Journal d audit {auditOpen ? '▲' : '▼'}
          </button>
        </div>
        {auditOpen && (
          <div className="space-y-3">
            {canManagePricing && (
              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid={TEST_IDS.commercialQuote.auditTabLines}
                  onClick={() => setAuditTab('lines')}
                  className={`text-xs px-2 py-1 rounded ${
                    auditTab === 'lines' ? 'bg-ink text-paper' : 'text-ink-muted border border-line-2'
                  }`}
                >
                  Lignes
                </button>
                <button
                  type="button"
                  data-testid={TEST_IDS.commercialQuote.auditTabHeader}
                  onClick={() => void loadHeaderAudit()}
                  className={`text-xs px-2 py-1 rounded ${
                    auditTab === 'header' ? 'bg-ink text-paper' : 'text-ink-muted border border-line-2'
                  }`}
                >
                  Entête
                </button>
              </div>
            )}

            {auditTab === 'lines' ? (
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
            ) : (
              <div data-testid={TEST_IDS.commercialQuote.headerAuditPanel} className="space-y-1">
                {headerAuditLoading && <p className="text-sm text-ink-muted">Chargement…</p>}
                {!headerAuditLoading && headerAuditEntries.length === 0 && (
                  <p className="text-sm text-ink-muted">Aucune entree.</p>
                )}
                {!headerAuditLoading &&
                  headerAuditEntries.map((entry) => (
                    <div
                      key={entry.id}
                      data-testid={TEST_IDS.commercialQuote.headerAuditRow}
                      data-audit-id={entry.id}
                      className={`text-xs flex flex-wrap gap-x-2 border-b border-line/40 py-1 ${
                        entry.action === 'status_forced' ? 'text-err-fg font-medium' : 'text-ink-2'
                      }`}
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
          </div>
        )}
      </section>
    </div>
  );
}
