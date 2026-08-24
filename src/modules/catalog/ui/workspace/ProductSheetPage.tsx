import { X } from "lucide-react";
import { Link, useParams } from "react-router";
import productImage from "figma:asset/07dc76cafb5a8e2d7b0b5609fb222116b2257f28.png";

export function ProductSheet() {
  const { id } = useParams();

  const product = {
    id: id || "42ac6b71d2c9dc4408f7b0f855f1bf7d",
    name: "Commercial printed flyer",
    sku: "42ac6b71d2c9dc4408f7b0f855f1bf7d",
    description: "Feuillet papier fin A6→A4, 1 ou 2 faces, non plié.",
    subtitle: "Match : feuillet flyer, prospectus, tract, feuillet, distribution",
    specs: {
      hauteur: "150 mm",
      largeur: "210 mm",
      matiere: "Couche Mat 135.0 147",
      quantity: "500 ex",
      recto: "4-couleurs",
      verso: "sans",
      recto2: "sans",
      verso2: "sans",
      emballage: "sans",
      numberPerWrap: "1",
      deliveryISO: "FRA FR-75",
      deliveryAddress: "Paris, 75000"
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Fiche produit</h2>
          <Link to="/" className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </Link>
        </div>

        {/* Product Image */}
        <div className="p-6">
          <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg p-8 flex items-center justify-center aspect-video">
            <img 
              src={productImage} 
              alt="Product mockup" 
              className="max-w-full h-auto object-contain"
            />
          </div>
        </div>

        {/* Product Info */}
        <div className="px-6 pb-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{product.name}</h3>
          <div className="text-sm text-gray-600 mb-1">SKU : {product.sku}</div>
          <p className="text-sm text-gray-800 mb-2">{product.description}</p>
          <p className="text-xs text-gray-600 mb-6">{product.subtitle}</p>

          {/* Specifications */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3 uppercase">Caractéristiques</h4>
            <div className="divide-y divide-gray-200">
              {Object.entries(product.specs).map(([key, value]) => (
                <div key={key} className="py-3 flex justify-between">
                  <span className="text-sm text-gray-600 capitalize">{key}</span>
                  <span className="text-sm text-gray-900 font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
          <Link 
            to="/"
            className="block w-full px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-center rounded text-sm font-medium"
          >
            Retour à la configuration
          </Link>
        </div>
      </div>
    </div>
  );
}
