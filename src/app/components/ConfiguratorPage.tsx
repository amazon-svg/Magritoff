import { ChatInterface } from "./ChatInterface";

export function ConfiguratorPage() {
  // ChatInterface gère tout : conversation, ProductCards, historique.
  // Clariprint n'est jamais appelé automatiquement : uniquement sur
  // action explicite de l'utilisateur via le bouton dans chaque ProductCard.
  return (
    <ChatInterface
      onShowResults={() => {
        // Callback conservé pour compatibilité future (ex: analytics, routing)
        // mais ne déclenche plus de changement de vue — les ProductCards
        // s'affichent directement dans ChatInterface.
      }}
    />
  );
}