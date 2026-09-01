/**
 * QuoteEditorPage — E10.3, CA5/CA6.
 *
 * Ecran d edition du devis : entete (numero, client, statut), lignes issues
 * du chiffrage source (configuration produit, quantite, prix de production
 * TEL QUEL — aucun recalcul cote navigateur). Reste editable tant que le
 * devis est a l etat brouillon (CA6) : la validation en commande (E10.12)
 * est hors perimetre de cette story, aucune transition de statut n est
 * proposee ici.
 *
 * Point critique E10.21 (pas encore livree, E10.8 gelee) : seule la colonne
 * `production_price` est affichee comme un prix. `public_price` /
 * `customer_price` ne sont pas rendus tant qu ils sont nuls — afficher un
 * prix de vente invente serait exactement le calcul hors PricingEngine que
 * le sprint interdit.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { CustomersApiClient, type CustomerDto } from '@/modules/customers';
import { customerDisplayName } from '@/modules/projects/ui';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { CommercialQuotesApiClient } from '../../api/client';
import type { QuoteDetailDto } from '../../api/contracts';

const QUOTE_STATUS_LABELS: Readonly<Record<string, string>> = {
  draft: 'Brouillon',
  sent: 'Envoye',
  accepted: 'Accepte',
  rejected: 'Refuse',
  converted: 'Converti',
};

export function QuoteEditorPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const tp = useTenantPath();
  const quotesApi = useWorkspaceApi(CommercialQuotesApiClient);
  const customersApi = useWorkspaceApi(CustomersApiClient);

  const [detail, setDetail] = useState<QuoteDetailDto | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDiscountsDraft, setShowDiscountsDraft] = useState(false);
  const [validUntilDraft, setValidUntilDraft] = useState('');
  const [saving, setSaving] = useState(false);

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
      try {
        const fetchedCustomer = await customersApi.getDetail(result.data.customer_id);
        setCustomer(fetchedCustomer);
      } catch {
        setCustomer(null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chargement du devis impossible.');
    } finally {
      setLoading(false);
    }
  }, [quotesApi, customersApi, quoteId]);

  useEffect(() => {
    void load();
  }, [load]);

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

  return (
    <div className="space-y-6" data-testid={TEST_IDS.commercialQuote.editorPage}>
      <Link
        to={tp(`/dashboard/projects/${detail.project_id}`)}
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour au projet
      </Link>

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
          {QUOTE_STATUS_LABELS[detail.status] ?? detail.status}
        </p>
      </div>

      {error && <p className="text-sm text-err-fg">{error}</p>}

      <section className="border border-line rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-bold text-ink-2 uppercase tracking-wider">
          Lignes ({detail.lines.length})
        </h2>
        <ul className="divide-y divide-line/60">
          {detail.lines.map((line) => (
            <li
              key={line.id}
              data-testid={TEST_IDS.commercialQuote.lineRow}
              data-line-id={line.id}
              className="py-3 flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink font-medium">{line.label}</p>
                <p className="text-xs text-ink-muted">{line.quantity} ex.</p>
              </div>
              <p className="text-sm text-ink font-mono shrink-0">
                {line.production_price} EUR HT
                <span className="text-ink-muted"> (production)</span>
              </p>
            </li>
          ))}
        </ul>
      </section>

      {detail.status === 'draft' && (
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
    </div>
  );
}
