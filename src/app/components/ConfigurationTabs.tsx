import { useState } from "react";
import { ChevronUp, ChevronDown, Info } from "lucide-react";

interface ConfigurationTabsProps {
  product: any;
  setProduct: (product: any) => void;
}

export function ConfigurationTabs({ product, setProduct }: ConfigurationTabsProps) {
  const [activeTab, setActiveTab] = useState("dimensions");

  const tabs = [
    { id: "dimensions", label: "Dimensions & matière" },
    { id: "options", label: "Options (impression & finition)" },
    { id: "expedition", label: "Expédition" },
    { id: "patrons", label: "Patrons de découpe" },
    { id: "texture", label: "Texture et rendu" },
    { id: "3d", label: "3D" },
  ];

  return (
    <div className="flex-1 bg-white">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex px-8 gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 text-sm relative ${
                activeTab === tab.id
                  ? "text-gray-900 font-medium"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-8 max-w-3xl">
        {activeTab === "dimensions" && (
          <div className="space-y-6">
            {/* Quantity */}
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                Quantité souhaitée
                <Info className="w-4 h-4 text-gray-400" />
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={product.quantity}
                  onChange={(e) => setProduct({ ...product, quantity: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col">
                  <button className="text-gray-400 hover:text-gray-600">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button className="text-gray-400 hover:text-gray-600">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Height */}
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                Hauteur
                <Info className="w-4 h-4 text-gray-400" />
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={product.height}
                  onChange={(e) => setProduct({ ...product, height: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col">
                  <button className="text-gray-400 hover:text-gray-600">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button className="text-gray-400 hover:text-gray-600">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Width */}
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                Largeur
                <Info className="w-4 h-4 text-gray-400" />
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={product.width}
                  onChange={(e) => setProduct({ ...product, width: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col">
                  <button className="text-gray-400 hover:text-gray-600">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button className="text-gray-400 hover:text-gray-600">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Material Type */}
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                Matière &gt; Type
                <Info className="w-4 h-4 text-gray-400" />
              </label>
              <input
                type="text"
                value={product.material}
                onChange={(e) => setProduct({ ...product, material: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Material Weight */}
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                Matière &gt; Grammage g/m2
                <Info className="w-4 h-4 text-gray-400" />
              </label>
              <input
                type="number"
                value={product.weight}
                onChange={(e) => setProduct({ ...product, weight: parseFloat(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
