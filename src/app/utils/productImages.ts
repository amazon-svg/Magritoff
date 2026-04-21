/**
 * Resolveur d'image produit — mapping thematique print.
 *
 * Strategie :
 *  1. Si le produit a une `image_url` explicite → on l'utilise.
 *  2. Sinon, on match par gamme PIM (carterie, flyer, affiche…), puis par
 *     kind Clariprint (leaflet, folded, book), puis fallback generique.
 *  3. Selection deterministe (hash du nom produit) pour que chaque produit
 *     garde la meme image a chaque re-render.
 *
 * Les IDs Unsplash listes ici ont ete HTTP-verifies (code 200). Si l'un
 * d'eux tombe, le composant retombe sur le ProductMockup SVG via
 * l'`onError` du <img>.
 */

const UNSPLASH_BASE = 'https://images.unsplash.com/photo-';
const IMG_PARAMS = '?auto=format&fit=crop&w=800&h=450&q=80';

// Pools d'IDs Unsplash verifies par categorie print.
const IMAGE_POOLS = {
  // Cartes de visite, invitations, faire-parts — petit format premium
  carterie: [
    '1572044162444-ad60f128bdea', // piles de cartes de visite
    '1521791136064-7986c2920216', // papeterie impression
    '1517153295259-74eb0b416cee', // stationery / wedding
    '1543589077-47d81606c1bf',    // petit livret ouvert
  ],
  // Flyers, tracts, feuilles volantes
  flyer: [
    '1586953208448-b95a79798f07', // flyer design
    '1611532736597-de2d4265fba3', // flyers stacked
    '1509909756405-be0199881695', // paper workspace
    '1481627834876-b7833e8f5570', // printed paper
  ],
  // Affiches, posters grand format
  affiche: [
    '1501504905252-473c47e087f8', // wall / poster
    '1600096194534-95cf5ece04cf', // letterpress
    '1533035353720-f1c6a75cd8ab', // imprimerie traditionnelle
    '1565608438257-fac3c27beb36', // print shop
  ],
  // Brochures, catalogues, livrets, magazines
  brochure: [
    '1524799526615-766a9833dec0', // magazine ouvert
    '1567427018141-0584cfcbf1b8', // pile de livres
    '1465929639680-64ee080eb3ed', // books
    '1571498664957-fde285d79857', // magazine
    '1504384764586-bb4cdc1707b0', // book
    '1457369804613-52c61a468e7d', // open book
  ],
  // Depliants, plaquettes pliees
  depliant: [
    '1507842217343-583bb7270b66', // printed material
    '1481627834876-b7833e8f5570', // plied paper
    '1586953208448-b95a79798f07', // folded flyer
  ],
  // Enveloppes, papeterie
  enveloppe: [
    '1554224155-6726b3ff858f', // envelope
    '1521791136064-7986c2920216', // stationery
  ],
  // Pool generique print (fallback global)
  generic: [
    '1600096194534-95cf5ece04cf',
    '1533035353720-f1c6a75cd8ab',
    '1509909756405-be0199881695',
    '1481627834876-b7833e8f5570',
  ],
};

type PoolKey = keyof typeof IMAGE_POOLS;

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return Math.abs(h);
}

// Resout une pool depuis la gamme PIM (prioritaire) ou le kind Clariprint.
function resolvePool(gammeSlug?: string, kind?: string, productName?: string): PoolKey {
  const hay = `${gammeSlug ?? ''} ${kind ?? ''} ${productName ?? ''}`.toLowerCase();

  if (/carte[_\s-]?visite|carterie|carte[_\s-]?voeux|carte[_\s-]?correspondance/.test(hay)) {
    return 'carterie';
  }
  if (/affiche|poster|kakemono|roll.?up/.test(hay)) {
    return 'affiche';
  }
  if (/depliant|d[eé]pliant|folded|pli[eé]/.test(hay)) {
    return 'depliant';
  }
  if (/brochure|catalogue|livret|magazine|book/.test(hay)) {
    return 'brochure';
  }
  if (/enveloppe|envelope/.test(hay)) {
    return 'enveloppe';
  }
  if (/flyer|tract|leaflet/.test(hay)) {
    return 'flyer';
  }

  // Match par kind Clariprint en fallback
  const k = (kind ?? '').toLowerCase();
  if (k === 'folded') return 'depliant';
  if (k === 'book' || k === 'cover' || k === 'section') return 'brochure';
  if (k === 'leaflet') return 'flyer';

  return 'generic';
}

/**
 * Resout l'URL d'image pour un produit.
 * Retourne null si le produit n'a pas de mapping (declencher le fallback
 * mockup SVG cote composant).
 */
export function resolveProductImage(input: {
  name: string;
  id?: string;
  image_url?: string;
  gammeSlug?: string;
  kind?: string;
}): string | null {
  // 1. Image custom prime
  if (input.image_url && input.image_url.trim()) {
    return input.image_url;
  }

  // 2. Mapping thematique print
  const pool = resolvePool(input.gammeSlug, input.kind, input.name);
  const candidates = IMAGE_POOLS[pool];
  if (!candidates || candidates.length === 0) return null;

  const seed = hash(`${input.name}-${input.id ?? ''}`);
  const id = candidates[seed % candidates.length];
  return `${UNSPLASH_BASE}${id}${IMG_PARAMS}`;
}
