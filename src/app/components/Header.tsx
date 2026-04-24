import { useState } from "react";
import { useNavigate } from "react-router";
import { Settings } from "lucide-react";
import { MagritLogo } from "./brand/MagritLogo";
import { DiagnosticPanel } from "./DiagnosticPanel";
import { CartButton } from "./CartButton";
import { useConversation } from "../contexts/ConversationContext";
import { AuthMenu } from "./auth/AuthMenu";

export function Header() {
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const navigate = useNavigate();
  const { startNewConversation } = useConversation();

  const handleLogoClick = () => {
    startNewConversation();
    navigate("/");
  };

  return (
    <>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-6 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={handleLogoClick}
            className="flex items-center gap-2 cursor-pointer"
            aria-label="Retour à l'accueil et sauvegarde de la conversation en cours"
          >
            <MagritLogo size={30} />
            <span className="text-ink" style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>Magrit</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDiagnostic(true)}
              title="Diagnostic des connexions API"
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
            <CartButton variant="pill" />
            <AuthMenu />
          </div>
        </div>
      </header>

      {showDiagnostic && <DiagnosticPanel onClose={() => setShowDiagnostic(false)} />}
    </>
  );
}