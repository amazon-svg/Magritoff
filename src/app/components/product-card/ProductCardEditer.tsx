/**
 * Onglet "Editer" de la ProductCard atelier (form inline historique).
 *
 * Extrait de ProductCard.tsx lors de R1-bis (refacto 2026-05-11).
 *
 * Note : depuis S2.4b, le bouton Editer ouvre par defaut le ProductOverlay
 * (panneau lateral droit avec recalcul Clariprint temps reel). Cet onglet
 * inline reste disponible pour les editions rapides hors overlay
 * (legacy fallback, ou si l'overlay n'est pas dispo dans le contexte).
 */

import { ChevronUp } from 'lucide-react';
import type { Client } from '../../contexts/ClientsContext';
import { TEST_IDS } from '../../lib/testIds';

interface ProductCardEditerProps {
  localProduct: any;
  clients: Client[];
  user: { id: string } | null;
  tp: (path: string) => string;
  updateProduct: (updates: Record<string, any>) => void;
  resetClariprintQuote: () => void;
  onClose: () => void;
}

export function ProductCardEditer({
  localProduct,
  clients,
  user,
  tp,
  updateProduct,
  resetClariprintQuote,
  onClose,
}: ProductCardEditerProps) {
  return (
    <div className="bg-paper border-2 border-line rounded-xl p-6 mb-3 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-ink">Éditer la configuration</h3>
        <button onClick={onClose} className="text-ink-muted hover:text-ink">
          <ChevronUp className="w-5 h-5" />
        </button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-base font-medium text-ink-2 mb-1">Client associé</label>
          {user ? (
            clients.length === 0 ? (
              <p className="text-sm text-ink-muted bg-bg border border-line rounded-lg px-3 py-2">
                Aucun client enregistré. Créez-en un depuis{' '}
                <a href={tp('/dashboard/users')} className="text-brand hover:underline">
                  le tableau de bord
                </a>
                .
              </p>
            ) : (
              <select
                value={(localProduct as any).client_id || ''}
                onChange={(e) => updateProduct({ client_id: e.target.value || null })}
                className="w-full px-3 py-2 border border-line-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Aucun —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company}
                    {c.contact_name ? ` — ${c.contact_name}` : ''}
                  </option>
                ))}
              </select>
            )
          ) : (
            <p className="text-sm text-ink-muted bg-bg border border-line rounded-lg px-3 py-2">
              Connectez-vous pour associer ce produit à un client.
            </p>
          )}
        </div>
        <div>
          <label className="block text-base font-medium text-ink-2 mb-1">Quantité</label>
          <input
            data-testid={TEST_IDS.marguerite.quoteLineQuantityInput}
            type="number"
            value={localProduct.quantity || 0}
            onChange={(e) => updateProduct({ quantity: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-line-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-base font-medium text-ink-2 mb-1">Type de papier</label>
          <input
            type="text"
            value={localProduct.material || ''}
            onChange={(e) => updateProduct({ material: e.target.value })}
            className="w-full px-3 py-2 border border-line-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-base font-medium text-ink-2 mb-1">Grammage (g/m²)</label>
          <input
            type="number"
            value={localProduct.weight || 0}
            onChange={(e) => updateProduct({ weight: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-line-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => {
            resetClariprintQuote();
            onClose();
          }}
          className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
        >
          Sauvegarder et fermer
        </button>
      </div>
    </div>
  );
}
