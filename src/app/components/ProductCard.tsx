import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { QuoteModal } from "./QuoteModal";

interface ProductCardProps {
  product: {
    id?: string;
    name: string;
    quantity?: number;
    dimensions?: { width: number; height: number };
    format?: string; // Format lisible ex: "A5 (148 × 210 mm)"
    material?: string; // Support
    weight?: number; // Grammage
    printing?: { recto: string; verso: string };
    finish?: string; // Finition principale
    finishRecto?: string;
    finishVerso?: string;
    packaging?: string;
    deliveryInfo?: string;
    deliveryLocation?: string;
    addressProvided?: string;
    price?: number;
    suggestions?: string[]; // Conseils d'amélioration
    description?: string; // Description détaillée pour la fiche produit
    pages?: number; // Pour les brochures
    incomplete?: boolean; // FLAG : produit nécessitant des précisions
    claudeResponse?: string; // Réponse complète de Claude
  };
  onProductUpdate?: (updatedProduct: any) => void;
  compact?: boolean;
}

type TabType = 'sheet' | 'pricing' | 'mockup' | 'form' | null;

export function ProductCard({ product, onProductUpdate, compact }: ProductCardProps) {
  const [localProduct, setLocalProduct] = useState(product);
  const [activeTab, setActiveTab] = useState<TabType>(null);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

  // 💰 TARIFICATION : Estimer le prix d'un produit
  const estimatePrice = (product: any): number => {
    const detectProductType = (name: string): string => {
      const nameLower = name.toLowerCase();
      if (nameLower.includes("flyer") || nameLower.includes("tract")) return "flyers";
      if (nameLower.includes("carte") && nameLower.includes("visite")) return "cartes_visite";
      if (nameLower.includes("brochure") || nameLower.includes("catalogue")) return "brochures";
      if (nameLower.includes("affiche") || nameLower.includes("poster")) return "affiches";
      if (nameLower.includes("dépliant")) return "depliants";
      return "autre";
    };

    let basePrice = 0;
    const qty = product.quantity || 500;
    const productType = detectProductType(product.name);
    
    const basePrices: Record<string, number> = {
      "cartes_visite": 0.08,
      "flyers": 0.12,
      "brochures": 1.50,
      "affiches": 5.00,
      "depliants": 0.25,
      "autre": 0.15
    };
    
    basePrice = (basePrices[productType] || 0.15) * qty;
    
    if (product.weight > 300) {
      basePrice *= 1.3;
    } else if (product.weight > 200) {
      basePrice *= 1.15;
    }
    
    if (product.printing?.verso && product.printing.verso !== "Sans impression") {
      basePrice *= 1.4;
    }
    
    if (product.finishRecto && product.finishRecto.toLowerCase().includes("pelliculage")) {
      basePrice += qty * 0.05;
    }
    if (product.finishRecto && product.finishRecto.toLowerCase().includes("vernis")) {
      basePrice += qty * 0.08;
    }
    
    if (qty >= 5000) {
      basePrice *= 0.7;
    } else if (qty >= 2000) {
      basePrice *= 0.8;
    } else if (qty >= 1000) {
      basePrice *= 0.9;
    }
    
    return Math.round(basePrice * 100) / 100;
  };

  const updateProduct = (updates: any) => {
    const updated = { ...localProduct, ...updates };
    // Recalculer automatiquement le prix après modification
    updated.price = estimatePrice(updated);
    setLocalProduct(updated);
    if (onProductUpdate) {
      onProductUpdate(updated);
    }
  };

  const toggleTab = (tab: TabType) => {
    setActiveTab(activeTab === tab ? null : tab);
  };

  // Composant pour une valeur technique cliquable (en gras)
  const BoldValue = ({ 
    value, 
    onClick 
  }: { 
    value: string | number; 
    onClick?: () => void;
  }) => (
    <strong 
      className={onClick ? "cursor-pointer hover:text-blue-600 transition-colors" : ""}
      onClick={onClick}
    >
      {value}
    </strong>
  );

  // Composant pour les suggestions avec mots-clés soulignés
  const SuggestionText = ({ text }: { text: string }) => {
    const keywords = ['premium', 'brillant', 'mat', 'spéciale', 'vernis', 'découpe', 'forme', 'vives'];
    
    const parts = text.split(/(\s+)/);
    return (
      <span>
        {parts.map((part, i) => {
          const isKeyword = keywords.some(kw => part.toLowerCase().includes(kw));
          return isKeyword ? (
            <span key={i} className="underline decoration-red-500">{part}</span>
          ) : (
            <span key={i}>{part}</span>
          );
        })}
      </span>
    );
  };

  return (
    <div className="w-full">
      {/* CAS SPÉCIAL : Produit incomplet nécessitant des précisions */}
      {localProduct.incomplete ? (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl shadow-sm p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="text-2xl">⚠️</div>
            <div>
              <h3 className="text-lg font-bold text-amber-900 mb-1">
                Précisions nécessaires
              </h3>
              <p className="text-sm text-amber-700">
                J'ai besoin de plus d'informations pour configurer votre produit.
              </p>
            </div>
          </div>

          {/* Informations disponibles */}
          <div className="bg-white rounded-xl p-4 mb-4">
            <h4 className="font-semibold text-gray-900 mb-3">📋 Informations disponibles</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Produit :</span>
                <span className="font-semibold text-gray-900 ml-2">{localProduct.name}</span>
              </div>
              <div>
                <span className="text-gray-600">Quantité :</span>
                <span className="font-semibold text-gray-900 ml-2">{localProduct.quantity}</span>
              </div>
            </div>
          </div>

          {/* Questions de Claude */}
          {localProduct.suggestions && localProduct.suggestions.length > 0 && (
            <div className="bg-white rounded-xl p-4">
              <h4 className="font-semibold text-gray-900 mb-3">❓ Questions à préciser</h4>
              <ul className="space-y-2">
                {localProduct.suggestions.map((question, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-amber-600 font-bold">{index + 1}.</span>
                    <span>{question}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Réponse complète de Claude si disponible */}
          {localProduct.claudeResponse && (
            <details className="mt-4">
              <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-900">
                Voir la réponse complète de Claude
              </summary>
              <div className="mt-2 p-3 bg-gray-100 rounded-lg text-xs text-gray-700 whitespace-pre-wrap">
                {localProduct.claudeResponse}
              </div>
            </details>
          )}
        </div>
      ) : (
        <>
          {/* Affichage normal de la ProductCard */}
          {/* Bloc principal avec le texte "Vous avez demandé" */}
          <div className={`bg-white border-2 border-gray-300 rounded-2xl shadow-sm mb-3 ${
            compact ? 'p-4' : 'p-6'
          }`}>
            <div className={`leading-relaxed text-gray-900 ${
              compact ? 'text-xs' : 'text-sm'
            }`}>
              <p className="mb-2">Vous avez demandé :</p>
              
              <p>
                <BoldValue 
                  value={localProduct.quantity || 600} 
                  onClick={() => {
                    const newQty = prompt("Nouvelle quantité :", String(localProduct.quantity || 600));
                    if (newQty) updateProduct({ quantity: parseInt(newQty) });
                  }}
                /> {localProduct.name},<br />
                Format : <BoldValue 
                  value={localProduct.format || `${localProduct.dimensions?.width || 85} mm×${localProduct.dimensions?.height || 55} mm`}
                  onClick={() => {
                    const newWidth = prompt("Largeur (mm) :", String(localProduct.dimensions?.width || 85));
                    const newHeight = prompt("Hauteur (mm) :", String(localProduct.dimensions?.height || 55));
                    if (newWidth && newHeight) {
                      updateProduct({ 
                        dimensions: { 
                          width: parseInt(newWidth), 
                          height: parseInt(newHeight) 
                        } 
                      });
                    }
                  }}
                /><br />
                impression <BoldValue 
                  value={localProduct.printing?.recto || "quadricouleur"}
                  onClick={() => {
                    const newRecto = prompt("Impression recto :", localProduct.printing?.recto || "quadricouleur");
                    if (newRecto) {
                      updateProduct({ 
                        printing: { 
                          ...localProduct.printing, 
                          recto: newRecto 
                        } 
                      });
                    }
                  }}
                /> / <BoldValue 
                  value={localProduct.printing?.verso || "quadricouleur"}
                  onClick={() => {
                    const newVerso = prompt("Impression verso :", localProduct.printing?.verso || "quadricouleur");
                    if (newVerso) {
                      updateProduct({ 
                        printing: { 
                          ...localProduct.printing, 
                          verso: newVerso 
                        } 
                      });
                    }
                  }}
                /> sur papier <BoldValue 
                  value={`${localProduct.material || "Carte Graphique"} ${localProduct.weight || 350} g`}
                  onClick={() => {
                    const newMaterial = prompt("Type de papier :", localProduct.material || "Carte Graphique");
                    const newWeight = prompt("Grammage (g) :", String(localProduct.weight || 350));
                    if (newMaterial || newWeight) {
                      updateProduct({ 
                        material: newMaterial || localProduct.material,
                        weight: newWeight ? parseInt(newWeight) : localProduct.weight
                      });
                    }
                  }}
                />,<br />
                finition <BoldValue 
                  value={localProduct.finishRecto || localProduct.finish || "pelliculage polypropylène mat (recto)"}
                  onClick={() => {
                    const newFinish = prompt("Finition recto :", localProduct.finishRecto || localProduct.finish || "pelliculage polypropylène mat (recto)");
                    if (newFinish) updateProduct({ finishRecto: newFinish, finish: newFinish });
                  }}
                /> / <BoldValue 
                  value={localProduct.finishVerso || "pelliculage polypropylène mat (verso)"}
                  onClick={() => {
                    const newFinish = prompt("Finition verso :", localProduct.finishVerso || "pelliculage polypropylène mat (verso)");
                    if (newFinish) updateProduct({ finishVerso: newFinish });
                  }}
                />.
              </p>
              
              {!compact && (
                <>
                  <p className="mt-2">
                    Conditionnement : <BoldValue 
                      value={localProduct.packaging || "en paquets scellés par ruban papier"}
                      onClick={() => {
                        const newPkg = prompt("Conditionnement :", localProduct.packaging || "en paquets scellés par ruban papier");
                        if (newPkg) updateProduct({ packaging: newPkg });
                      }}
                    />, 1 carte(s) par paquet.
                  </p>
                  
                  <p className="mt-2">
                    Livraison : destination <BoldValue 
                      value={localProduct.deliveryLocation || "France, Bourgogne-Franche-Comté (90)"}
                      onClick={() => {
                        const newLoc = prompt("Destination :", localProduct.deliveryLocation || "France, Bourgogne-Franche-Comté (90)");
                        if (newLoc) updateProduct({ deliveryLocation: newLoc });
                      }}
                    />, adresse fournie : <BoldValue 
                      value={localProduct.addressProvided || "aucune"}
                      onClick={() => {
                        const newAddr = prompt("Adresse fournie :", localProduct.addressProvided || "aucune");
                        if (newAddr) updateProduct({ addressProvided: newAddr });
                      }}
                    />.
                  </p>
                </>
              )}
              
              {localProduct.suggestions && localProduct.suggestions.length > 0 && !compact && (
                <>
                  <p className="mt-3 mb-1">Pour plus d'impact je vous propose :</p>
                  {localProduct.suggestions.map((suggestion, index) => (
                    <p key={index}>
                      <SuggestionText text={suggestion} />
                    </p>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* 4 Boutons d'action - TOUJOURS sur la même ligne */}
          <div className={`grid grid-cols-4 mb-3 ${compact ? 'gap-1.5' : 'gap-2'}`}>
            <button 
              onClick={() => toggleTab('sheet')}
              className={`font-medium rounded-xl border-2 transition-colors ${
                compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2.5 text-sm'
              } ${
                activeTab === 'sheet' 
                  ? 'bg-gray-900 text-white border-gray-900' 
                  : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {compact ? 'Fiche' : 'Fiche Produit'}
            </button>
            <button 
              onClick={() => toggleTab('pricing')}
              className={`font-medium rounded-xl border-2 transition-colors ${
                compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2.5 text-sm'
              } ${
                activeTab === 'pricing' 
                  ? 'bg-gray-900 text-white border-gray-900' 
                  : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {compact ? 'Prix' : 'Prix & Devis'}
            </button>
            <button 
              onClick={() => toggleTab('mockup')}
              className={`font-medium rounded-xl border-2 transition-colors ${
                compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2.5 text-sm'
              } ${
                activeTab === 'mockup' 
                  ? 'bg-gray-900 text-white border-gray-900' 
                  : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {compact ? '3D' : 'Mockup & 3D'}
            </button>
            <button 
              onClick={() => toggleTab('form')}
              className={`font-medium rounded-xl border-2 transition-colors ${
                compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2.5 text-sm'
              } ${
                activeTab === 'form' 
                  ? 'bg-gray-900 text-white border-gray-900' 
                  : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {compact ? 'Form' : 'Éditer le formulaire'}
            </button>
          </div>

          {/* Section dépliable Product Sheet */}
          {activeTab === 'sheet' && (
            <div className="bg-white border-2 border-gray-300 rounded-2xl p-6 mb-3 animate-slideDown shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">Fiche produit détaillée</h3>
                <button onClick={() => setActiveTab(null)} className="text-gray-500 hover:text-gray-900">
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Produit</span>
                  <span className="font-semibold">{localProduct.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Quantité</span>
                  <span className="font-semibold">{localProduct.quantity || 600}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Format</span>
                  <span className="font-semibold">{localProduct.format || `${localProduct.dimensions?.width || 85} × ${localProduct.dimensions?.height || 55} mm`}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Papier</span>
                  <span className="font-semibold">{localProduct.material || "Carte Graphique"}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Grammage</span>
                  <span className="font-semibold">{localProduct.weight || 350} g/m²</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Impression</span>
                  <span className="font-semibold">{localProduct.printing?.recto || "quadricouleur"} / {localProduct.printing?.verso || "quadricouleur"}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Finition recto</span>
                  <span className="font-semibold">{localProduct.finishRecto || "pelliculage polypropylène mat"}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Finition verso</span>
                  <span className="font-semibold">{localProduct.finishVerso || "pelliculage polypropylène mat"}</span>
                </div>
              </div>
            </div>
          )}

          {/* Section dépliable Calculer le prix */}
          {activeTab === 'pricing' && (
            <div className="bg-white border-2 border-gray-300 rounded-2xl p-6 mb-3 animate-slideDown shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">Tarification détaillée</h3>
                <button onClick={() => setActiveTab(null)} className="text-gray-500 hover:text-gray-900">
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Prix unitaire</span>
                  <span className="font-semibold text-gray-900">
                    {localProduct.price ? `${(localProduct.price / (localProduct.quantity || 600)).toFixed(3)} €` : "0.150 €"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Quantité</span>
                  <span className="font-semibold text-gray-900">{localProduct.quantity || 600}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Total HT</span>
                  <span className="font-semibold text-gray-900">
                    {localProduct.price ? `${localProduct.price.toFixed(2)} €` : "90.00 €"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">TVA (20%)</span>
                  <span className="font-semibold text-gray-900">
                    {localProduct.price ? `${(localProduct.price * 0.2).toFixed(2)} €` : "18.00 €"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 bg-gray-900 text-white px-4 rounded-lg mt-3">
                  <span className="font-semibold">Total TTC</span>
                  <span className="text-xl font-bold">
                    {localProduct.price ? `${(localProduct.price * 1.2).toFixed(2)} €` : "108.00 €"}
                  </span>
                </div>
                <button 
                  onClick={() => setIsQuoteModalOpen(true)}
                  className="w-full mt-4 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
                >
                  Obtenir un devis ou ajouter au panier
                </button>
              </div>
            </div>
          )}

          {/* Section dépliable Mockup & 3D */}
          {activeTab === 'mockup' && (
            <div className="bg-white border-2 border-gray-300 rounded-2xl p-6 mb-3 animate-slideDown shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">Aperçu 3D & Mockup</h3>
                <button onClick={() => setActiveTab(null)} className="text-gray-500 hover:text-gray-900">
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>
              <div className="text-sm text-gray-600">
                <p className="mb-3">Visualisez votre produit en 3D avant impression.</p>
                <div className="bg-gray-100 rounded-lg p-12 text-center">
                  <div className="text-gray-400 text-6xl mb-3">🎨</div>
                  <p className="text-gray-500">Aperçu 3D disponible après upload de votre design</p>
                </div>
              </div>
            </div>
          )}

          {/* Section dépliable Formulaire */}
          {activeTab === 'form' && (
            <div className="bg-white border-2 border-gray-300 rounded-2xl p-6 mb-3 animate-slideDown shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">Formulaire de configuration</h3>
                <button onClick={() => setActiveTab(null)} className="text-gray-500 hover:text-gray-900">
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantité</label>
                  <input 
                    type="number" 
                    value={localProduct.quantity || 600}
                    onChange={(e) => updateProduct({ quantity: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Largeur (mm)</label>
                    <input 
                      type="number" 
                      value={localProduct.dimensions?.width || 85}
                      onChange={(e) => updateProduct({ 
                        dimensions: { 
                          ...localProduct.dimensions, 
                          width: parseInt(e.target.value) 
                        } 
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hauteur (mm)</label>
                    <input 
                      type="number" 
                      value={localProduct.dimensions?.height || 55}
                      onChange={(e) => updateProduct({ 
                        dimensions: { 
                          ...localProduct.dimensions, 
                          height: parseInt(e.target.value) 
                        } 
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type de papier</label>
                  <input 
                    type="text" 
                    value={localProduct.material || "Carte Graphique"}
                    onChange={(e) => updateProduct({ material: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grammage (g/m²)</label>
                  <input 
                    type="number" 
                    value={localProduct.weight || 350}
                    onChange={(e) => updateProduct({ weight: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium">
                  Sauvegarder les modifications
                </button>
              </div>
            </div>
          )}

          {/* Modal de devis */}
          <QuoteModal 
            isOpen={isQuoteModalOpen}
            onClose={() => setIsQuoteModalOpen(false)}
            product={localProduct}
          />
        </>
      )}
    </div>
  );
}