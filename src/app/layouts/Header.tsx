import { useState } from "react";
import { useNavigate } from "react-router";
import { Settings } from "lucide-react";
import { MagritLogo } from "@/shared/presentation/MagritLogo";
import { DiagnosticPanel } from '@/modules/diagnostics/ui/components';
import { useConversation } from '@/modules/conversations/ui/runtime';
import { AuthMenu } from '@/modules/account/ui/auth';
import { useTenant } from '@/modules/tenants/ui/runtime';

export function Header() {
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const navigate = useNavigate();
  const { startNewConversation } = useConversation();
  // BCP-0c (docs/api/CONVENTIONS.md §8.25, point 2.3ter) — le diagnostic
  // declenche un appel facture (Anthropic, peut-etre Clariprint). La vraie
  // barriere est le serveur (`is_super_admin()`, `diagnostics-routes.ts`) :
  // ce masquage n est que de l ergonomie, pour qui n a de toute facon aucune
  // chance d obtenir un 200.
  const { isSuperAdmin } = useTenant();

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
            {isSuperAdmin && (
              <button
                onClick={() => setShowDiagnostic(true)}
                title="Diagnostic des connexions API"
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            {/* E10.1 (qa-review B1) : le panier disparait des surfaces
                internes Magrit (decision RP 28/08/2026) — plus de bouton
                Panier dans le header, remplace par le conteneur Projet. */}
            <AuthMenu />
          </div>
        </div>
      </header>

      {showDiagnostic && <DiagnosticPanel onClose={() => setShowDiagnostic(false)} />}
    </>
  );
}