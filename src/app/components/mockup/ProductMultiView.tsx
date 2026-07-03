/**
 * ProductMultiView — S-PRODUCT-VIEWS-MULTI (Sprint 7, 2026-06-01).
 *
 * Wrap MockupImage avec un toggle Recto/Verso. Le composant gère l'état
 * local de la vue active + bascule entre les 2 PNGs (paths CDN distincts
 * via le suffixe __back côté MockupImage.helpers).
 *
 * Décision Option A 2D multi-vues (cf. pitch-court 22/05) :
 *  - Aucun three.js, aucun bundle ajouté
 *  - Templates SVG existants (flyer + carteVisite) supportent la vue 'back'
 *  - Templates qui n'ont pas de back différencié (brochure, etiquette,
 *    kakemono) rendent un PNG identique pour les 2 vues — pas de souci,
 *    le composant marche, l'utilisateur voit juste 2 fois la même image
 *    (cas dégradé acceptable MVP).
 *
 * Pattern UI : 2 boutons radio "Recto / Verso" en haut + MockupImage qui
 * re-render au switch. Pas de transition animée pour MVP (jugé inutile
 * dans le pitch-court : c'est un outil de validation B2B, pas une vitrine).
 */

import { useState } from 'react';
import type { MockupImageProps } from './MockupImage';
import { MockupImage } from './MockupImage';

interface Props extends Omit<MockupImageProps, 'view'> {
  /** Vue initiale (defaut 'front'). */
  initialView?: 'front' | 'back';
}

export function ProductMultiView(props: Props) {
  const [view, setView] = useState<'front' | 'back'>(props.initialView ?? 'front');

  return (
    <div className="space-y-2" data-testid="product-multi-view">
      <div className="flex items-center gap-1 text-xs">
        <button
          type="button"
          onClick={() => setView('front')}
          className={`px-2 py-1 rounded ${view === 'front' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          data-testid="product-multi-view-front-btn"
          aria-pressed={view === 'front'}
        >
          Recto
        </button>
        <button
          type="button"
          onClick={() => setView('back')}
          className={`px-2 py-1 rounded ${view === 'back' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          data-testid="product-multi-view-back-btn"
          aria-pressed={view === 'back'}
        >
          Verso
        </button>
      </div>
      <MockupImage {...props} view={view} />
    </div>
  );
}
