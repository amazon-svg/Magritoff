import { useState, useEffect } from "react";
import { Send, Info, History, X } from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import logoImage from "figma:asset/48de195d09839b5e2071e781c31fa390056b1db8.png";
import { ProductCard } from "./ProductCard";
import { CartButton } from "./CartButton";

interface ChatInterfaceProps {
  onShowResults: () => void;
  onProductConfigReceived?: (config: any) => void;
}

// Type pour l'historique des conversations
interface ConversationHistory {
  id: string;
  timestamp: number;
  title: string; // Premier message utilisateur (tronqué)
  messages: Array<{ role: string; content: string }>;
  products: any[];
}

export function ChatInterface({ onShowResults, onProductConfigReceived }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [isClaudeConnected, setIsClaudeConnected] = useState(false);
  
  // États pour l'historique
  const [conversationHistory, setConversationHistory] = useState<ConversationHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // Charger l'historique depuis localStorage au démarrage
  useEffect(() => {
    const savedHistory = localStorage.getItem('magrit_conversation_history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setConversationHistory(parsed);
      } catch (error) {
        console.error("Erreur lors du chargement de l'historique:", error);
      }
    }
  }, []);

  // Sauvegarder l'historique dans localStorage à chaque modification
  useEffect(() => {
    if (conversationHistory.length > 0) {
      localStorage.setItem('magrit_conversation_history', JSON.stringify(conversationHistory));
    }
  }, [conversationHistory]);

  // Sauvegarder la conversation actuelle après chaque réponse de Claude
  const saveCurrentConversation = (newMessages: Array<{ role: string; content: string }>, newProducts: any[]) => {
    // Trouver le premier message utilisateur pour le titre
    const firstUserMessage = newMessages.find(m => m.role === 'user')?.content || 'Nouvelle conversation';
    const title = firstUserMessage.length > 50 ? firstUserMessage.substring(0, 50) + '...' : firstUserMessage;

    if (currentConversationId) {
      // Mettre à jour la conversation existante
      setConversationHistory(prev => 
        prev.map(conv => 
          conv.id === currentConversationId 
            ? { ...conv, messages: newMessages, products: newProducts, timestamp: Date.now() }
            : conv
        )
      );
    } else {
      // Créer une nouvelle conversation
      const newId = `conv-${Date.now()}`;
      setCurrentConversationId(newId);
      
      const newConversation: ConversationHistory = {
        id: newId,
        timestamp: Date.now(),
        title,
        messages: newMessages,
        products: newProducts
      };
      
      setConversationHistory(prev => [newConversation, ...prev]);
    }
  };

  // Restaurer une conversation depuis l'historique
  const loadConversation = (conversation: ConversationHistory) => {
    setMessages(conversation.messages);
    setProducts(conversation.products);
    setCurrentConversationId(conversation.id);
    setShowHistory(false);
    
    if (conversation.products.length > 0) {
      onShowResults();
    }
  };

  // Supprimer une conversation de l'historique
  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Empêcher le clic de charger la conversation
    setConversationHistory(prev => prev.filter(conv => conv.id !== id));
    
    // Si c'est la conversation actuelle, la réinitialiser
    if (currentConversationId === id) {
      setCurrentConversationId(null);
      setMessages([]);
      setProducts([]);
    }
  };

  // Nouvelle conversation
  const startNewConversation = () => {
    setMessages([]);
    setProducts([]);
    setCurrentConversationId(null);
    setShowHistory(false);
  };

  // Parser le texte de Claude pour extraire les produits
  const parseProductsFromClaudeResponse = (text: string) => {
    const parsedProducts = [];
    
    // NOUVEAU PATTERN : **[QUANTITÉ] [NOM DU PRODUIT]**
    // Exemple: **500 cartes de visite**
    const productPattern = /\*\*(\d+)\s+([^\*]+)\*\*[^\-]*?-\s*\*\*Format\s*\*\*\s*:\s*([^\n]+)[^\-]*?-\s*\*\*Support\s*\*\*\s*:\s*([^\n]+)(?:[^\-]*?-\s*\*\*Grammage\s*\*\*\s*:\s*([^\n]+))?[^\-]*?-\s*\*\*Finition\s*\*\*\s*:\s*([^\n]+)[^\-]*?-\s*\*\*Conseils\s*\*\*\s*:([\s\S]*?)(?=\*\*\d+|$)/gi;
    
    let match;
    while ((match = productPattern.exec(text)) !== null) {
      const quantity = match[1].trim();
      const productName = match[2].trim();
      const format = match[3].trim();
      const support = match[4].trim();
      const grammageRaw = match[5]?.trim() || "";
      const finishing = match[6].trim();
      const improvementsRaw = match[7]?.trim() || "";
      
      // Extraire le grammage numérique (ex: "350g/m²" -> 350)
      const grammageMatch = grammageRaw.match(/(\d+)/);
      const grammage = grammageMatch ? parseInt(grammageMatch[1]) : 0;
      
      // Extraire les conseils (lignes commençant par • ou ✦)
      const improvementsLines = improvementsRaw
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('•') || line.startsWith('✦'));
      
      const product = {
        id: `product-${Date.now()}-${parsedProducts.length}`,
        name: productName,
        quantity: parseInt(quantity),
        format: format,
        material: support,  // ✅ Correspond à ProductCard
        weight: grammage,   // ✅ Correspond à ProductCard
        finish: finishing,  // ✅ Correspond à ProductCard
        finishRecto: finishing,
        finishVerso: finishing,
        suggestions: improvementsLines,  // ✅ Array pour ProductCard
        // Valeurs par défaut pour les champs manquants
        printing: { 
          recto: "Quadrichromie (CMJN)", 
          verso: "Sans impression" 
        },
        packaging: "Paquets standard",
        deliveryLocation: "France",
        addressProvided: "Non fournie",
      };
      
      // Calculer le prix estimé
      product.price = estimatePrice(product);
      
      parsedProducts.push(product);
    }
    
    console.log(`✅ Parser: ${parsedProducts.length} produit(s) extrait(s) de la réponse Claude`);
    if (parsedProducts.length > 0) {
      console.log("📦 Premier produit parsé:", parsedProducts[0]);
    }
    
    return parsedProducts;
  };

  // 🎯 FONCTION INTELLIGENTE : Créer un produit depuis son nom avec configurations prédéfinies
  const createProductFromName = (productName: string, quantity: number = 500) => {
    const nameLower = productName.toLowerCase();
    let productType = "autre";
    let config: any = {};

    // 🎴 CARTES DE VISITE
    if (nameLower.includes("carte") && nameLower.includes("visite")) {
      productType = "cartes_visite";
      config = {
        format: "85 × 55 mm",
        material: "Papier couché brillant",
        weight: 350,
        finish: "Pelliculage mat recto/verso",
        printing: { 
          recto: "Quadrichromie (CMJN)", 
          verso: "Quadrichromie (CMJN)" 
        },
        suggestions: [
          "• Coins ronds disponibles (+8€)",
          "• Vernis sélectif sur le logo (+15€)",
          "• Dorure à chaud pour un effet premium (+35€)"
        ]
      };
    }
    
    // 📄 FLYERS
    else if (nameLower.includes("flyer") || nameLower.includes("tract")) {
      productType = "flyers";
      config = {
        format: nameLower.includes("a5") ? "148 × 210 mm (A5)" : 
                nameLower.includes("a4") ? "210 × 297 mm (A4)" :
                nameLower.includes("a6") ? "105 × 148 mm (A6)" : "148 × 210 mm (A5)",
        material: "Papier couché brillant",
        weight: 170,
        finish: "Sans pelliculage",
        printing: { 
          recto: "Quadrichromie (CMJN)", 
          verso: nameLower.includes("recto verso") || nameLower.includes("2 faces") ? 
                 "Quadrichromie (CMJN)" : "Sans impression"
        },
        suggestions: [
          "• Pelliculage mat conseillé pour durabilité (+20€)",
          "• Format A4 pour plus de visibilité",
          "• Grammage 250g/m² pour effet premium (+15%)"
        ]
      };
    }

    // 📖 BROCHURES / CATALOGUES
    else if (nameLower.includes("brochure") || nameLower.includes("catalogue")) {
      const pages = nameLower.match(/(\d+)\s*pages?/i);
      const pageCount = pages ? parseInt(pages[1]) : 24;
      
      productType = "brochures";
      config = {
        format: nameLower.includes("a5") ? "148 × 210 mm (A5)" : "210 × 297 mm (A4)",
        material: "Papier couché mat",
        weight: 135,
        finish: "Dos carré collé",
        printing: { 
          recto: "Quadrichromie (CMJN)", 
          verso: "Quadrichromie (CMJN)"
        },
        pages: pageCount,
        suggestions: [
          "• Couverture en 250g/m² recommandée (+25€)",
          "• Pelliculage mat sur couverture (+15€)",
          `• Minimum ${Math.ceil(pageCount / 4) * 4} pages (multiple de 4)`
        ]
      };
    }

    // 🖼️ AFFICHES / POSTERS
    else if (nameLower.includes("affiche") || nameLower.includes("poster")) {
      productType = "affiches";
      config = {
        format: nameLower.includes("a3") ? "297 × 420 mm (A3)" :
                nameLower.includes("a2") ? "420 × 594 mm (A2)" :
                nameLower.includes("a1") ? "594 × 841 mm (A1)" :
                nameLower.includes("a0") ? "841 × 1189 mm (A0)" : "420 × 594 mm (A2)",
        material: nameLower.includes("mat") ? "Papier couché mat" : "Papier couché brillant",
        weight: 170,
        finish: "Sans pelliculage",
        printing: { 
          recto: "Quadrichromie (CMJN)", 
          verso: "Sans impression"
        },
        suggestions: [
          "• Pelliculage mat pour usage extérieur (+30€)",
          "• Grammage 250g/m² pour rigidité (+20%)",
          "• Support PVC pour durabilité maximale"
        ]
      };
    }

    // 📑 DÉPLIANTS
    else if (nameLower.includes("dépliant") || nameLower.includes("depliant")) {
      productType = "depliants";
      config = {
        format: "210 × 297 mm plié en 3 volets",
        material: "Papier couché brillant",
        weight: 170,
        finish: "Pliage roulé",
        printing: { 
          recto: "Quadrichromie (CMJN)", 
          verso: "Quadrichromie (CMJN)"
        },
        suggestions: [
          "• Pelliculage mat recommandé (+18€)",
          "• Grammage 250g/m² pour effet premium (+15%)",
          "• Pliage fenêtre disponible (même prix)"
        ]
      };
    }

    // 🎟️ FAIRE-PART / INVITATIONS
    else if (nameLower.includes("faire-part") || nameLower.includes("invitation")) {
      productType = "faire_part";
      config = {
        format: "148 × 105 mm (A6 paysage)",
        material: "Papier vergé naturel",
        weight: 300,
        finish: "Sans pelliculage",
        printing: { 
          recto: "Quadrichromie (CMJN)", 
          verso: "Sans impression"
        },
        suggestions: [
          "• Dorure à chaud pour élégance (+45€)",
          "• Enveloppes assorties disponibles (+0.30€/unité)",
          "• Découpe laser personnalisée sur devis"
        ]
      };
    }

    // 🏷️ AUTOCOLLANTS / STICKERS
    else if (nameLower.includes("autocollant") || nameLower.includes("sticker")) {
      productType = "stickers";
      config = {
        format: nameLower.includes("rond") ? "Ø 50 mm (rond)" : "50 × 50 mm (carré)",
        material: "Vinyle blanc brillant",
        weight: 0,
        finish: "Pelliculage brillant",
        printing: { 
          recto: "Quadrichromie (CMJN)", 
          verso: "Sans impression"
        },
        suggestions: [
          "• Découpe à la forme sur devis",
          "• Vinyle transparent disponible",
          "• Résistant eau et UV"
        ]
      };
    }

    // 🗳️ BULLETINS DE VOTE
    else if (nameLower.includes("bulletin") && nameLower.includes("vote")) {
      productType = "bulletins_vote";
      config = {
        format: "148 × 105 mm (format réglementaire)",
        material: "Papier offset blanc",
        weight: 70,
        finish: "Sans finition",
        printing: { 
          recto: "Noir seul (texte réglementaire)", 
          verso: "Sans impression"
        },
        suggestions: [
          "• Format conforme aux normes électorales françaises",
          "• Papier 70g/m² obligatoire pour transparence",
          "• Impression noir seul pour conformité légale",
          "• Découpe nette et précise"
        ]
      };
    }

    // 📋 AUTRE (configuration générique)
    else {
      config = {
        format: "210 × 297 mm (A4)",
        material: "Papier couché brillant",
        weight: 170,
        finish: "Sans pelliculage",
        printing: { 
          recto: "Quadrichromie (CMJN)", 
          verso: "Sans impression"
        },
        suggestions: [
          "• Précisez le format souhaité pour un devis exact",
          "• Pelliculage mat ou brillant disponible",
          "• Contactez-nous pour options personnalisées"
        ]
      };
    }

    // Construire l'objet produit complet
    const product = {
      id: `product-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: productName,
      quantity: quantity,
      format: config.format,
      material: config.material,
      weight: config.weight,
      finish: config.finish,
      finishRecto: config.finish,
      finishVerso: config.finish,
      printing: config.printing,
      suggestions: config.suggestions,
      pages: config.pages || null,
      packaging: "Paquets standard",
      deliveryLocation: "France",
      addressProvided: "Non fournie",
    };

    // Calculer le prix
    product.price = estimatePrice(product);

    console.log(`🎯 createProductFromName: Produit créé (${productType})`, product);

    return product;
  };

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

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    const newMessages = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    
    let assistantMessage = "";
    let parsedProducts: any[] = [];

    try {
      // Appeler l'endpoint claude-proxy (pas /chat !)
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e3db71a4/claude-proxy`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ 
            messages: newMessages
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erreur HTTP ${response.status}:`, errorText);
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log("📦 Réponse reçue du serveur:", data);
      
      // Extraire le texte de la réponse Claude
      assistantMessage = data.content?.[0]?.text || data.rawResponse || "Désolé, je n'ai pas pu traiter votre demande.";

      setMessages((prev) => [...prev, { role: "assistant", content: assistantMessage }]);

      // Vérifier si mode démo
      if (data.demoMode) {
        setIsDemoMode(true);
        console.log("⚠️ Mode démo activé - API Claude non disponible");
      } else {
        setIsDemoMode(false);
        setIsClaudeConnected(true);
        console.log("✅ Claude AI connecté avec succès !");
      }

      // Parse la réponse pour extraire les produits
      parsedProducts = parseProductsFromClaudeResponse(assistantMessage);
      if (parsedProducts.length > 0) {
        setProducts(prev => [...prev, ...parsedProducts]); // ✅ ACCUMULER au lieu de REMPLACER
        onShowResults();
      } else {
        console.warn("⚠️ Aucun produit parsé depuis la réponse Claude");
      }

    } catch (error: any) {
      console.error("❌ Chat error:", error);
      
      // Mode démo si l'API ne fonctionne pas
      setIsDemoMode(true);
      const demoResponse = `**500 cartes de visite**
- **Format** : 85 × 55 mm (format standard)
- **Support** : Papier couché brillant
- **Grammage** : 350g/m²
- **Finition** : Pelliculage mat recto/verso
- **Conseils** :
  • Coins ronds disponibles (+8€)
  • Vernis sélectif sur le logo (+15€)
  • Dorure à chaud pour un effet premium (+35€)`;

      assistantMessage = demoResponse;
      setMessages((prev) => [...prev, { role: "assistant", content: demoResponse }]);
      
      const demoParsed = parseProductsFromClaudeResponse(demoResponse);
      if (demoParsed.length > 0) {
        parsedProducts = demoParsed;
        setProducts(prev => [...prev, ...demoParsed]); // ✅ ACCUMULER également en mode démo
        onShowResults();
      }
    } finally {
      setIsLoading(false);
      // Sauvegarder la conversation avec TOUS les produits accumulés
      const finalMessages = [...newMessages, { role: "assistant", content: assistantMessage }];
      const allProducts = [...products, ...parsedProducts]; // Tous les produits (anciens + nouveaux)
      saveCurrentConversation(finalMessages, allProducts);
    }
  };

  const handleProductUpdate = (index: number, updatedProduct: any) => {
    setProducts((prev) => {
      const newProducts = [...prev];
      newProducts[index] = updatedProduct;
      return newProducts;
    });
  };

  const getGridClass = () => {
    const count = products.length;
    
    // Logique adaptative progressive :
    // 1-2 produits : 2 colonnes
    // 3-6 produits : 2 colonnes (max 3 lignes)
    // 7-12 produits : 3 colonnes (plus de 3 lignes de 2)
    // 13+ produits : 4 colonnes (plus de 3 lignes de 3)
    
    if (count <= 2) {
      return 'grid grid-cols-2 gap-4';
    }
    if (count <= 6) {
      return 'grid grid-cols-2 gap-4';
    }
    if (count <= 12) {
      return 'grid grid-cols-3 gap-4';
    }
    return 'grid grid-cols-4 gap-3';
  };

  const getContainerClass = () => {
    if (products.length > 0) {
      return 'w-full px-6 py-8 mx-auto transition-all duration-300 max-w-7xl';
    }
    return 'w-full px-6 py-8 mx-auto transition-all duration-300 max-w-3xl';
  };

  // Calculate classes before render to avoid JSX parsing issues
  const containerClass = getContainerClass();
  const gridClass = getGridClass();

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Sidebar historique */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setShowHistory(false)}
          />
          
          {/* Sidebar */}
          <div className="relative w-80 bg-white shadow-2xl overflow-hidden flex flex-col">
            {/* Header sidebar */}
            <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5" />
                <h2 className="text-lg font-semibold">Historique</h2>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1 hover:bg-gray-800 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bouton nouvelle conversation */}
            <div className="p-4 border-b border-gray-200">
              <button
                onClick={startNewConversation}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                + Nouvelle conversation
              </button>
            </div>

            {/* Liste des conversations */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {conversationHistory.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucune conversation</p>
                </div>
              ) : (
                conversationHistory.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => loadConversation(conv)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all group hover:border-blue-500 hover:shadow-md ${
                      currentConversationId === conv.id
                        ? 'bg-blue-50 border-blue-500'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {conv.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(conv.timestamp).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {conv.products.length > 0 && (
                          <p className="text-xs text-blue-600 mt-1">
                            {conv.products.length} produit{conv.products.length > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => deleteConversation(conv.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all"
                        title="Supprimer"
                      >
                        <X className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        {/* Bouton History à gauche */}
        <button
          onClick={() => setShowHistory(true)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <History className="w-4 h-4" />
          <span className="text-sm font-medium">Historique</span>
          {conversationHistory.length > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
              {conversationHistory.length}
            </span>
          )}
        </button>

        {/* Boutons à droite */}
        <div className="flex items-center gap-3">
          {isDemoMode && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="text-amber-700 text-sm font-medium">⚠️ Mode Démo</span>
              <span className="text-amber-600 text-xs">(API Claude non configurée)</span>
            </div>
          )}
          <CartButton />
        </div>
      </div>

      {/* Main content - SCROLLABLE avec padding-bottom pour l'input sticky */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className={containerClass}>
          {/* Logo et titre */}
          {messages.length === 0 && (
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-20 h-20 mb-6">
                <img src={logoImage} alt="Magrit" className="w-20 h-20 rounded-2xl shadow-lg" />
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Magrit Copilot AI
              </h1>
              <p className="text-lg text-gray-600">
                Décrivez votre projet d'impression et obtenez un devis instantané
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="space-y-6 mb-6">
            {messages.map((message, index) => (
              <div key={index} className="w-full">
                {/* Message utilisateur comme une capsule centrée */}
                {message.role === "user" && (
                  <div className="flex justify-center mb-8">
                    <div className="bg-gray-900 text-white rounded-full px-8 py-3 text-sm font-medium max-w-4xl text-center">
                      {message.content}
                    </div>
                  </div>
                )}
                
                {/* Message assistant : afficher seulement s'il n'y a pas de produits parsés */}
                {message.role === "assistant" && products.length === 0 && (
                  <div className="max-w-4xl mx-auto mb-8">
                    <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
                      <div className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                        {message.content}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-center">
                <div className="bg-white border border-gray-200 rounded-2xl px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-400"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Configuration accordion (seulement si un produit existe) */}
          {products.length > 0 && (
            <div className={gridClass}>
              {products.map((product, index) => (
                <ProductCard
                  key={index}
                  product={product}
                  onProductUpdate={(updatedProduct) => handleProductUpdate(index, updatedProduct)}
                  compact={products.length >= 12}
                />
              ))}
            </div>
          )}

          {/* Suggestions d'exemples */}
          {messages.length === 0 && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setInput("500 cartes de visite avec pelliculage mat")}
                className="p-4 text-left border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <div className="text-sm font-medium text-gray-900 mb-1">Cartes de visite</div>
                <div className="text-xs text-gray-500">500 cartes avec pelliculage mat</div>
              </button>
              <button
                onClick={() => setInput("1000 flyers A5 recto verso")}
                className="p-4 text-left border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <div className="text-sm font-medium text-gray-900 mb-1">Flyers</div>
                <div className="text-xs text-gray-500">1000 flyers A5 recto verso</div>
              </button>
              <button
                onClick={() => setInput("Brochure 24 pages format A4")}
                className="p-4 text-left border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <div className="text-sm font-medium text-gray-900 mb-1">Brochure</div>
                <div className="text-xs text-gray-500">24 pages format A4</div>
              </button>
              <button
                onClick={() => setInput("250 affiches A2 brillant")}
                className="p-4 text-left border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <div className="text-sm font-medium text-gray-900 mb-1">Affiches</div>
                <div className="text-xs text-gray-500">250 affiches A2 brillant</div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Input sticky footer - TOUJOURS VISIBLE EN BAS */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent pt-4 pb-6 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-white rounded-2xl shadow-lg border border-gray-300">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Décrivez votre projet d'impression..."
              className="w-full px-6 py-4 pr-14 border-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="absolute right-3 bottom-3 p-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}