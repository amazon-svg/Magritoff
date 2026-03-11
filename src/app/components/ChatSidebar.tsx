import { useState } from "react";
import { Sparkles, X, Send, FileText } from "lucide-react";

interface ChatSidebarProps {
  onClose: () => void;
  currentProduct: any;
}

export function ChatSidebar({ onClose, currentProduct }: ChatSidebarProps) {
  const [messages, setMessages] = useState([
    {
      role: "user",
      content: "je veux que ce soit un flyer 4 pages recto/verso"
    },
    {
      role: "assistant",
      content: "delivery/pt1/address :"
    },
    {
      role: "user",
      content: "je veux que ce soit un flyer 4 pages recto/verso"
    },
    {
      role: "assistant",
      content: `Vous avez demandé :

500 flyer(s) commercial imprimé, format 210 mm x 150 mm , impression recto quadricouleur / verso sans impression sur papier couché mat 135 g . Conditionnement : emballage par aucun , quantité par emballage 1 .

Livraison : destination Paris, 75000 — zone France, Île-de-France (FR-75) .

Pour plus d'impact je vous propose :

• Pelliculage brillant sur le recto pour un rendu couleur plus profond et une meilleure résistance à l'usure

• Pelliculage mat sur le recto pour un toucher premium et un rendu anti-reflet, facilitant la lecture`
    }
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages([...messages, { role: "user", content: input }]);
    setInput("");
  };

  return (
    <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-500" />
          <span className="font-semibold text-gray-900">Copilot AI</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div key={index} className={`${message.role === "user" ? "bg-blue-100" : "bg-white"} p-3 rounded-lg`}>
            {message.role === "assistant" && (
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-medium text-gray-700">Copilot</span>
              </div>
            )}
            <div className="text-sm text-gray-800 whitespace-pre-line">{message.content}</div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        <button className="w-full flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded text-sm">
          <FileText className="w-4 h-4" />
          <span>Product Sheet</span>
        </button>
        <button className="w-full flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded text-sm">
          <FileText className="w-4 h-4" />
          <span>Calculer le prix</span>
        </button>
        <button className="w-full flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded text-sm">
          <FileText className="w-4 h-4" />
          <span>Mokup & 3D</span>
        </button>
        <button className="w-full flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded text-sm">
          <FileText className="w-4 h-4" />
          <span>Éditer le formulaire</span>
        </button>
      </div>

      {/* Price Section */}
      <div className="p-4 border-t border-gray-200">
        <div className="text-xs text-gray-600 mb-1">Vous avez demandé le prix de votre config.</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700">#</span>
            <span className="text-gray-700">Imprimeur</span>
            <span className="text-gray-700">Montant</span>
            <span className="text-gray-700">Delai</span>
            <span className="text-gray-700">Doc</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-900">4.2</span>
            <span className="text-gray-900">Imprimerie Rochelaise Numérique (Konica Xerox Epson)</span>
            <span className="text-gray-900">38,98 €</span>
            <span className="text-gray-900">1 jour(s)</span>
            <span>📄</span>
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="écrivez ici..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={handleSend} className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
