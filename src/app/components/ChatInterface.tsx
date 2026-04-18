import { useState, useEffect } from "react";
import { Send, History, X } from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import logoImage from "figma:asset/48de195d09839b5e2071e781c31fa390056b1db8.png";
import { ProductCard } from "./ProductCard";
import { CartButton } from "./CartButton";

interface ChatInterfaceProps {
  onShowResults?: () => void;
  onProductConfigReceived?: (config: any) => void;
}

interface ConversationHistory {
  id: string;
  timestamp: number;
  title: string;
  messages: Array<{ role: string; content: string }>;
  products: any[];
}

export function ChatInterface({ onShowResults, onProductConfigReceived }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

  const [conversationHistory, setConversationHistory] = useState<ConversationHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // ─── Historique localStorage ──────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("magrit_conversation_history");
    if (saved) {
      try { setConversationHistory(JSON.parse(saved)); } catch {}
    }
  }, []);

  useEffect(() => {
    if (conversationHistory.length > 0) {
      localStorage.setItem("magrit_conversation_history", JSON.stringify(conversationHistory));
    }
  }, [conversationHistory]);

  const saveCurrentConversation = (
    newMessages: Array<{ role: string; content: string }>,
    newProducts: any[]
  ) => {
    const firstUser = newMessages.find((m) => m.role === "user")?.content || "Nouvelle conversation";
    const title = firstUser.length > 50 ? firstUser.substring(0, 50) + "..." : firstUser;

    if (currentConversationId) {
      setConversationHistory((prev) =>
        prev.map((conv) =>
          conv.id === currentConversationId
            ? { ...conv, messages: newMessages, products: newProducts, timestamp: Date.now() }
            : conv
        )
      );
    } else {
      const newId = `conv-${Date.now()}`;
      setCurrentConversationId(newId);
      setConversationHistory((prev) => [
        { id: newId, timestamp: Date.now(), title, messages: newMessages, products: newProducts },
        ...prev,
      ]);
    }
  };

  const loadConversation = (conv: ConversationHistory) => {
    setMessages(conv.messages);
    setProducts(conv.products);
    setCurrentConversationId(conv.id);
    setShowHistory(false);
    if (conv.products.length > 0) onShowResults();
  };

  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversationHistory((prev) => prev.filter((c) => c.id !== id));
    if (currentConversationId === id) {
      setCurrentConversationId(null);
      setMessages([]);
      setProducts([]);
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setProducts([]);
    setCurrentConversationId(null);
    setShowHistory(false);
  };

  // ─── Mapper les configs JSON Clariprint → objets ProductCard ─────────────
  const parseConfigsToProducts = (configs: any[]): any[] => {
    if (!configs || configs.length === 0) return [];

    return configs.map((config: any, index: number) => {
      const d = config.display || {};
      const c = config.clariprint || {};

      return {
        id: `product-${Date.now()}-${index}`,
        // Champs affichage (source : Claude display)
        name: d.productName || c.reference || "Produit",
        quantity: d.quantity || c.quantity || 0,
        format: d.format || `${c.width} × ${c.height} cm`,
        material: d.support || "",
        weight: typeof d.grammage === "number" ? d.grammage : parseInt(d.grammage) || 0,
        printing: {
          recto: d.impression?.recto || "Quadrichromie (CMJN)",
          verso: d.impression?.verso || (c.back_colors?.length > 0 ? "Quadrichromie (CMJN)" : "Sans impression"),
        },
        finish: d.finitionRecto || "",
        finishRecto: d.finitionRecto || "",
        finishVerso: d.finitionVerso || "Sans finition",
        suggestions: Array.isArray(d.suggestions) ? d.suggestions : [],
        pages: c.pages || null,
        // Champs Clariprint bruts (pour l'API de devis)
        clariprintData: c,
      };
    });
  };

  // ─── handleSend ───────────────────────────────────────────────────────────
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
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e3db71a4/claude-proxy`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ messages: newMessages }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ HTTP ${response.status}:`, errorText);
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      console.log("📦 Réponse serveur reçue:", data);

      // Texte lisible pour le chat (généré côté serveur)
      assistantMessage =
        data.content?.[0]?.text ||
        "Désolé, je n'ai pas pu traiter votre demande.";

      setMessages((prev) => [...prev, { role: "assistant", content: assistantMessage }]);
      setIsDemoMode(!!data.demoMode);

      // ✅ PRIORITÉ 1 : Utiliser data.configs (format JSON structuré)
      if (data.configs && Array.isArray(data.configs) && data.configs.length > 0) {
        console.log(`✅ ${data.configs.length} config(s) JSON reçue(s) depuis le serveur`);
        parsedProducts = parseConfigsToProducts(data.configs);
      }

      if (parsedProducts.length > 0) {
        console.log(`🎯 ${parsedProducts.length} produit(s) prêt(s) pour les ProductCards`);
        setProducts((prev) => [...prev, ...parsedProducts]);
        onShowResults();
      } else {
        console.warn("⚠️ Aucun produit extrait de la réponse");
      }

    } catch (error: any) {
      console.error("❌ Chat error:", error);
      setIsDemoMode(true);

      // Fallback : mode démo avec carte de visite
      const demoConfigs = [
        {
          clariprint: {
            reference: "Cartes de visite",
            kind: "leaflet",
            quantity: 500,
            width: "8.5",
            height: "5.5",
            with_bleeds: "1",
            front_colors: ["4-color"],
            back_colors: ["4-color"],
            papers: { custom: { quality: "Couché Brillant PEFC", weight: "350" } },
            finishing_front: "PELLIC_ACETATE_MAT",
            finishing_back: "PELLIC_ACETATE_MAT",
          },
          display: {
            productName: "Cartes de visite",
            quantity: 500,
            format: "85 × 55 mm (format standard)",
            support: "Papier couché brillant",
            grammage: 350,
            impression: { recto: "Quadrichromie (CMJN)", verso: "Quadrichromie (CMJN)" },
            finitionRecto: "Pelliculage mat",
            finitionVerso: "Pelliculage mat",
            suggestions: [
              "• Coins ronds pour un look moderne (+8€)",
              "• Vernis sélectif sur le logo (+15€)",
              "• Dorure à chaud pour un effet premium (+35€)",
            ],
          },
        },
      ];

      parsedProducts = parseConfigsToProducts(demoConfigs);
      assistantMessage = "**500 Cartes de visite**\n- **Format** : 85 × 55 mm\n- **Support** : Papier couché brillant\n- **Grammage** : 350g/m²\n- **Finition** : Pelliculage mat";
      setMessages((prev) => [...prev, { role: "assistant", content: assistantMessage }]);
      setProducts((prev) => [...prev, ...parsedProducts]);
      onShowResults();
    } finally {
      setIsLoading(false);
      const finalMessages = [...newMessages, { role: "assistant", content: assistantMessage }];
      const allProducts = [...products, ...parsedProducts];
      saveCurrentConversation(finalMessages, allProducts);
    }
  };

  const handleProductUpdate = (index: number, updatedProduct: any) => {
    setProducts((prev) => {
      const next = [...prev];
      next[index] = updatedProduct;
      return next;
    });
  };

  // ─── Grille adaptative ────────────────────────────────────────────────────
  const getGridClass = () => {
    const n = products.length;
    if (n <= 2) return "grid grid-cols-2 gap-4 items-stretch";
    if (n <= 6) return "grid grid-cols-2 gap-4 items-stretch";
    if (n <= 12) return "grid grid-cols-3 gap-4 items-stretch";
    return "grid grid-cols-4 gap-3 items-stretch";
  };

  const containerClass =
    products.length > 0
      ? "w-full px-6 py-8 mx-auto transition-all duration-300 max-w-7xl"
      : "w-full px-6 py-8 mx-auto transition-all duration-300 max-w-3xl";

  const gridClass = getGridClass();

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-gray-50">
      {/* ── Sidebar historique ── */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowHistory(false)} />
          <div className="relative w-80 bg-white shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5" />
                <h2 className="text-lg font-semibold">Historique</h2>
              </div>
              <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-gray-800 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-gray-200">
              <button
                onClick={startNewConversation}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                + Nouvelle conversation
              </button>
            </div>
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
                      currentConversationId === conv.id ? "bg-blue-50 border-blue-500" : "bg-white border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{conv.title}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(conv.timestamp).toLocaleDateString("fr-FR", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                        {conv.products.length > 0 && (
                          <p className="text-xs text-blue-600 mt-1">
                            {conv.products.length} produit{conv.products.length > 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => deleteConversation(conv.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded"
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

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
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

      {/* ── Main content ── */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className={containerClass}>
          {/* Logo intro */}
          {messages.length === 0 && (
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-20 h-20 mb-6">
                <img src={logoImage} alt="Magrit" className="w-20 h-20 rounded-2xl shadow-lg" />
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">Magrit Copilot AI</h1>
              <p className="text-lg text-gray-600">
                Décrivez votre projet d'impression et obtenez un devis instantané
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="space-y-6 mb-6">
            {messages.map((message, index) => (
              <div key={index} className="w-full">
                {message.role === "user" && (
                  <div className="flex justify-center mb-8">
                    <div className="bg-gray-900 text-white rounded-full px-8 py-3 text-sm font-medium max-w-4xl text-center">
                      {message.content}
                    </div>
                  </div>
                )}
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
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-400" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ProductCards */}
          {products.length > 0 && (
            <div className={gridClass}>
              {products.map((product, index) => (
                <ProductCard
                  key={index}
                  product={product}
                  onProductUpdate={(updated) => handleProductUpdate(index, updated)}
                  compact={products.length >= 12}
                />
              ))}
            </div>
          )}

          {/* Suggestions d'exemples */}
          {messages.length === 0 && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: "Cartes de visite", sub: "500 cartes avec pelliculage mat", msg: "500 cartes de visite avec pelliculage mat" },
                { label: "Flyers", sub: "1000 flyers A5 recto verso", msg: "1000 flyers A5 recto verso" },
                { label: "Brochure", sub: "24 pages format A4", msg: "Brochure 24 pages format A4" },
                { label: "Affiches", sub: "250 affiches A2 brillant", msg: "250 affiches A2 brillant" },
              ].map((ex) => (
                <button
                  key={ex.msg}
                  onClick={() => setInput(ex.msg)}
                  className="p-4 text-left border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <div className="text-sm font-medium text-gray-900 mb-1">{ex.label}</div>
                  <div className="text-xs text-gray-500">{ex.sub}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Input sticky ── */}
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