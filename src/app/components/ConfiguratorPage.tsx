import { useState } from "react";
import { ChatSidebar } from "./ChatSidebar";
import { ConfigurationTabs } from "./ConfigurationTabs";
import { PricingPanel } from "./PricingPanel";
import { ChatInterface } from "./ChatInterface";

export function ConfiguratorPage() {
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [currentProduct, setCurrentProduct] = useState({
    id: "42ac6b71d2c9dc4408f7b0f855f1bf7d",
    name: "Commercial printed flyer",
    quantity: 500,
    height: 150,
    width: 210,
    material: "Offset Blanc",
    weight: 90.0,
    recto: "4-couleurs",
    verso: "sans",
    finish: "sans",
    packaging: "sans",
    delivery: "Paris, 75000",
    price: 38.98
  });

  const handleProductConfigReceived = (config: any) => {
    // Mettre à jour le produit avec la configuration reçue de Claude
    const updatedProduct = {
      ...currentProduct,
      name: config.productName || currentProduct.name,
      quantity: config.quantity || currentProduct.quantity,
      height: config.dimensions?.height || currentProduct.height,
      width: config.dimensions?.width || currentProduct.width,
      material: config.material || currentProduct.material,
      weight: config.weight || currentProduct.weight,
      recto: config.printing?.recto || currentProduct.recto,
      verso: config.printing?.verso || currentProduct.verso,
      finish: config.finish || currentProduct.finish,
      delivery: config.deliveryInfo || currentProduct.delivery,
    };
    setCurrentProduct(updatedProduct);
  };

  // Si aucun résultat n'est affiché, montrer l'interface de prompt centrée
  if (!showResults) {
    return (
      <ChatInterface 
        onShowResults={() => setShowResults(true)}
        onProductConfigReceived={handleProductConfigReceived}
      />
    );
  }

  // Sinon, afficher l'interface complète avec la configuration
  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Chat Sidebar */}
      {isChatOpen && (
        <ChatSidebar 
          onClose={() => setIsChatOpen(false)} 
          currentProduct={currentProduct}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <ConfigurationTabs product={currentProduct} setProduct={setCurrentProduct} />
      </div>

      {/* Pricing Panel */}
      <PricingPanel product={currentProduct} />
    </div>
  );
}