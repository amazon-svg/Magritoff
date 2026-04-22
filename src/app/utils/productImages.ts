/**
 * Resolveur d'image produit.
 *
 * Ordre de priorité :
 *  1. `product.image_url` (image définie explicitement sur le produit)
 *  2. `ProductDefinition.image_url` (image PIM spécifique à la variation)
 *  3. `Gamme.image_url` (image PIM par défaut de la gamme)
 *  4. → null : le composant affiche le ProductMockup SVG (picto cohérent
 *     avec la charte graphique, couleurs pastel hash-based).
 *
 * On ne pioche plus dans un pool Unsplash par défaut : soit on a une image
 * validée (par le produit ou le PIM), soit on affiche un picto aesthétique.
 * L'admin curera les images depuis l'admin PIM (/dashboard/admin/pim).
 */

import type { Gamme, ProductDefinition } from './productEnrichment';
import { resolveGamme, resolveDefinition } from './productEnrichment';

export interface ResolveImageInput {
  name: string;
  id?: string;
  image_url?: string;
  /** Config Clariprint brute (kind, width, height, etc.) */
  clariprintData?: any;
  kind?: string;
  /** Données PIM chargées côté appelant */
  gammes?: Gamme[];
  definitions?: ProductDefinition[];
  locale?: string;
}

/**
 * Retourne l'URL d'image à utiliser, ou null si on doit retomber sur le picto.
 */
export function resolveProductImage(input: ResolveImageInput): string | null {
  // 1. Image custom sur le produit
  if (input.image_url && input.image_url.trim()) {
    return input.image_url;
  }

  // 2 & 3 — Images du PIM
  if (input.gammes && input.definitions) {
    const config = {
      ...input.clariprintData,
      kind: input.clariprintData?.kind ?? input.kind,
      name: input.name,
    };
    const gamme = resolveGamme(config, input.gammes);
    if (gamme) {
      const def = resolveDefinition(
        gamme.slug,
        config,
        input.locale ?? 'fr',
        input.definitions
      );
      if (def?.image_url && def.image_url.trim()) return def.image_url;
      if (gamme.image_url && gamme.image_url.trim()) return gamme.image_url;
    }
  }

  // 4. Pas d'image valide — le composant affichera le ProductMockup SVG
  return null;
}
