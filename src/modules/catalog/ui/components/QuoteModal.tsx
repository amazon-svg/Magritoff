/**
 * QuoteModal — impression d'un devis rapide pour un produit configure +
 * bascule vers "Ajouter au projet" (E10.1).
 *
 * Relocalise depuis `src/modules/quotes/ui/components/QuoteDialog.tsx`
 * (chantier d unification des devis, post Sprint 5 : voir
 * docs/api/CONVENTIONS.md §8.10). Le module `quotes` (ancien systeme
 * storefront) a ete supprime purement et simplement (decision Arnaud) : cette
 * modale n en depend plus. Elle est desormais hebergee par `catalog`, seul
 * consommateur (ProductCard).
 *
 * L'ancienne fonction `persist()` (historisation dans la table legacy
 * `public.quotes`) a ete retiree : sa cible a disparu et n a pas d equivalent
 * dans `commercial_quotes` (qui exige un `project_id` reel, cf. E10.3) — un
 * devis "historise" hors d un projet n a plus de sens dans le nouveau modele.
 * Cette modale reste un outil d'impression rapide ; la creation d'un devis
 * geree par l'outil de Gestion commerciale se fait desormais exclusivement
 * via "Ajouter au projet" puis "Creer un devis" depuis la fiche projet.
 */
import { useEffect, useState } from 'react';
import { X, FileText, FolderKanban, LayoutTemplate, Star } from 'lucide-react';
import { useQuoteTemplates } from '@/modules/quote-templates/ui/runtime';
import { useTenant } from '@/modules/tenants/ui/runtime';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { AddToProjectModal, buildQuotePayload } from '@/modules/projects/ui';
import {
  makeQuoteReference,
  renderQuoteHtml,
  getDefaultTemplate,
} from '@/modules/quote-templates/ui/helpers';
import { applyTax, extractTaxAmount, formatTaxLabel, getTaxRate } from '@/modules/orders/ui/helpers';

interface QuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
}

export function QuoteModal({ isOpen, onClose, product }: QuoteModalProps) {
  const [showAddToProject, setShowAddToProject] = useState(false);
  const { templates, defaultTemplateId } = useQuoteTemplates();
  const { currentTenant } = useTenant();
  const tp = useTenantPath();
  const taxRate = getTaxRate(currentTenant);

  // Gabarit a appliquer a l'impression. Initialise sur le defaut utilisateur
  // (ou builtin-classique si aucun defaut), mais l'user peut en choisir un
  // autre via le selecteur avant d'imprimer.
  const effectiveDefaultId = defaultTemplateId ?? 'builtin-classique';
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(effectiveDefaultId);
  useEffect(() => {
    // Si le defaut user change pendant que la modale est ouverte, on resync.
    setSelectedTemplateId(effectiveDefaultId);
  }, [effectiveDefaultId]);

  if (!isOpen) return null;

  const template =
    templates.find((t) => t.id === selectedTemplateId) ?? getDefaultTemplate();

  const handlePrintQuote = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Utiliser le prix Clariprint si disponible, sinon le prix estime
    const clariprintQuote = product.clariprintQuote;
    const totalHT = clariprintQuote?.costs?.total || clariprintQuote?.priceHT || product.price || 0;
    const totalTTC = applyTax(totalHT, taxRate);
    const reference = makeQuoteReference();

    // Rendu HTML via le gabarit par defaut de l'utilisateur (ou builtin classique).
    const section = renderQuoteHtml({
      template,
      reference,
      client: null,
      taxRate,
      items: [
        {
          name: product.name,
          quantity: product.quantity,
          format:
            product.format ||
            `${product.dimensions?.width ?? ''}x${product.dimensions?.height ?? ''}mm`,
          material: `${product.material ?? ''} ${product.weight ? `${product.weight}g` : ''}`.trim(),
          priceHT: totalHT,
        },
      ],
    });
    const brand = template.brand_color || '#111';
    const accent = template.accent_color || '#f59e0b';

    // Rendu via gabarit selectionne
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Devis - ${product.name}</title>
          <style>
            body{font-family:${template.font_family || 'Arial, sans-serif'};padding:40px;color:#111;background:#fff}
            h1{color:${brand};margin:0 0 8px 0;font-size:28px}
            .meta{color:#666;font-size:13px;margin-bottom:24px}
            .parties{display:flex;gap:24px;margin-bottom:24px}
            .partie{flex:1;padding:16px;border:2px solid #e5e7eb;border-radius:8px}
            .partie-title{font-weight:bold;color:${brand};font-size:13px;text-transform:uppercase;margin-bottom:10px}
            .partie-field{font-size:13px;color:#444;margin-bottom:6px}
            table{width:100%;border-collapse:collapse;margin:16px 0}
            th,td{border-bottom:1px solid #e5e7eb;padding:8px;font-size:13px;text-align:left}
            th{background:#f3f4f6;color:${brand}}
            .totals{margin-top:16px;display:flex;flex-direction:column;align-items:flex-end;gap:4px;font-size:14px}
            .totals .final{font-size:18px;font-weight:bold;color:${brand};border-top:2px solid ${brand};padding-top:8px;margin-top:8px}
            .devis{border-top:4px solid ${accent};padding-top:24px}
            .tpl-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;gap:24px}
            .tpl-logo img{max-width:160px;max-height:72px;object-fit:contain}
          </style>
        </head>
        <body>
          ${section}
          ${
            clariprintQuote?.costs
              ? `<div style="margin-top:24px;font-size:12px;color:#666;padding:12px;background:#f0f9ff;border-radius:4px;">
                   <strong>Detail des couts (source : Clariprint)</strong><br>
                   ${clariprintQuote.costs.paper ? `Papier : ${clariprintQuote.costs.paper.toFixed(2)} €<br>` : ''}
                   ${clariprintQuote.costs.print ? `Impression : ${clariprintQuote.costs.print.toFixed(2)} €<br>` : ''}
                   ${clariprintQuote.costs.makeready ? `Calage : ${clariprintQuote.costs.makeready.toFixed(2)} €<br>` : ''}
                   ${clariprintQuote.costs.packaging ? `Conditionnement : ${clariprintQuote.costs.packaging.toFixed(2)} €<br>` : ''}
                   ${clariprintQuote.costs.delivery ? `Livraison : ${clariprintQuote.costs.delivery.toFixed(2)} €<br>` : ''}
                   ${clariprintQuote.delais ? `Delai estime : ${clariprintQuote.delais} jour(s)<br>` : ''}
                   ${clariprintQuote.fournisseur ? `Imprimeur : ${clariprintQuote.fournisseur}` : ''}
                 </div>`
              : ''
          }
        </body>
      </html>
    `);

    printWindow.document.close();

    // Attendre que la fenêtre soit chargée avant d'imprimer
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">
            {product.name}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Prix */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="text-center">
            {product.clariprintQuote?.success && (
              <div className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full mb-2 font-medium">
                🖨️ Prix réel Clariprint
              </div>
            )}
            <div className="text-sm text-gray-600 mb-2">Total TTC</div>
            <div className="text-4xl font-bold text-blue-600 mb-1">
              {applyTax(
                product.clariprintQuote?.costs?.total || product.clariprintQuote?.priceHT || product.price || 0,
                taxRate,
              ).toFixed(2)} €
            </div>
            <div className="text-xs text-gray-500">
              ({(product.clariprintQuote?.costs?.total || product.clariprintQuote?.priceHT || product.price || 0).toFixed(2)} € HT
              + {extractTaxAmount(
                product.clariprintQuote?.costs?.total || product.clariprintQuote?.priceHT || product.price || 0,
                taxRate,
              ).toFixed(2)} € TVA ({formatTaxLabel(taxRate)}))
            </div>
            {product.clariprintQuote?.delais && (
              <div className="text-xs text-green-600 mt-1">⏱ Délai : {product.clariprintQuote.delais} jour(s)</div>
            )}
            {product.clariprintQuote?.fournisseur && (
              <div className="text-xs text-green-600">🏭 {product.clariprintQuote.fournisseur}</div>
            )}
          </div>
        </div>

        {/* Sélecteur de gabarit — toujours visible, user ou pas */}
        <div className="px-6 pt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
            <LayoutTemplate className="w-3.5 h-3.5 text-gray-500" strokeWidth={1.5} />
            Gabarit de devis
          </label>
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.builtin ? '★ ' : ''}
                {t.name}
                {t.id === defaultTemplateId ? ' — par défaut' : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            {selectedTemplateId === defaultTemplateId ? (
              <>
                <Star className="w-3 h-3" strokeWidth={1.5} />
                Gabarit appliqué par défaut — modifiable dans{' '}
                <a href={tp('/dashboard/quote-templates')} className="text-blue-600 hover:underline">
                  Devis › Gabarits
                </a>
              </>
            ) : (
              <>
                Gabarit temporaire pour cette impression.{' '}
                <a href={tp('/dashboard/quote-templates')} className="text-blue-600 hover:underline">
                  Changer mon gabarit par défaut
                </a>
              </>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="p-6 space-y-3">
          <button
            onClick={handlePrintQuote}
            className="w-full px-6 py-4 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-3"
          >
            <FileText className="w-5 h-5" />
            Imprimer le devis
          </button>

          <button
            onClick={() => setShowAddToProject(true)}
            className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-3"
            data-testid={TEST_IDS.project.addToProjectBtn}
          >
            <FolderKanban className="w-5 h-5" />
            Ajouter au projet
          </button>

          <button
            onClick={onClose}
            className="w-full px-6 py-3 text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>

      {showAddToProject && (
        <AddToProjectModal
          item={{
            label: product.name,
            // C3 (qa-review, corrige suite au conflit C3/C4) : le payload de
            // REJEU garde `price`/`clariprintQuote.*` en number (CA5 en
            // depend, cf. commentaire de tete de serializeQuotePayload.ts) ;
            // les montants sont dupliques en chaine Money dans `amounts`,
            // additif, destine a E10.3.
            quotePayload: buildQuotePayload(product),
            clariprintConfig: product.clariprintData ?? null,
          }}
          onClose={() => setShowAddToProject(false)}
          onAdded={() => {
            setShowAddToProject(false);
            onClose();
          }}
        />
      )}
    </div>
  );
}
