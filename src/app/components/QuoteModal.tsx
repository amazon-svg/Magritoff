import { X, FileText, ShoppingCart } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import devisTemplate from 'figma:asset/227369c3072447219837cadaaa943294de19bf62.png';

interface QuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
}

export function QuoteModal({ isOpen, onClose, product }: QuoteModalProps) {
  const { addToCart } = useCart();

  if (!isOpen) return null;

  const handleAddToCart = () => {
    addToCart(product);
    onClose();
  };

  const handlePrintQuote = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Utiliser le prix Clariprint si disponible, sinon le prix estimé
    const clariprintQuote = product.clariprintQuote;
    const totalHT = clariprintQuote?.costs?.total || clariprintQuote?.priceHT || product.price || 0;
    const tva = totalHT * 0.2;
    const totalTTC = totalHT * 1.2;
    const isClariprintPrice = !!(clariprintQuote?.success);

    // Générer le HTML du devis
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Devis - ${product.name}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Arial', sans-serif;
              padding: 40px;
              background: white;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 4px solid #f59e0b;
            }
            .logo-section {
              flex: 1;
            }
            .logo-box {
              background: #1e3a8a;
              color: white;
              padding: 20px;
              border-radius: 8px;
              max-width: 200px;
            }
            .logo-title {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .logo-subtitle {
              font-size: 11px;
              opacity: 0.9;
            }
            .devis-title {
              flex: 2;
              text-align: center;
            }
            .devis-title h1 {
              font-size: 48px;
              font-weight: bold;
              color: #1e3a8a;
              margin-bottom: 5px;
            }
            .devis-subtitle {
              font-size: 14px;
              color: #666;
            }
            .devis-info {
              flex: 1;
              text-align: right;
            }
            .devis-number {
              font-size: 14px;
              color: #666;
              margin-bottom: 5px;
            }
            .devis-date {
              font-size: 12px;
              color: #666;
            }
            .parties {
              display: flex;
              gap: 30px;
              margin-bottom: 30px;
            }
            .partie {
              flex: 1;
              padding: 20px;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
            }
            .partie-title {
              font-weight: bold;
              color: #1e3a8a;
              margin-bottom: 15px;
              font-size: 14px;
              text-transform: uppercase;
            }
            .partie-field {
              margin-bottom: 10px;
              font-size: 13px;
              color: #666;
            }
            .section {
              margin-bottom: 25px;
            }
            .section-title {
              background: #1e3a8a;
              color: white;
              padding: 10px 15px;
              font-weight: bold;
              margin-bottom: 15px;
              font-size: 14px;
            }
            .section-content {
              padding: 0 15px;
            }
            .field-row {
              display: flex;
              gap: 20px;
              margin-bottom: 12px;
            }
            .field {
              flex: 1;
            }
            .field-label {
              font-size: 12px;
              color: #666;
              margin-bottom: 5px;
            }
            .field-value {
              font-size: 14px;
              font-weight: 600;
              color: #1e3a8a;
              padding: 8px 12px;
              background: #f3f4f6;
              border-radius: 4px;
            }
            .total-section {
              margin-top: 40px;
              padding: 25px;
              background: #f9fafb;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 10px;
              font-size: 16px;
            }
            .total-row.final {
              margin-top: 15px;
              padding-top: 15px;
              border-top: 2px solid #1e3a8a;
              font-size: 20px;
              font-weight: bold;
              color: #1e3a8a;
            }
            .footer {
              margin-top: 50px;
              padding-top: 20px;
              border-top: 4px solid #f59e0b;
              text-align: center;
              font-size: 11px;
              color: #666;
            }
            @media print {
              body {
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <!-- Header -->
          <div class="header">
            <div class="logo-section">
              <div class="logo-box">
                <div class="logo-title">VOTRE LOGO</div>
                <div class="logo-subtitle">Imprimerie & Communication</div>
              </div>
            </div>
            <div class="devis-title">
              <h1>DEVIS</h1>
              <div class="devis-subtitle">Offre de prix — Impression & Façonnage</div>
            </div>
            <div class="devis-info">
              <div class="devis-number">N° DEVIS<br><strong>DEV-2025-____</strong></div>
              <div class="devis-date">Date : ${new Date().toLocaleDateString('fr-FR')}</div>
              <div class="devis-date">Validité : 30 jours</div>
            </div>
          </div>

          <!-- Parties -->
          <div class="parties">
            <div class="partie">
              <div class="partie-title">ÉMETTEUR — IMPRIMERIE</div>
              <div class="partie-field">Société : Magrit Print</div>
              <div class="partie-field">Adresse : </div>
              <div class="partie-field">CP / Ville : </div>
              <div class="partie-field">Tél. : </div>
            </div>
            <div class="partie">
              <div class="partie-title">CLIENT / DONNEUR D'ORDRE</div>
              <div class="partie-field">Société / Nom : </div>
              <div class="partie-field">Adresse : </div>
              <div class="partie-field">CP / Ville : </div>
              <div class="partie-field">Tél. / Email : </div>
            </div>
          </div>

          <!-- Section 1 : Identification du travail -->
          <div class="section">
            <div class="section-title">1 — IDENTIFICATION DU TRAVAIL</div>
            <div class="section-content">
              <div class="field-row">
                <div class="field">
                  <div class="field-label">Nom du projet / Titre du document</div>
                  <div class="field-value">${product.name}</div>
                </div>
              </div>
              <div class="field-row">
                <div class="field">
                  <div class="field-label">Type de produit</div>
                  <div class="field-value">${product.name}</div>
                </div>
                <div class="field">
                  <div class="field-label">Quantité</div>
                  <div class="field-value">${product.quantity} exemplaires</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 2 : Format & Support -->
          <div class="section">
            <div class="section-title">2 — FORMAT & SUPPORT</div>
            <div class="section-content">
              <div class="field-row">
                <div class="field">
                  <div class="field-label">Format fini (L × H en mm)</div>
                  <div class="field-value">${product.format || `${product.dimensions?.width} × ${product.dimensions?.height} mm`}</div>
                </div>
                <div class="field">
                  <div class="field-label">Grammage (g/m²)</div>
                  <div class="field-value">${product.weight} g/m²</div>
                </div>
              </div>
              <div class="field-row">
                <div class="field">
                  <div class="field-label">Type de papier (couché, offset, bouffant...)</div>
                  <div class="field-value">${product.material}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 3 : Impression -->
          <div class="section">
            <div class="section-title">3 — IMPRESSION</div>
            <div class="section-content">
              <div class="field-row">
                <div class="field">
                  <div class="field-label">Couleurs recto</div>
                  <div class="field-value">${product.printing?.recto || 'Quadrichromie (CMJN)'}</div>
                </div>
                <div class="field">
                  <div class="field-label">Couleurs verso</div>
                  <div class="field-value">${product.printing?.verso || 'Sans impression'}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 4 : Façonnage & Finitions -->
          <div class="section">
            <div class="section-title">4 — FAÇONNAGE & FINITIONS</div>
            <div class="section-content">
              <div class="field-row">
                <div class="field">
                  <div class="field-label">Pelliculage / Vernis</div>
                  <div class="field-value">${product.finish || product.finishRecto}</div>
                </div>
              </div>
              ${product.suggestions && product.suggestions.length > 0 ? `
              <div class="field-row">
                <div class="field">
                  <div class="field-label">Options suggérées</div>
                  <div class="field-value">${product.suggestions.join(' • ')}</div>
                </div>
              </div>
              ` : ''}
            </div>
          </div>

          <!-- Section 5 : Conditionnement & Livraison -->
          <div class="section">
            <div class="section-title">5 — CONDITIONNEMENT & LIVRAISON</div>
            <div class="section-content">
              <div class="field-row">
                <div class="field">
                  <div class="field-label">Conditionnement</div>
                  <div class="field-value">${product.packaging || 'Standard'}</div>
                </div>
                <div class="field">
                  <div class="field-label">Adresse de livraison</div>
                  <div class="field-value">${product.deliveryLocation || 'France'}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Total -->
          <div class="total-section">
            ${isClariprintPrice && clariprintQuote?.costs ? `
            <div style="font-size:12px;color:#666;margin-bottom:12px;padding:8px;background:#f0f9ff;border-radius:4px;">
              <strong>Détail des coûts (source : Clariprint)</strong><br>
              ${clariprintQuote.costs.paper ? `Papier : ${clariprintQuote.costs.paper.toFixed(2)} €<br>` : ''}
              ${clariprintQuote.costs.print ? `Impression : ${clariprintQuote.costs.print.toFixed(2)} €<br>` : ''}
              ${clariprintQuote.costs.makeready ? `Calage : ${clariprintQuote.costs.makeready.toFixed(2)} €<br>` : ''}
              ${clariprintQuote.costs.packaging ? `Conditionnement : ${clariprintQuote.costs.packaging.toFixed(2)} €<br>` : ''}
              ${clariprintQuote.costs.delivery ? `Livraison : ${clariprintQuote.costs.delivery.toFixed(2)} €<br>` : ''}
              ${clariprintQuote.delais ? `Délai estimé : ${clariprintQuote.delais} jour(s)<br>` : ''}
              ${clariprintQuote.fournisseur ? `Imprimeur : ${clariprintQuote.fournisseur}` : ''}
            </div>
            ` : '<div style="font-size:11px;color:#999;margin-bottom:12px;">Prix estimé — Connectez Clariprint pour un prix réel</div>'}
            <div class="total-row">
              <span>Total HT</span>
              <span>${totalHT.toFixed(2)} €</span>
            </div>
            <div class="total-row">
              <span>TVA (20%)</span>
              <span>${tva.toFixed(2)} €</span>
            </div>
            <div class="total-row final">
              <span>TOTAL TTC</span>
              <span>${totalTTC.toFixed(2)} €</span>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            Raison sociale — Adresse — SIRET : __________ — APE : __________ — N° TVA intracommunautaire : __________<br>
            Tél. : __________ — Email : __________ — Site web : __________
          </div>
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
              {((product.clariprintQuote?.costs?.total || product.clariprintQuote?.priceHT || product.price || 0) * 1.2).toFixed(2)} €
            </div>
            <div className="text-xs text-gray-500">
              ({(product.clariprintQuote?.costs?.total || product.clariprintQuote?.priceHT || product.price || 0).toFixed(2)} € HT
              + {((product.clariprintQuote?.costs?.total || product.clariprintQuote?.priceHT || product.price || 0) * 0.2).toFixed(2)} € TVA)
            </div>
            {product.clariprintQuote?.delais && (
              <div className="text-xs text-green-600 mt-1">⏱ Délai : {product.clariprintQuote.delais} jour(s)</div>
            )}
            {product.clariprintQuote?.fournisseur && (
              <div className="text-xs text-green-600">🏭 {product.clariprintQuote.fournisseur}</div>
            )}
          </div>
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
            onClick={handleAddToCart}
            className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-3"
          >
            <ShoppingCart className="w-5 h-5" />
            Ajouter au panier
          </button>

          <button
            onClick={onClose}
            className="w-full px-6 py-3 text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}