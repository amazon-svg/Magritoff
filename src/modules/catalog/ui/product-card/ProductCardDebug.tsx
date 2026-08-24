/**
 * Onglet "Debug" de la ProductCard atelier.
 *
 * Extrait de ProductCard.tsx lors du R1 Phase B (refacto 2026-05-11).
 * Affiche la requete et la reponse brute Clariprint pour le debug Pro
 * (deviseur atelier qui veut comprendre pourquoi Clariprint retourne tel
 * prix ou telle anomalie).
 */

import { ChevronUp } from 'lucide-react';

interface ProductCardDebugProps {
  clariprintData: Record<string, unknown> | null | undefined;
  lastRawResponse: string | null;
  clariprintLoading: boolean;
  onClose: () => void;
}

export function ProductCardDebug({
  clariprintData,
  lastRawResponse,
  clariprintLoading,
  onClose,
}: ProductCardDebugProps) {
  return (
    <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-4 mb-3 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-slate-300 font-mono font-bold text-base">🔍 Debug Clariprint</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          <ChevronUp className="w-5 h-5" />
        </button>
      </div>

      {/* Requête envoyée */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-mono font-bold text-slate-300">
            📤 Requête envoyée à Clariprint (POST /optimproject/json.wcl)
          </span>
          <button
            onClick={() =>
              navigator.clipboard.writeText(
                JSON.stringify({ clariprint_product: clariprintData }, null, 2),
              )
            }
            className="text-sm text-slate-400 hover:text-white border border-slate-600 px-2 py-0.5 rounded transition-colors"
          >
            Copier
          </button>
        </div>
        {clariprintData ? (
          <pre className="text-sm text-green-300 overflow-auto max-h-72 leading-relaxed bg-slate-950 rounded-lg p-3">
            {JSON.stringify({ clariprint_product: clariprintData }, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-slate-500 italic p-3 bg-slate-950 rounded-lg">
            Aucune donnée Clariprint disponible sur ce produit.
          </p>
        )}
      </div>

      {/* Réponse brute reçue */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-mono font-bold text-slate-300">
            📩 Réponse brute Clariprint
          </span>
          {lastRawResponse && (
            <button
              onClick={() => navigator.clipboard.writeText(lastRawResponse)}
              className="text-sm text-slate-400 hover:text-white border border-slate-600 px-2 py-0.5 rounded transition-colors"
            >
              Copier
            </button>
          )}
        </div>
        {lastRawResponse ? (
          <pre className="text-sm text-yellow-200 overflow-auto max-h-72 leading-relaxed bg-slate-950 rounded-lg p-3">
            {lastRawResponse}
          </pre>
        ) : (
          <p className="text-sm text-slate-500 italic p-3 bg-slate-950 rounded-lg">
            {clariprintLoading
              ? '⏳ Appel en cours...'
              : 'Aucune réponse encore — cliquez "Obtenir le prix réel Clariprint" dans l\'onglet Prix & Devis.'}
          </p>
        )}
      </div>
    </div>
  );
}
