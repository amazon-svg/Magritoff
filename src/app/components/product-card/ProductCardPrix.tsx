/**
 * Onglet "Prix & Devis" de la ProductCard atelier.
 *
 * Extrait de ProductCard.tsx lors de R1-bis (refacto 2026-05-11).
 * Affiche :
 *  - Le prix HT estime ou Clariprint, la TVA selon taxRate (R0 Spike H),
 *    le Total TTC (clickable → ouvre QuoteModal).
 *  - Bloc Clariprint avec :
 *      • bouton "Obtenir le prix reel" initial
 *      • state loading / succes / erreur / credentialsMissing
 *      • panneau debug expandable (requete + reponse brute)
 *      • detail des couts (papier/print/calage/conditionnement/livraison)
 *      • infos complementaires (delais, poids, fournisseur)
 *      • bouton recalculer
 *  - Bouton final "Imprimer le devis / Ajouter au panier" (ouvre QuoteModal).
 *
 * Note : le state `showDebug` est gere localement (specifique a ce panneau).
 */

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ChevronUp,
  Loader2,
  Lock,
  Printer,
  RefreshCw,
} from 'lucide-react';
import { TEST_IDS } from '../../lib/testIds';
import { applyTax, extractTaxAmount, formatTaxLabel } from '../../utils/tax';
import type { ClariprintQuoteResult } from '../../utils/clariprintQuote';

interface ProductCardPrixProps {
  localProduct: any;
  displayPriceHT: number;
  taxRate: number;
  user: { id: string } | null;
  clariprintQuote: ClariprintQuoteResult | null;
  clariprintLoading: boolean;
  lastRawResponse: string | null;
  onCompute: () => Promise<void> | void;
  onOpenQuoteModal: () => void;
  onClose: () => void;
}

export function ProductCardPrix({
  localProduct,
  displayPriceHT,
  taxRate,
  user,
  clariprintQuote,
  clariprintLoading,
  lastRawResponse,
  onCompute,
  onOpenQuoteModal,
  onClose,
}: ProductCardPrixProps) {
  const [showDebug, setShowDebug] = useState(false);

  return (
    <div className="bg-paper border-2 border-line rounded-xl p-6 mb-3 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-ink">Tarification</h3>
        <button onClick={onClose} className="text-ink-muted hover:text-ink">
          <ChevronUp className="w-5 h-5" />
        </button>
      </div>

      {/* Prix estimé (floutés si non-authentifié) */}
      {!user && (
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-base text-amber-800">
          <Lock className="w-4 h-4 shrink-0" />
          <span>Connectez-vous pour voir les prix.</span>
        </div>
      )}
      <div className="space-y-2 text-base mb-4">
        <div className="flex justify-between py-2 border-b border-line">
          <span className="text-ink-muted text-sm">
            {clariprintQuote?.success ? 'Prix Clariprint HT' : 'Prix estimé HT'}
          </span>
          <span className={`font-semibold ${!user ? 'blur-sm select-none' : ''}`}>
            {displayPriceHT.toFixed(2)} €
          </span>
        </div>
        <div className="flex justify-between py-2 border-b border-line">
          <span className="text-ink-muted">TVA ({formatTaxLabel(taxRate)})</span>
          <span className={`font-semibold ${!user ? 'blur-sm select-none' : ''}`}>
            {extractTaxAmount(displayPriceHT, taxRate).toFixed(2)} €
          </span>
        </div>
        <div
          className="flex justify-between items-center py-3 bg-gray-900 text-white px-4 rounded-lg mt-1 cursor-pointer hover:bg-gray-800 transition-colors"
          onClick={onOpenQuoteModal}
          title="Cliquer pour le devis"
        >
          <span className="font-semibold text-base">Total TTC</span>
          <span className={`text-xl font-bold ${!user ? 'blur-sm select-none' : ''}`}>
            {applyTax(displayPriceHT, taxRate).toFixed(2)} €
          </span>
        </div>
      </div>

      {/* Section Clariprint */}
      {localProduct.clariprintData && (
        <div className="border-t border-line pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-indigo-600" />
              <h4 className="text-base font-semibold text-ink">Prix réel Clariprint</h4>
            </div>
            <button
              onClick={() => setShowDebug((v) => !v)}
              className={`text-sm px-2 py-1 rounded border transition-colors ${
                showDebug
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'text-ink-mute-2 border-line hover:border-gray-400 hover:text-ink-muted'
              }`}
              title="Afficher / masquer la requête envoyée à Clariprint"
            >
              {showDebug ? 'Masquer debug' : '🔍 Debug'}
            </button>
          </div>

          {/* Panneau debug expandable */}
          {showDebug && (
            <div className="mb-4 space-y-3">
              <div className="bg-slate-900 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-mono font-bold text-slate-300">
                    📤 POST /optimproject/json.wcl
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        JSON.stringify(
                          { clariprint_product: localProduct.clariprintData },
                          null,
                          2,
                        ),
                      );
                    }}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Copier
                  </button>
                </div>
                <pre className="text-sm text-green-300 overflow-auto max-h-64 leading-relaxed">
                  {JSON.stringify({ clariprint_product: localProduct.clariprintData }, null, 2)}
                </pre>
              </div>

              {lastRawResponse && (
                <div className="bg-slate-800 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-mono font-bold text-slate-300">
                      📩 Réponse Clariprint (brute)
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(lastRawResponse)}
                      className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      Copier
                    </button>
                  </div>
                  <pre className="text-sm text-yellow-200 overflow-auto max-h-64 leading-relaxed">
                    {lastRawResponse}
                  </pre>
                </div>
              )}

              {!lastRawResponse && !clariprintLoading && (
                <p className="text-sm text-slate-400 italic">
                  La réponse brute s'affichera ici après l'appel.
                </p>
              )}
            </div>
          )}

          {/* Loading */}
          {clariprintLoading && (
            <div
              data-testid={TEST_IDS.quote.priceLoading}
              className="flex items-center gap-2 text-indigo-600 text-base py-3"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Calcul en cours auprès des imprimeurs...</span>
            </div>
          )}

          {/* Credentials manquants */}
          {!clariprintLoading && clariprintQuote?.credentialsMissing && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-base">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-amber-800 mb-1">Credentials non configurés</p>
                  <p className="text-amber-700 text-sm">
                    Ajoutez <code className="bg-amber-100 px-1 rounded">CLARIPRINT_LOGIN</code>{' '}
                    et{' '}
                    <code className="bg-amber-100 px-1 rounded">CLARIPRINT_PASSWORD</code> dans
                    vos secrets Supabase.
                  </p>
                </div>
              </div>
              <button
                onClick={() => void onCompute()}
                className="mt-3 text-sm text-amber-700 underline hover:no-underline"
              >
                Réessayer
              </button>
            </div>
          )}

          {/* Succès Clariprint */}
          {!clariprintLoading && clariprintQuote?.success && (
            <div
              data-testid={TEST_IDS.quote.priceDisplay}
              className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2 text-base"
            >
              <div className="flex items-center gap-1 mb-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">
                  Prix obtenu depuis le réseau Clariprint
                </span>
              </div>

              {clariprintQuote.costs && (
                <div className="space-y-1 text-sm">
                  {(
                    [
                      ['Papier', clariprintQuote.costs.paper],
                      ['Impression', clariprintQuote.costs.print],
                      ['Calage / Make-ready', clariprintQuote.costs.makeready],
                      ['Conditionnement', clariprintQuote.costs.packaging],
                      ['Livraison', clariprintQuote.costs.delivery],
                    ] as Array<[string, number | undefined]>
                  )
                    .filter(([, v]) => v != null && (v as number) > 0)
                    .map(([label, val]) => (
                      <div key={String(label)} className="flex justify-between text-ink-muted">
                        <span>{label}</span>
                        <span className={!user ? 'blur-sm select-none' : ''}>
                          {(val as number).toFixed(2)} €
                        </span>
                      </div>
                    ))}
                  <div className="flex justify-between font-semibold text-green-800 border-t border-green-200 pt-1 mt-1">
                    <span>Total HT</span>
                    <span className={!user ? 'blur-sm select-none' : ''}>
                      {(clariprintQuote.costs.total || clariprintQuote.priceHT || 0).toFixed(2)} €
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-between bg-green-700 text-white px-3 py-2 rounded-lg font-bold text-base">
                <span>Total TTC</span>
                <span className={!user ? 'blur-sm select-none' : ''}>
                  {applyTax(
                    clariprintQuote.costs?.total || clariprintQuote.priceHT || 0,
                    taxRate,
                  ).toFixed(2)}{' '}
                  €
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-sm text-green-700">
                {clariprintQuote.delais != null && (
                  <div className="bg-white rounded-lg p-2 border border-green-100">
                    <div className="text-ink-muted mb-0.5">Délai estimé</div>
                    <div className="font-semibold">
                      {clariprintQuote.delais} jour{clariprintQuote.delais > 1 ? 's' : ''}
                    </div>
                  </div>
                )}
                {clariprintQuote.weight != null && (
                  <div className="bg-white rounded-lg p-2 border border-green-100">
                    <div className="text-ink-muted mb-0.5">Poids</div>
                    <div className="font-semibold">{clariprintQuote.weight.toFixed(2)} kg</div>
                  </div>
                )}
                {clariprintQuote.fournisseur && (
                  <div className="bg-white rounded-lg p-2 border border-green-100 col-span-2">
                    <div className="text-ink-muted mb-0.5">Imprimeur sélectionné</div>
                    <div className="font-semibold">{clariprintQuote.fournisseur}</div>
                  </div>
                )}
              </div>

              <button
                data-testid={TEST_IDS.quote.refreshBtn}
                onClick={() => void onCompute()}
                className="w-full mt-1 flex items-center justify-center gap-1.5 text-sm text-green-700 hover:text-green-900 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Recalculer
              </button>
            </div>
          )}

          {/* Erreur Clariprint */}
          {!clariprintLoading &&
            clariprintQuote &&
            !clariprintQuote.success &&
            !clariprintQuote.credentialsMissing && (
              <div
                data-testid={TEST_IDS.quote.priceErrorBanner}
                className="bg-red-50 border border-red-200 rounded-xl p-3 text-base"
              >
                <p className="text-red-700 font-medium mb-1">❌ Erreur Clariprint</p>
                <p className="text-red-600 text-sm mb-1">
                  {clariprintQuote.message || clariprintQuote.error || 'Erreur inconnue'}
                </p>
                {clariprintQuote.details && (
                  <details className="mt-1">
                    <summary className="text-sm text-red-500 cursor-pointer hover:text-red-700">
                      Voir les détails techniques
                    </summary>
                    <pre className="mt-1 p-2 bg-red-100 rounded text-sm text-red-700 overflow-auto max-h-32 whitespace-pre-wrap">
                      {clariprintQuote.details}
                    </pre>
                  </details>
                )}
                <button
                  onClick={() => void onCompute()}
                  className="mt-2 text-sm text-red-600 underline hover:no-underline"
                >
                  Réessayer
                </button>
              </div>
            )}

          {/* Bouton initial */}
          {!clariprintLoading && !clariprintQuote && (
            <button
              onClick={() => void onCompute()}
              className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 text-base"
            >
              <Printer className="w-4 h-4" />
              Obtenir le prix réel Clariprint
            </button>
          )}
        </div>
      )}

      {/* Bouton devis/panier */}
      <button
        onClick={onOpenQuoteModal}
        className="w-full mt-4 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
      >
        Imprimer le devis / Ajouter au panier
      </button>
    </div>
  );
}
