/**
 * Resolveur d'image produit — le visuel est une PROPRIETE DE LA GAMME.
 *
 * REFACTO-VISUELS (2026-08-09, arbitrage Arnaud)
 * ──────────────────────────────────────────────
 * Avant : quand ni le produit ni le PIM ne portaient d'image, on devinait une
 * « famille de visuel » en cherchant des mots-cles dans le NOM et la CATEGORIE
 * du produit (resolveProductMockupAsset), puis on servait un des 7 visuels
 * Magrit pre-brandes. Cette taxonomie parallele a 7 entrees ne couvrait que 6
 * des 16 familles racines du PIM et retombait SILENCIEUSEMENT sur « flyer »
 * pour tout le reste : un calendrier, un panneau ou un drapeau affichaient une
 * feuille plate. Un visuel faux est pire qu'une absence de visuel.
 *
 * Apres : une seule autorite, la GAMME du PIM. Le visuel se resout par
 * heritage le long de l'arbre des gammes, et rien d'autre :
 *
 *   1. `product.image_url`                — image posee sur le produit
 *   2. `ProductDefinition.image_url`      — image PIM de la variation
 *   3. `Gamme.image_url`                  — image PIM de la gamme resolue
 *   4. `Gamme.image_url` des ANCETRES     — remontee `parent_slug` jusqu'a la
 *                                           racine (une sous-gamme herite du
 *                                           visuel de sa famille)
 *   5. `null`                             — aucun visuel curé
 *
 * A l'etape 5 le resolveur retourne `null` ASSUMÉ : c'est au composant
 * d'afficher le repere de famille (pictogramme + tonalite, cf.
 * `shopFamilyIdentity`), pas au resolveur de fabriquer une ressemblance. La
 * couverture reelle est mesuree et affichee dans l'admin PIM.
 *
 * Les visuels par defaut des familles couvertes sont poses en base par la
 * migration `20260809000100_gamme_visuals.sql` et restent modifiables gamme
 * par gamme depuis l'admin PIM.
 */

import type { Gamme, ProductDefinition } from './productEnrichment';
import { resolveProductGamme, resolveDefinition } from './productEnrichment';

/** Profondeur max de remontee — garde anti-cycle sur `parent_slug`. */
const MAX_GAMME_DEPTH = 8;

function cleanUrl(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Visuel d'une gamme, avec heritage : sa propre `image_url` si elle en a une,
 * sinon celle de son parent, en remontant jusqu'a la racine.
 *
 * Pur et exporte : sert au resolveur produit, aux tuiles de gamme et a la
 * taxonomie de boutique, pour que tous les points d'affichage repondent la
 * meme chose sur la meme gamme.
 */
export function resolveGammeImage(
  gammeSlug: string | null | undefined,
  gammes: Gamme[] | undefined,
): string | null {
  if (!gammeSlug || !gammes || gammes.length === 0) return null;
  const bySlug = new Map(gammes.map((g) => [g.slug, g]));
  let current = bySlug.get(gammeSlug) ?? null;
  const seen = new Set<string>();
  let depth = 0;
  while (current && depth < MAX_GAMME_DEPTH && !seen.has(current.slug)) {
    const own = cleanUrl(current.image_url);
    if (own) return own;
    seen.add(current.slug);
    current = current.parent_slug ? bySlug.get(current.parent_slug) ?? null : null;
    depth += 1;
  }
  return null;
}

export interface ResolveImageInput {
  name: string;
  id?: string;
  image_url?: string;
  /** Config Clariprint brute (kind, width, height, etc.) */
  clariprintData?: any;
  kind?: string;
  /** Categorie produit (conservee pour le matching de gamme). */
  category?: string;
  /** ADR-4.17 : categorie explicite autoritaire (FK gamme). Prime sur les regles. */
  gamme_slug?: string | null;
  /** Données PIM chargées côté appelant */
  gammes?: Gamme[];
  definitions?: ProductDefinition[];
  locale?: string;
}

/**
 * URL d'image a utiliser pour un produit, ou `null` si aucun visuel n'est cure
 * pour lui ni pour sa gamme. Le caller affiche alors le repere de famille.
 */
export function resolveProductImage(input: ResolveImageInput): string | null {
  // 1. Image custom sur le produit
  const own = cleanUrl(input.image_url);
  if (own) return own;

  if (!input.gammes || input.gammes.length === 0) return null;

  const config = {
    ...input.clariprintData,
    kind: input.clariprintData?.kind ?? input.kind,
    name: input.name,
  };
  const gamme = resolveProductGamme(
    { config, name: input.name, gamme_slug: input.gamme_slug },
    input.gammes,
  );
  if (!gamme) return null;

  // 2. Image PIM de la variation (definition) — override le niveau gamme.
  if (input.definitions) {
    const def = resolveDefinition(
      gamme.slug,
      config,
      input.locale ?? 'fr',
      input.definitions,
    );
    const defImage = cleanUrl(def?.image_url);
    if (defImage) return defImage;
  }

  // 3 & 4. Image de la gamme, puis de ses ancetres.
  return resolveGammeImage(gamme.slug, input.gammes);
}
