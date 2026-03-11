import { useState } from 'react';
import { ShoppingCart, X, Trash2 } from 'lucide-react';
import { useCart } from '../contexts/CartContext';

export function CartButton() {
  const [isOpen, setIsOpen] = useState(false);
  const { items, removeFromCart, clearCart, getTotalPrice } = useCart();

  const totalPrice = getTotalPrice();
  const totalTTC = totalPrice * 1.2;

  return (
    <>
      {/* Bouton panier */}
      <button
        onClick={() => setIsOpen(true)}
        className="relative px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
      >
        <ShoppingCart className="w-5 h-5" />
        <span>Calculer le prix</span>
        {items.length > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
            {items.length}
          </span>
        )}
      </button>

      {/* Modal du panier */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-6 h-6" />
                Mon panier ({items.length})
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Contenu */}
            <div className="flex-1 overflow-y-auto p-6">
              {items.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">Votre panier est vide</p>
                  <p className="text-gray-400 text-sm mt-2">
                    Ajoutez des produits depuis l'onglet "Prix & Devis"
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div
                      key={item.id}
                      className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-start justify-between"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded">
                            #{index + 1}
                          </span>
                          <h3 className="font-semibold text-gray-900">
                            {item.product.name}
                          </h3>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Quantité :</span> {item.product.quantity}
                          </div>
                          <div>
                            <span className="font-medium">Format :</span>{' '}
                            {item.product.format || `${item.product.dimensions?.width}×${item.product.dimensions?.height}mm`}
                          </div>
                          <div>
                            <span className="font-medium">Support :</span> {item.product.material}
                          </div>
                          <div>
                            <span className="font-medium">Grammage :</span> {item.product.weight}g/m²
                          </div>
                          <div className="col-span-2">
                            <span className="font-medium">Finition :</span> {item.product.finish || item.product.finishRecto}
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Prix HT :</span>
                            <span className="text-lg font-bold text-gray-900">
                              {item.product.price?.toFixed(2) || '0.00'} €
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-sm text-gray-600">Prix TTC :</span>
                            <span className="text-lg font-bold text-blue-600">
                              {((item.product.price || 0) * 1.2).toFixed(2)} €
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer avec total */}
            {items.length > 0 && (
              <div className="border-t border-gray-200 p-6 bg-gray-50">
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total HT</span>
                    <span className="font-semibold">{totalPrice.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">TVA (20%)</span>
                    <span className="font-semibold">{(totalPrice * 0.2).toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold pt-2 border-t border-gray-300">
                    <span>Total TTC</span>
                    <span className="text-blue-600">{totalTTC.toFixed(2)} €</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={clearCart}
                    className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-xl transition-colors"
                  >
                    Vider le panier
                  </button>
                  <button
                    onClick={() => {
                      alert('Fonction "Commander" à implémenter');
                    }}
                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
                  >
                    Commander ({totalTTC.toFixed(2)} €)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
