import { ShoppingCart, Link as LinkIcon, Menu } from "lucide-react";
import { Link } from "react-router";
import { resolvePrice } from "../utils/priceResolver";
import type { ClariprintQuoteResult } from "../utils/clariprintQuote";

interface PricingPanelProps {
  product: any;
  /** Optionnel : résultat Clariprint si disponible côté parent */
  clariprintQuote?: ClariprintQuoteResult | null;
}

export function PricingPanel({ product, clariprintQuote }: PricingPanelProps) {
  // Fix S0.2 (2026-05-09) : utilisation du helper unique resolvePrice() au lieu
  // d'un accès direct à product.price. Élimine le « 2e prix mystère » signalé
  // par Arnaud et aligne ce composant avec ProductCard / QuoteModal / etc.
  const priceResolution = resolvePrice(product, clariprintQuote);

  return (
    <div className="w-80 border-l border-gray-200 bg-white p-6">
      <div className="space-y-4">
        {/* Actions */}
        <div className="flex items-center gap-2">
          <button className="p-2 border border-gray-300 rounded hover:bg-gray-50">
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <button className="p-2 border border-gray-300 rounded hover:bg-gray-50">
            <LinkIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Price Card */}
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <ShoppingCart className="w-6 h-6 text-gray-700" />
            <span className="text-3xl font-bold text-gray-900">
              {priceResolution.priceHT.toFixed(2)} €
            </span>
          </div>
          {priceResolution.isMarketPrice && (
            <div className="mb-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-orange-100 border border-orange-300 text-orange-800 text-xs font-medium">
              ⚠️ Prix marché
              <span className="text-[10px] text-orange-600 italic">
                (prix réel Clariprint à venir)
              </span>
            </div>
          )}
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Quantité</span>
              <span className="text-gray-900">{product.quantity} ex</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Dimensions</span>
              <span className="text-gray-900">{product.height} × {product.width} mm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Matière</span>
              <span className="text-gray-900">{product.material}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Grammage</span>
              <span className="text-gray-900">{product.weight} g/m²</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-yellow-200">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Délai</span>
              <span className="text-sm font-medium text-gray-900">1 jour(s)</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <Link 
            to={`/product/${product.id}`}
            className="block w-full px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-center rounded text-sm font-medium"
          >
            Fiche produit
          </Link>
          <button className="w-full px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded text-sm font-medium">
            Ajouter au panier
          </button>
          <Link 
            to={`/personalization/${product.id}`}
            className="block w-full px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-center rounded text-sm"
          >
            Personnalisation
          </Link>
        </div>

        {/* Printer Info */}
        <div className="pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-600 mb-2">Imprimeur recommandé</div>
          <div className="text-sm text-gray-900">
            Imprimerie Rochelaise Numérique
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Konica Xerox Epson
          </div>
        </div>
      </div>
    </div>
  );
}
