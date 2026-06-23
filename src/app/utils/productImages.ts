/**
 * Resolveur d'image produit.
 *
 * Ordre de priorité :
 *  1. `product.image_url` (image définie explicitement sur le produit)
 *  2. `ProductDefinition.image_url` (image PIM spécifique à la variation)
 *  3. `Gamme.image_url` (image PIM par défaut de la gamme)
 *  4. → visuel produit pré-brandé Magrit (Gemini) de la famille, via
 *     resolveProductMockupAsset (P18 v2, 2026-06-24). Fallback universel : la
 *     home, le catalogue et la fiche produit affichent le meme visuel vitrine
 *     quand aucune image curée n'est définie, au lieu du picto SVG.
 *
 * On ne pioche plus dans un pool Unsplash par défaut : soit on a une image
 * validée (par le produit ou le PIM), soit le visuel Magrit de la famille.
 * L'admin curera les images depuis l'admin PIM (/dashboard/admin/pim).
 */

import type { Gamme, ProductDefinition } from './productEnrichment';
import { resolveGamme, resolveDefinition } from './productEnrichment';
import { resolveProductMockupAsset } from './productMockupAssets';

export interface ResolveImageInput {
  name: string;
  id?: string;
  image_url?: string;
  /** Config Clariprint brute (kind, width, height, etc.) */
  clariprintData?: any;
  kind?: string;
  /** Categorie produit (sert a l'inference de famille du visuel Gemini). */
  category?: string;
  /** Données PIM chargées côté appelant */
  gammes?: Gamme[];
  definitions?: ProductDefinition[];
  locale?: string;
}

/**
 * Retourne l'URL d'image à utiliser. Toujours non-null depuis P18 v2 : à défaut
 * d'image curée (produit / PIM), on sert le visuel produit pré-brandé Magrit de
 * la famille (fallback universel boutique).
 */
export function resolveProductImage(input: ResolveImageInput): string {
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
    const gamme = resolveGamme(config, input.gammes, input.name);
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

  // 4. Pas d'image curée — visuel produit pré-brandé Magrit de la famille
  //    (resolu via kind Clariprint puis inference nom + categorie).
  return resolveProductMockupAsset({
    name: input.name,
    kind: input.kind,
    clariprintData: input.clariprintData,
    category: input.category,
  });
}
