/**
 * Onglet "3D" de la ProductCard atelier.
 *
 * Extrait de ProductCard.tsx lors du R1 Phase B (refacto 2026-05-11).
 * Pour l'instant : placeholder visuel. La vraie 3D arrivera avec une story
 * dediee (mockup 3D en V2+, cf. PRD).
 */

import { ChevronUp } from 'lucide-react';

interface ProductCard3DProps {
  onClose: () => void;
}

export function ProductCard3D({ onClose }: ProductCard3DProps) {
  return (
    <div className="bg-paper border-2 border-line rounded-xl p-6 mb-3 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-ink">Aperçu 3D & Mockup</h3>
        <button onClick={onClose} className="text-ink-muted hover:text-ink">
          <ChevronUp className="w-5 h-5" />
        </button>
      </div>
      <div className="text-base text-ink-muted">
        <p className="mb-3">Visualisez votre produit en 3D avant impression.</p>
        <div className="bg-line rounded-lg p-12 text-center">
          <div className="text-ink-mute-2 text-6xl mb-3">🎨</div>
          <p className="text-ink-muted">Aperçu 3D disponible après upload de votre design</p>
        </div>
      </div>
    </div>
  );
}
