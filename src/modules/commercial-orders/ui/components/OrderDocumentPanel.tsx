/**
 * OrderDocumentPanel — panneau du bon de commande PDF sur la fiche commande
 * (E10.19b). CA8 d E10.16, explicitement HORS PERIMETRE jusqu ici
 * ("non livree, aucun bouton") : c est ce lot qui le cable.
 *
 * Production sur ACTION EXPLICITE UNIQUEMENT (contrat §8.20 §6, arbitrage
 * (C2)) : ce panneau n appelle JAMAIS `generateDocument()` automatiquement,
 * seul le clic sur « Produire le bon de commande » le declenche. Aucun
 * controle metier n est pose ICI comme seule verite (regle
 * `.claude/rules/frontend.md`) : le bouton est desactive pendant l appel
 * (confort UX), mais la garde reelle (« une seule fois », gabarit manquant)
 * vit exclusivement cote serveur — ce panneau se contente d afficher le
 * refus renvoye (409 `order.document_already_generated`/
 * `order.document_template_missing`) sans jamais le devancer.
 *
 * Aucun appel Supabase direct : passe par `CommercialOrdersApiClient`
 * (`getDocument`/`generateDocument`, deja ecrits pour cette story) — les
 * deux operations vivent sous `/commercial-orders/{orderId}/documents`,
 * jamais un module `order-documents` distinct cote UI (il n existe pas de
 * client HTTP propre a ce module, la ressource est exposee par la facade
 * Commandes).
 */
import { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { ApiClientError } from '@/platform/api';
import { CommercialOrdersApiClient } from '../../api/client';
import type { OrderDocumentDto } from '@/modules/order-documents';
import { formatOrderDate } from '../workspace/order-detail.helpers';

const btnPrimary =
  'px-3 py-1.5 rounded-lg text-sm bg-brand text-white hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5';
const btnGhost =
  'px-3 py-1.5 border border-line-2 rounded-lg text-sm text-ink-2 hover:bg-bg hover:text-ink inline-flex items-center gap-1.5';

export interface OrderDocumentPanelProps {
  orderId: string;
}

export function OrderDocumentPanel({ orderId }: OrderDocumentPanelProps) {
  const ordersApi = useWorkspaceApi(CommercialOrdersApiClient);
  const [document, setDocument] = useState<OrderDocumentDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const found = await ordersApi.getDocument(orderId);
      setDocument(found);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chargement du bon de commande impossible.');
    } finally {
      setLoading(false);
    }
  }, [ordersApi, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const produced = await ordersApi.generateDocument(orderId);
      setDocument(produced);
    } catch (cause) {
      // qa-review m2 (mineur, corrige) — 409 `order.document_already_generated`
      // signifie qu une production a eu lieu ENTRE-TEMPS (un autre onglet, un
      // autre membre de l atelier) : le contrat dit « le lire, ne pas le
      // reproduire » — ce panneau RECHARGE alors le document existant plutot
      // que de laisser l ecran bloque sur « Produire » sans lien de
      // telechargement jusqu a un rafraichissement manuel de la page.
      if (cause instanceof ApiClientError && cause.problem.code === 'order.document_already_generated') {
        await load();
        return;
      }
      // 409 `order.document_template_missing` (ou toute autre erreur) remonte
      // ICI telle quelle — le serveur reste la SEULE verite, ce panneau ne
      // fait qu afficher le refus, jamais le devancer.
      setError(cause instanceof Error ? cause.message : 'Production du bon de commande impossible.');
    } finally {
      setGenerating(false);
    }
  }, [ordersApi, orderId, load]);

  return (
    <section
      className="border border-line rounded-xl p-4 space-y-3"
      data-testid={TEST_IDS.orderDocument.block}
    >
      <h2 className="text-sm font-bold text-ink-2 uppercase tracking-wider">Bon de commande</h2>

      {error && (
        <p className="text-sm text-err-fg" data-testid={TEST_IDS.orderDocument.errorBanner}>
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : document ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink" data-testid={TEST_IDS.orderDocument.generatedLabel}>
            Produit le {formatOrderDate(document.generated_at)}
            {document.generated_by_label ? <span className="text-ink-muted"> · {document.generated_by_label}</span> : null}
          </p>
          <a
            href={document.download_url}
            target="_blank"
            rel="noreferrer"
            className={btnGhost}
            data-testid={TEST_IDS.orderDocument.downloadBtn}
          >
            <FileText className="w-4 h-4" />
            Télécharger
          </a>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-muted" data-testid={TEST_IDS.orderDocument.emptyState}>
            Aucun bon de commande produit pour cette commande.
          </p>
          <button
            type="button"
            className={btnPrimary}
            disabled={generating}
            onClick={() => void handleGenerate()}
            data-testid={TEST_IDS.orderDocument.generateBtn}
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Produire le bon de commande
          </button>
        </div>
      )}
    </section>
  );
}
