/**
 * Onglet "Fiche" de la ProductCard atelier.
 *
 * Extrait de ProductCard.tsx lors de R1-bis (refacto 2026-05-11).
 * Affiche :
 *  - Synthese tabulaire (produit / quantite / format / papier / grammage /
 *    impression / finitions / pages / type Clariprint / client associe).
 *  - Bloc PIM "Fiche commerciale" (definition resolved : description, FAQ,
 *    usage_examples, gamme PIM).
 *  - Sous-section SEO/GEO (ProductPimSeoSection) avec 9 champs PIM.
 *  - Bloc config Clariprint brute (JSON debug expandable).
 */

import { ChevronUp } from 'lucide-react';
import { ProductPimSeoSection } from '../ProductPimSeoSection';
import type { EnrichedProduct } from '../../utils/productEnrichment';
import type { Client } from '../../contexts/ClientsContext';

interface ProductCardFicheProps {
  localProduct: any;
  enriched: EnrichedProduct | null;
  clients: Client[];
  onClose: () => void;
}

export function ProductCardFiche({
  localProduct,
  enriched,
  clients,
  onClose,
}: ProductCardFicheProps) {
  return (
    <div className="bg-paper border-2 border-line rounded-xl p-6 mb-3 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-ink">Fiche produit détaillée</h3>
        <button onClick={onClose} className="text-ink-muted hover:text-ink">
          <ChevronUp className="w-5 h-5" />
        </button>
      </div>
      <div className="space-y-2 text-base">
        {([
          ['Produit', localProduct.name],
          ['Quantité', localProduct.quantity || 0],
          [
            'Format',
            localProduct.format ||
              `${localProduct.dimensions?.width || 0} × ${localProduct.dimensions?.height || 0} mm`,
          ],
          ['Papier', localProduct.material || '—'],
          ['Grammage', `${localProduct.weight || 0} g/m²`],
          [
            'Impression',
            `${localProduct.printing?.recto || 'Quadrichromie'} / ${localProduct.printing?.verso || 'Sans impression'}`,
          ],
          ['Finition recto', localProduct.finishRecto || localProduct.finish || 'Sans finition'],
          ['Finition verso', localProduct.finishVerso || 'Sans finition'],
          ...(localProduct.pages ? [['Pages', localProduct.pages]] : []),
          ...(localProduct.clariprintData?.kind
            ? [['Type Clariprint', localProduct.clariprintData.kind]]
            : []),
          ...(localProduct.client_id
            ? [
                [
                  'Client',
                  clients.find((c) => c.id === localProduct.client_id)?.company || '—',
                ],
              ]
            : []),
        ] as Array<[string, string | number]>).map(([label, value], i, arr) => (
          <div
            key={String(label)}
            className={`flex justify-between py-2 ${i < arr.length - 1 ? 'border-b border-line' : ''}`}
          >
            <span className="text-ink-muted">{label}</span>
            <span className="font-semibold">{String(value)}</span>
          </div>
        ))}
      </div>

      {/* Contenu enrichi PIM */}
      {enriched?.definition && (
        <div className="mt-5 pt-4 border-t border-line space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold uppercase tracking-wider text-brand">
              Fiche commerciale
            </span>
            {enriched.gamme && (
              <span className="text-[10px] bg-blue-50 text-brand border border-blue-200 px-1.5 py-0.5 rounded">
                {enriched.gamme.name}
              </span>
            )}
          </div>
          {enriched.resolved.short_description && (
            <p className="text-base text-ink-2 italic">{enriched.resolved.short_description}</p>
          )}
          {enriched.resolved.description && (
            <div className="text-base text-ink-2 whitespace-pre-line">
              {enriched.resolved.description}
            </div>
          )}
          {enriched.resolved.usage_examples.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-ink-2 mb-1">Cas d'usage</p>
              <ul className="space-y-1 text-sm text-ink-muted">
                {enriched.resolved.usage_examples.map((ex, i) => (
                  <li key={i}>
                    <span className="font-medium text-ink">{ex.title}</span>
                    {ex.description ? <span> — {ex.description}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {enriched.resolved.faq.length > 0 && (
            <details>
              <summary className="text-sm font-semibold text-ink-2 cursor-pointer hover:text-ink">
                FAQ ({enriched.resolved.faq.length})
              </summary>
              <div className="mt-2 space-y-2">
                {enriched.resolved.faq.map((qa, i) => (
                  <div key={i} className="text-sm">
                    <p className="font-medium text-ink">{qa.question}</p>
                    <p className="text-ink-muted mt-0.5">{qa.answer}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* S-FIX-1 — Section SEO/GEO complementaire (h1, meta, keywords, schema_org, quality_score, copier JSON) */}
      <ProductPimSeoSection enriched={enriched} />

      {/* Config Clariprint brute */}
      {localProduct.clariprintData && (
        <details className="mt-4">
          <summary className="text-sm text-ink-muted cursor-pointer hover:text-ink">
            🔧 Voir la config Clariprint (JSON API)
          </summary>
          <pre className="mt-2 p-3 bg-bg rounded-lg text-sm text-ink-muted overflow-auto max-h-48">
            {JSON.stringify(localProduct.clariprintData, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
