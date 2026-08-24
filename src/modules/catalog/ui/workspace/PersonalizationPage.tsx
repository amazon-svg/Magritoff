import { X, Upload } from "lucide-react";
import { Link, useParams } from "react-router";
import { useState } from "react";

export function PersonalizationPage() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState("templates");

  const tabs = [
    { id: "templates", label: "Templates" },
    { id: "shot", label: "Shot" },
    { id: "video", label: "Video" },
    { id: "glb", label: "GLB" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Personnalisation</h2>
          <Link to="/" className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </Link>
        </div>

        {/* Preview Area */}
        <div className="p-6">
          <div className="bg-gradient-to-b from-gray-200 to-gray-300 rounded-lg aspect-square flex items-center justify-center">
            <div className="bg-white w-32 h-48 shadow-lg transform rotate-3" />
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6">
          <div className="flex gap-4 border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-sm relative ${
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

        {/* Upload Sections */}
        <div className="p-6 space-y-6">
          {/* Front Side */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <label className="text-sm font-medium text-gray-900">Leaflet front side</label>
              <button className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <path d="M12 16v-4M12 8h.01" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
              <div className="text-sm text-gray-900 font-medium mb-1">
                Dépose ton image ici
              </div>
              <div className="text-sm text-gray-600 mb-2">ou</div>
              <button className="text-sm text-blue-600 hover:text-blue-700 underline">
                parcourir
              </button>
              <div className="text-xs text-gray-500 mt-2">
                PNG ou JPEG — max 300×300 (compression auto)
              </div>
            </div>
          </div>

          {/* Back Side */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <label className="text-sm font-medium text-gray-900">Leaflet back side</label>
              <button className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <path d="M12 16v-4M12 8h.01" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
              <div className="text-sm text-gray-900 font-medium mb-1">
                Dépose ton image ici
              </div>
              <div className="text-sm text-gray-600 mb-2">ou</div>
              <button className="text-sm text-blue-600 hover:text-blue-700 underline">
                parcourir
              </button>
              <div className="text-xs text-gray-500 mt-2">
                PNG ou JPEG — max 300×300 (compression auto)
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 space-y-2">
          <button className="w-full px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded text-sm font-medium">
            Valider la personnalisation
          </button>
          <Link 
            to="/"
            className="block w-full px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-center rounded text-sm"
          >
            Annuler
          </Link>
        </div>
      </div>
    </div>
  );
}
