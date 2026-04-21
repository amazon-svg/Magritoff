import { useState } from 'react';
import { ShoppingCart, X, Trash2, FileText } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useClients, Client } from '../contexts/ClientsContext';
import { makeQuoteReference, persistQuote, renderClientBlockHtml } from '../utils/quote';

export function CartButton() {
  const [isOpen, setIsOpen] = useState(false);
  const { items, removeFromCart, clearCart, getTotalPrice, updateItemClient } = useCart();
  const { user } = useAuth();
  const { clients } = useClients();

  const totalPrice = getTotalPrice();
  const totalTTC = totalPrice * 1.2;

  // Groupe les items du panier par client_id (null = "sans client")
  const groupByClient = () => {
    const map = new Map<string | null, typeof items>();
    for (const item of items) {
      const key = (item.product?.client_id as string) || null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()); // [ [clientId | null, items[]] ]
  };

  const uniqueClientCount = new Set(items.map((i) => i.product?.client_id || null)).size;

  const handlePrintQuotes = () => {
    if (items.length === 0) return;
    const groups = groupByClient();

    // Fenêtre ouverte SYNCHRONE pour ne pas être bloquée par le navigateur.
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Le navigateur a bloqué la fenêtre d'impression. Autorisez les popups pour ce site.");
      return;
    }

    // Génère un bloc devis par groupe de client.
    const devisBlocks: string[] = [];
    const toPersist: Array<{ ref: string; clientId: string | null; items: typeof items }> = [];

    for (const [clientId, groupItems] of groups) {
      const client: Client | null = clients.find((c) => c.id === clientId) || null;
      const reference = makeQuoteReference();
      toPersist.push({ ref: reference, clientId, items: groupItems });

      const groupTotalHT = groupItems.reduce((sum, item) => {
        const p = item.product;
        const cp = p.clariprintQuote;
        return sum + (cp?.costs?.total ?? cp?.priceHT ?? p.price ?? 0);
      }, 0);

      const rows = groupItems
        .map((item) => {
          const p = item.product;
          const cp = p.clariprintQuote;
          const ht = cp?.costs?.total ?? cp?.priceHT ?? p.price ?? 0;
          return `
            <tr>
              <td>${escapeHtml(p.name)}</td>
              <td>${p.quantity ?? ''}</td>
              <td>${escapeHtml(p.format ?? '')}</td>
              <td>${escapeHtml(p.material ?? '')} ${p.weight ?? ''}g</td>
              <td style="text-align:right">${ht.toFixed(2)} €</td>
            </tr>
          `;
        })
        .join('');

      devisBlocks.push(`
        <section class="devis">
          <h1>DEVIS ${reference}</h1>
          <div class="meta">Date : ${new Date().toLocaleDateString('fr-FR')} · Validité : 30 jours · ${groupItems.length} produit(s)</div>
          <div class="parties">
            <div class="partie">
              <div class="partie-title">Émetteur</div>
              <div class="partie-field">Société : Magrit Print</div>
            </div>
            <div class="partie">
              <div class="partie-title">Client</div>
              ${renderClientBlockHtml(client)}
            </div>
          </div>
          <table>
            <thead><tr><th>Produit</th><th>Qté</th><th>Format</th><th>Support</th><th style="text-align:right">HT</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="totals">
            <div>Total HT : <strong>${groupTotalHT.toFixed(2)} €</strong></div>
            <div>TVA (20 %) : <strong>${(groupTotalHT * 0.2).toFixed(2)} €</strong></div>
            <div class="final">Total TTC : ${(groupTotalHT * 1.2).toFixed(2)} €</div>
          </div>
        </section>
      `);
    }

    // Persistance DB en arrière-plan.
    if (user) {
      void Promise.all(
        toPersist.flatMap(({ ref, clientId, items }) =>
          items.map((item) => {
            const p = item.product;
            const cp = p.clariprintQuote;
            const totalHT = cp?.costs?.total ?? cp?.priceHT ?? p.price ?? 0;
            return persistQuote(user.id, {
              reference: ref,
              client_id: clientId,
              product_name: p.name,
              product_config: p,
              total_ht: totalHT,
              total_ttc: totalHT * 1.2,
            });
          })
        )
      );
    }

    printWindow.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Devis du panier</title>
      <style>
        body{font-family:Arial,sans-serif;padding:40px;color:#111}
        h1{color:#1e3a8a;margin:0 0 8px 0;font-size:28px}
        .meta{color:#666;font-size:13px;margin-bottom:24px}
        .parties{display:flex;gap:24px;margin-bottom:24px}
        .partie{flex:1;padding:16px;border:2px solid #e5e7eb;border-radius:8px}
        .partie-title{font-weight:bold;color:#1e3a8a;font-size:13px;text-transform:uppercase;margin-bottom:10px}
        .partie-field{font-size:13px;color:#444;margin-bottom:6px}
        table{width:100%;border-collapse:collapse;margin:16px 0}
        th,td{border-bottom:1px solid #e5e7eb;padding:8px;font-size:13px;text-align:left}
        th{background:#f3f4f6;color:#1e3a8a}
        .totals{margin-top:16px;display:flex;flex-direction:column;align-items:flex-end;gap:4px;font-size:14px}
        .totals .final{font-size:18px;font-weight:bold;color:#1e3a8a;border-top:2px solid #1e3a8a;padding-top:8px;margin-top:8px}
        .devis{margin-bottom:40px}
        .devis + .devis{page-break-before:always;border-top:2px dashed #ddd;padding-top:40px}
      </style></head><body>
        ${devisBlocks.join('')}
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="relative px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
      >
        <ShoppingCart className="w-5 h-5" />
        <span>Panier</span>
        {items.length > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
            {items.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-6 h-6" />
                Mon panier ({items.length})
                {uniqueClientCount > 1 && (
                  <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                    {uniqueClientCount} clients
                  </span>
                )}
              </h2>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

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
                          <h3 className="font-semibold text-gray-900">{item.product.name}</h3>
                        </div>

                        {/* Sélecteur de client par item */}
                        <div className="mb-3">
                          <label className="text-xs font-medium text-gray-700 block mb-1">
                            Client associé à ce devis
                          </label>
                          {!user ? (
                            <p className="text-xs text-gray-500 italic">Connectez-vous pour associer un client.</p>
                          ) : clients.length === 0 ? (
                            <p className="text-xs text-gray-500 italic">
                              Aucun client.{' '}
                              <a href="/dashboard/clients" className="text-blue-600 hover:underline">
                                Ajouter un client
                              </a>
                            </p>
                          ) : (
                            <select
                              value={item.product?.client_id || ''}
                              onChange={(e) => updateItemClient(item.id, e.target.value || null)}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">— Aucun client —</option>
                              {clients.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.company}
                                  {c.contact_name ? ` — ${c.contact_name}` : ''}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                          <div><span className="font-medium">Quantité :</span> {item.product.quantity}</div>
                          <div>
                            <span className="font-medium">Format :</span>{' '}
                            {item.product.format ||
                              `${item.product.dimensions?.width}×${item.product.dimensions?.height}mm`}
                          </div>
                          <div><span className="font-medium">Support :</span> {item.product.material}</div>
                          <div><span className="font-medium">Grammage :</span> {item.product.weight}g/m²</div>
                          <div className="col-span-2">
                            <span className="font-medium">Finition :</span>{' '}
                            {item.product.finish || item.product.finishRecto}
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
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={clearCart}
                    className="flex-1 min-w-[120px] px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-xl"
                  >
                    Vider le panier
                  </button>
                  <button
                    onClick={handlePrintQuotes}
                    className="flex-1 min-w-[160px] px-4 py-3 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-xl flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Imprimer les devis
                    {uniqueClientCount > 1 && (
                      <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
                        {uniqueClientCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => alert('Fonction "Commander" à implémenter')}
                    className="flex-1 min-w-[160px] px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl"
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

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
