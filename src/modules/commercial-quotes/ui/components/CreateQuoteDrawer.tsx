/**
 * CreateQuoteDrawer — E10.3, CA2.
 *
 * Ouvert depuis l en-tete d un projet (bouton « Creer un devis », CA1). Ne
 * porte AUCUNE case de selection : la selection se fait sur la fiche projet
 * elle-meme (`project-item-checkbox`, CA2) ; ce tiroir recapitule les
 * elements deja coches au moment du clic et les convertit en lignes de devis
 * via `POST /api/v1/quotes` (transactionnel, CA5). Bascule ensuite vers l
 * ecran d edition du devis (`onCreated`), jamais de calcul de prix ici.
 */
import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { CommercialQuotesApiClient } from '../../api/client';
import type { QuoteDetailDto } from '../../api/contracts';

export interface CreateQuoteDrawerItem {
  id: string;
  label: string;
}

export interface CreateQuoteDrawerProps {
  projectId: string;
  /** Elements DEJA COCHES sur la fiche projet (CA2), pas une nouvelle selection. */
  items: readonly CreateQuoteDrawerItem[];
  onClose: () => void;
  onCreated: (quote: QuoteDetailDto) => void;
}

export function CreateQuoteDrawer({ projectId, items, onClose, onCreated }: CreateQuoteDrawerProps) {
  const quotesApi = useWorkspaceApi(CommercialQuotesApiClient);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (items.length === 0 || saving) return;
    setError(null);
    setSaving(true);
    try {
      const quote = await quotesApi.createFromProject({
        project_id: projectId,
        item_ids: items.map((item) => item.id),
      });
      onCreated(quote);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Creation du devis impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-end bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-paper h-full w-full max-w-md p-6 shadow-2xl overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
        data-testid={TEST_IDS.commercialQuote.createDrawer}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-ink">Creer un devis</h3>
          <button onClick={onClose} className="p-1 hover:bg-bg rounded" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-ink-2 mb-3">
          {items.length} element{items.length > 1 ? 's' : ''} selectionne{items.length > 1 ? 's' : ''}{' '}
          — le client et la configuration produit seront repris tels quels du projet.
        </p>

        <ul className="divide-y divide-line/60 border border-line rounded-xl mb-4">
          {items.map((item) => (
            <li key={item.id} className="px-3 py-2 text-sm text-ink">
              {item.label}
            </li>
          ))}
        </ul>

        {error && <p className="text-sm text-err-fg mb-3">{error}</p>}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={items.length === 0 || saving}
          className="w-full px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
          data-testid={TEST_IDS.commercialQuote.createSubmitBtn}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Creer le devis
        </button>
      </div>
    </div>
  );
}
