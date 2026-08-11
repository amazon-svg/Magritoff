/**
 * Zones monetaires du PRIX MARCHE — arbitrage Arnaud du 2026-08-10.
 *
 * ─── La decision ───────────────────────────────────────────────────────────
 *
 * « Il verra un prix marche relevant d imprimeurs ayant la MEME MONNAIE que
 *   lui. Autrement dit, nous livrerons des prix marches PAR ZONE MONETAIRE,
 *   et nous reserverons le droit de rendre un prix marche d une monnaie X
 *   accessible dans une zone Y. »
 *
 * Consequences structurantes :
 *
 *  1. **Une zone par devise.** Le prix marche servi a un imprimeur est
 *     calibre sur les prix d imprimeurs travaillant dans SA devise. Il n est
 *     jamais converti : convertir supposerait un taux de change, hors
 *     perimetre V1 (invariant #4 du plan multi-devise).
 *
 *  2. **Pas de zone = pas de prix marche.** Une devise sans zone calibree ne
 *     recoit AUCUNE estimation — l ecran affiche « Prix sur demande ». C est
 *     volontaire : mieux vaut pas de prix qu un prix faux. C est precisement
 *     le defaut que cet arbitrage corrige — avant lui, un imprimeur en
 *     dollars recevait une valeur calibree en euros, simplement relibellee.
 *
 *  3. **L ouverture inter-zones est un DROIT RESERVE, pas un comportement
 *     actif.** « Les pays en € pourront sans doute acceder au prix marche de
 *     la zone $ ». La structure le permet (`foreignZoneAccess`), rien ne
 *     l active aujourd hui : ouvrir une zone a une autre est une decision
 *     commerciale, elle se prendra zone par zone.
 *
 * ─── Statut des calibrations ───────────────────────────────────────────────
 *
 * Aucune zone ne repose aujourd hui sur des donnees d imprimeurs reelles :
 *  - la zone EUR porte l heuristique historique (decision Arnaud 2026-05-09),
 *    en attendant le « panel Magrit » (agregat anonymise des parcs Pro
 *    souscrits, roadmap V2+) ;
 *  - la zone USD est DECLAREE mais NON CALIBREE : les prix d imprimeurs en
 *    dollars n ont pas encore ete collectes. Elle ne sert donc rien.
 *
 * Le champ `status` dit lequel des trois cas s applique, et il est expose a
 * l appelant : personne ne doit pouvoir prendre une heuristique pour un
 * releve de marche.
 */

import { DEFAULT_CURRENCY, type CurrencyCode } from './currency';

/**
 * Familles de produits sur lesquelles la calibration porte.
 *
 * La FORME de l heuristique (degressivite par volume, majoration grammage,
 * verso, pelliculage) est une structure de cout de production : elle ne
 * depend pas de la devise et reste commune a toutes les zones. Seuls les
 * NIVEAUX de prix sont propres a une zone.
 */
export type MarketPriceFamily =
  | 'carte_visite'
  | 'flyer'
  | 'brochure'
  | 'affiche'
  | 'depliant'
  | 'etiquette'
  | 'kakemono'
  | 'packaging'
  | 'default';

export type MarketPriceZoneStatus =
  /** Heuristique interne, pas un releve de marche. */
  | 'heuristique'
  /** Agregat du panel Magrit — donnees d imprimeurs reelles. */
  | 'panel'
  /** Zone declaree, donnees pas encore collectees : ne sert rien. */
  | 'a_calibrer';

export interface MarketPriceZone {
  /** Devise de la zone, ISO 4217. */
  currency: CurrencyCode;
  status: MarketPriceZoneStatus;
  /**
   * Prix de base par unite et par famille, LIBELLES DANS LA DEVISE DE LA ZONE.
   * `null` quand la zone n est pas calibree — elle ne sert alors aucun prix.
   */
  basePerUnit: Record<MarketPriceFamily, number> | null;
  /** Plancher : un prix marche non nul ne descend pas sous cette valeur. */
  floor: number;
  /**
   * DROIT RESERVE, inactif. Zones etrangeres dont le prix marche pourrait
   * etre rendu accessible aux imprimeurs de cette zone. Laisser vide tant
   * qu une ouverture n a pas ete decidee : un tableau non vide signifie que
   * l on accepte de servir un prix calibre dans une AUTRE devise.
   */
  foreignZoneAccess: CurrencyCode[];
}

/**
 * Zone EUR — heuristique historique (decision Arnaud 2026-05-09).
 *
 * Ces valeurs sont exactement celles qui vivaient en dur dans
 * `estimateMarketPriceHT()` avant l arbitrage du 2026-08-10. Elles n ont pas
 * ete retouchees : le present chantier les DEPLACE et les etiquette, il ne
 * les recalibre pas.
 */
const ZONE_EUR: MarketPriceZone = {
  currency: 'EUR',
  status: 'heuristique',
  basePerUnit: {
    carte_visite: 0.08,
    flyer: 0.12,
    brochure: 1.5,
    affiche: 5.0,
    depliant: 0.25,
    etiquette: 0.04,
    kakemono: 35.0,
    packaging: 0.6,
    default: 0.15,
  },
  floor: 1,
  foreignZoneAccess: [],
};

/**
 * Zone USD — DECLAREE, NON CALIBREE.
 *
 * L arbitrage fixe la cible : « defini en $ avec les prix des imprimeurs en
 * $ ». Ces prix n ont pas encore ete collectes. Poser ici des valeurs
 * inventees, ou les euros convertis, reproduirait exactement le defaut que
 * l arbitrage corrige — avec en plus l apparence de la legitimite.
 *
 * Consequence assumee : un imprimeur en dollars voit « Prix sur demande »
 * tant que Clariprint ne repond pas. C est un manque visible, donc traitable,
 * la ou un prix faux serait un manque invisible.
 *
 * 👉 Pour activer la zone : renseigner `basePerUnit` depuis un releve de prix
 *    d imprimeurs en dollars et passer `status` a 'panel'.
 */
const ZONE_USD: MarketPriceZone = {
  currency: 'USD',
  status: 'a_calibrer',
  basePerUnit: null,
  floor: 1,
  foreignZoneAccess: [],
};

/**
 * Registre des zones. Ajouter une devise = ajouter une entree calibree.
 *
 * Les devises absentes du registre (GBP, CHF, CAD, MAD, JPY aujourd hui)
 * n ont pas de zone : elles ne recoivent aucun prix marche.
 */
export const MARKET_PRICE_ZONES: Readonly<Record<string, MarketPriceZone>> = {
  EUR: ZONE_EUR,
  USD: ZONE_USD,
};

/**
 * Zone servant le prix marche pour une devise donnee.
 *
 * Retourne `null` quand aucune zone ne peut servir un prix honnete :
 *  - devise absente du registre ;
 *  - zone presente mais pas encore calibree (`basePerUnit === null`).
 *
 * L appelant doit traiter `null` comme « pas de prix marche disponible », pas
 * comme une erreur : c est un etat normal et attendu du systeme.
 *
 * L ouverture inter-zones (`foreignZoneAccess`) est evaluee ici, ce qui rend
 * l activation future triviale — et surtout tracable en un seul endroit.
 */
export function resolveMarketPriceZone(
  currency: CurrencyCode = DEFAULT_CURRENCY,
): MarketPriceZone | null {
  const own = MARKET_PRICE_ZONES[currency];
  if (own?.basePerUnit) return own;

  // Droit reserve : si la zone de l imprimeur declare accepter une zone
  // etrangere, on sert celle-ci. Inactif tant que `foreignZoneAccess` est
  // vide partout — ce qui est le cas aujourd hui, volontairement.
  for (const foreign of own?.foreignZoneAccess ?? []) {
    const zone = MARKET_PRICE_ZONES[foreign];
    if (zone?.basePerUnit) return zone;
  }

  return null;
}

/**
 * Famille de produit deduite de son nom.
 *
 * Extrait tel quel de l ancienne cascade de `estimateMarketPriceHT()`, sans
 * changement de comportement : meme ordre de test, memes mots-cles. Sorti
 * pour que la reconnaissance de famille (independante de la devise) cesse
 * d etre melangee aux niveaux de prix (propres a une zone).
 */
export function resolveMarketPriceFamily(name: string): MarketPriceFamily {
  const n = name.toLowerCase();
  if (n.includes('carte') && n.includes('visite')) return 'carte_visite';
  if (n.includes('flyer') || n.includes('tract')) return 'flyer';
  if (n.includes('brochure') || n.includes('catalogue')) return 'brochure';
  if (n.includes('affiche') || n.includes('poster')) return 'affiche';
  if (n.includes('depliant') || n.includes('dépliant')) return 'depliant';
  if (n.includes('etiquette') || n.includes('étiquette')) return 'etiquette';
  if (n.includes('kakemono') || n.includes('roll-up')) return 'kakemono';
  if (n.includes('packaging') || n.includes('boite')) return 'packaging';
  return 'default';
}
