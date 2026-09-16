/**
 * BCP-10 (docs/api/CONVENTIONS.md §8.25 point 3.5 (g)/(h), point 4) — fonction
 * pure « résolution → texte + badge ».
 *
 * La fiche produit `/p/:id` n'a plus de chiffrage propre (le lot supprime
 * `calculatePrice` et la mise à l'échelle `priceHT * (qty / 500)`, qui
 * n'existaient qu'à cet endroit). Elle doit donc afficher un prix par la
 * règle DÉJÀ écrite au point 4 (a) du cadrage, partagée avec la carte
 * catalogue : `resolvePrice(product, clariprintQuote)` donne la HIÉRARCHIE
 * (clariprint > library_cached > prix_marche > zero) ; cette fonction-ci
 * décide seulement de l'AFFICHAGE de cette résolution — un montant à
 * formater ou un texte de repli, jamais « 0 € ».
 *
 * BCP-10 est le premier lot à en avoir besoin et la crée à cet effet.
 * BCP-4 la CONSOMME (carte catalogue, plancher de gamme, suggestions de
 * Magrit) au lieu d'en écrire une seconde copie — voir le motif au point
 * 3.5 (g) : « BCP-10 ne touche ni priceResolver.ts, ni gammeFloorPrices.ts,
 * ni ShopProductCard.tsx, ni GammeTile.tsx — ils restent la propriété de
 * BCP-4. »
 *
 * Ce fichier ne modifie PAS `priceResolver.ts` (qui reste seul propriétaire
 * du calcul de la hiérarchie) : il consomme son type `PriceResolution` en
 * lecture seule.
 */

import type { PriceResolution } from '@/modules/clariprint/ui/helpers';

/** Libellé exact du badge « prix estimé » (point 4 (e) du cadrage). */
export const MARKET_PRICE_BADGE_LABEL = 'Prix marché';

/** Infobulle exacte associée au badge (point 4 (e) du cadrage). */
export const MARKET_PRICE_BADGE_TOOLTIP =
  "Estimation Magrit. Le prix définitif est confirmé par l'imprimeur à la validation de la commande.";

/** Texte de repli quand aucun prix n'est calculable — jamais « 0 € » (point 4 (a)). */
export const UNPRICED_PRICE_LABEL = 'Prix à la configuration';

export type ResolvedPriceDisplay =
  | {
      /** Un montant existe (source `clariprint`, `library_cached` ou `prix_marche`). */
      kind: 'priced';
      priceHT: number;
      /** true seulement pour la source `prix_marche` (point 4 (a)). */
      badge: boolean;
    }
  | {
      /** Source `zero` : rien à chiffrer, on ne montre jamais « 0 € ». */
      kind: 'unpriced';
      label: string;
    };

/**
 * Traduit une `PriceResolution` (déjà calculée par `resolvePrice()`) en ce
 * qu'un écran doit montrer : un montant HT (avec ou sans badge « Prix
 * marché ») ou un texte de repli.
 *
 * Règle exacte (point 4 (a)) :
 *  - `clariprint` ou `library_cached` : le prix, SANS badge.
 *  - `prix_marche` : le prix, AVEC badge.
 *  - `zero` : `UNPRICED_PRICE_LABEL`, jamais « 0 € ».
 */
export function resolveProductPriceDisplay(
  resolution: PriceResolution,
): ResolvedPriceDisplay {
  if (resolution.source === 'zero') {
    return { kind: 'unpriced', label: UNPRICED_PRICE_LABEL };
  }
  return {
    kind: 'priced',
    priceHT: resolution.priceHT,
    badge: resolution.source === 'prix_marche',
  };
}
