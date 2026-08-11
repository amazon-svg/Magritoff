/**
 * Parc machine — metadonnees d ECRAN et acces au domaine.
 *
 * Module issu de la seance RP#070826 (Expert Solutions x AGE Dvt.) :
 *   BK-14 wizard guide par type · BK-15 deux parcours comparatifs · BK-16
 *   selection par facettes · BK-17 massicot obligatoire · BK-09/10
 *   qualification et sous-traitance · BK-18 fournisseurs · BK-19 encres ·
 *   BK-22 modele de cout · BK-27 machine inactive.
 *
 * ─── CE QUI A CHANGE LE 2026-08-11 ─────────────────────────────────────────
 *
 * Ce fichier portait DEUX choses qui n avaient rien a y faire :
 *   - le referentiel de machines et les listes de fournisseurs, figes dans le
 *     code du navigateur — ils vivent desormais en base et se lisent par
 *     l API (`GET /machine-library`, `GET /suppliers`) ;
 *   - la persistance des parcs en `localStorage` — les parcs vivent en base,
 *     isoles par RLS, et ne s atteignent que par l API.
 *
 * Ce qui RESTE ici est du materiau d ecran, pas de la donnee :
 *   - `MACHINE_TYPES` : le deroule du wizard, son ordre et ses questions.
 *     C est le script d un entretien, arrete en seance — il ne se parametre
 *     pas depuis la base.
 *   - `PRICE_PARAMS` : quels reglages exposer par type de machine, avec quel
 *     libelle et quelle unite. Les VALEURS par modele, elles, viennent du
 *     referentiel serveur (`priceDefaults`).
 *   - les valeurs proposees par defaut a la saisie (BK-22, BK-19).
 *
 * Les types du domaine ne sont plus definis ici : ils viennent du CONTRAT
 * (`src/server/park/contract.ts`), partage avec le serveur. Une seule
 * definition du parc, un seul `parkIsCalculable`.
 *
 * Contrat : `docs/API_PARC_MACHINE.md`.
 */

import { httpParkApi } from '../../../../server/park/ParkApiAdapter';
import {
  parkIsCalculable as parkIsCalculableRule,
  type LibraryMachine,
  type MachinePark,
  type MachineParkInput,
  type MachineTypeKey,
  type ParkMachine,
  type ParkMachineInput,
  type SupplierKind,
  type SupplierRef,
} from '../../../../server/park/contract';

// Re-export : les ecrans continuent d importer leurs types depuis ce module,
// sans avoir a connaitre le chemin du contrat.
export type {
  LibraryMachine, MachinePark, MachineParkInput, MachineTypeKey,
  ParkMachine, ParkMachineInput, SupplierKind, SupplierRef,
};

export interface MachineTypeDef {
  key: MachineTypeKey;
  /** Libelle du type. */
  label: string;
  /** Question binaire du deroule guide (parcours A). */
  question: string;
  /** Le calcul ne peut pas sortir de prix sans ce poste (BK-17). */
  mandatory?: boolean;
  /** Absence possible mais suspecte : demander confirmation (BK-17). */
  confirmIfEmpty?: string;
}

/** Ordre du deroule guide — celui de la seance RP#070826 §7.1. */
export const MACHINE_TYPES: MachineTypeDef[] = [
  { key: 'offset', label: 'Presses offset', question: 'Avez-vous des presses offset ?' },
  { key: 'numerique', label: 'Presses numériques', question: 'Avez-vous des presses numériques ?' },
  { key: 'grand_format', label: 'Grand format', question: 'Avez-vous des imprimantes grand format ?' },
  { key: 'roto', label: 'Rotatives', question: 'Avez-vous des rotatives ?' },
  { key: 'decoupe', label: 'Découpe', question: 'Avez-vous des machines de découpe ?' },
  {
    key: 'pliage',
    label: 'Pliage',
    question: 'Avez-vous des plieuses ?',
    confirmIfEmpty:
      "Êtes-vous sûr de ne pas avoir de plieuse ? Sans plieuse, aucun produit plié (dépliant, brochure) ne pourra être calculé. Cas légitime : presse numérique avec groupe de pliage intégré en ligne.",
  },
  {
    key: 'massicot',
    label: 'Massicotage',
    question: 'Avez-vous un massicot ?',
    mandatory: true,
  },
  { key: 'finition', label: 'Machines de finition', question: 'Avez-vous des machines de finition ?' },
];


// ─── Parametres de prix par type (demande Arnaud point 3) ────────────────────
// Seules les caracteristiques qui PESENT SUR LE PRIX du produit imprime sont
// exposees. Valeurs par defaut indicatives — l utilisateur ajuste les siennes
// (meme logique que BK-22 : defaut propose, saisie facultative).

export interface PriceParamDef {
  key: string;
  label: string;
  /**
   * Unite PHYSIQUE, sans devise (« feuilles/h », « min », « m²/h »).
   * Absente quand le parametre est monetaire : c est alors `moneyPer` qui
   * porte le denominateur, et le symbole vient de la devise de l imprimeur.
   */
  unit?: string;
  /**
   * Denominateur d une unite MONETAIRE — « plaque » rend « €/plaque » en zone
   * euro, « $/plaque » chez un imprimeur en dollars.
   *
   * Multi-devise (2026-08-11) : la bibliotheque de machines est un
   * REFERENTIEL PARTAGE entre imprimeurs. Y ecrire un symbole monetaire
   * reintroduit exactement le defaut que la tranche 1 a supprime — le
   * referentiel n a pas de devise, seul l affichage en a une. Resolution :
   * `priceParamUnit(p, currency)`.
   */
  moneyPer?: string;
  /** Valeur par defaut du TYPE (surchargee par machine via priceDefaults). */
  def: number;
  /** Pas de saisie. */
  step?: number;
}

export const PRICE_PARAMS: Record<MachineTypeKey, PriceParamDef[]> = {
  offset: [
    { key: 'speed', label: 'Vitesse de tirage', unit: 'feuilles/h', def: 15000, step: 500 },
    { key: 'makeReadyMin', label: 'Temps de calage', unit: 'min', def: 20 },
    { key: 'makeReadyWaste', label: 'Gâche de calage', unit: 'feuilles', def: 250, step: 50 },
    { key: 'plateCost', label: 'Coût plaque', moneyPer: 'plaque', def: 8, step: 0.5 },
  ],
  numerique: [
    { key: 'clickColor', label: 'Coût clic couleur', moneyPer: 'face A4', def: 0.045, step: 0.005 },
    { key: 'clickBW', label: 'Coût clic noir', moneyPer: 'face A4', def: 0.012, step: 0.002 },
    { key: 'speedPpm', label: 'Vitesse', unit: 'pages A4/min', def: 100, step: 5 },
  ],
  grand_format: [
    { key: 'inkCostM2', label: 'Coût encre', moneyPer: 'm²', def: 1.8, step: 0.1 },
    { key: 'speedM2h', label: 'Vitesse', unit: 'm²/h', def: 25, step: 5 },
  ],
  roto: [
    { key: 'speed', label: 'Vitesse', unit: 'ex/h', def: 40000, step: 1000 },
    { key: 'makeReadyMin', label: 'Temps de calage', unit: 'min', def: 45 },
    { key: 'makeReadyWaste', label: 'Gâche de calage', unit: 'm de bande', def: 500, step: 50 },
    { key: 'plateCost', label: 'Coût plaque', moneyPer: 'plaque', def: 8, step: 0.5 },
  ],
  decoupe: [
    { key: 'dieCost', label: 'Coût forme de découpe', moneyPer: 'forme', def: 350, step: 10 },
    { key: 'makeReadyMin', label: 'Temps de calage', unit: 'min', def: 25 },
    { key: 'speed', label: 'Cadence', unit: 'feuilles/h', def: 5000, step: 250 },
  ],
  pliage: [
    { key: 'speed', label: 'Cadence', unit: 'feuilles/h', def: 8000, step: 500 },
    { key: 'makeReadyMin', label: 'Temps de calage', unit: 'min', def: 15 },
  ],
  massicot: [
    { key: 'liftsPerHour', label: 'Cadence', unit: 'levées/h', def: 300, step: 10 },
  ],
  finition: [
    { key: 'speed', label: 'Cadence', unit: 'ex/h', def: 4000, step: 250 },
    { key: 'makeReadyMin', label: 'Temps de calage', unit: 'min', def: 20 },
    { key: 'consumableCost', label: 'Consommable (colle, fil, film…)', moneyPer: 'ex', def: 0.05, step: 0.01 },
  ],
};

/**
 * Unite affichable d un parametre de prix, devise resolue.
 *
 * `formatCurrencyPerUnit` est importe paresseusement par l appelant pour que
 * ce fichier reste sans dependance React et testable tel quel.
 */
export function priceParamUnit(
  p: Pick<PriceParamDef, 'unit' | 'moneyPer'>,
  currencySymbolPer: (unit: string) => string,
): string {
  if (p.moneyPer) return currencySymbolPer(p.moneyPer);
  return p.unit ?? '';
}

// ─── Valeurs proposees par defaut a la saisie (BK-22, BK-19) ────────────────
// Proposees, jamais imposees : l imprimeur ajuste a sa realite.

export const DEFAULT_LABOR_RATE = 45;
export const DEFAULT_ENERGY_RATE = 0.18;

export const DEFAULT_INKS: MachinePark['inks'] = [
  { type: 'Encre offset process (CMJN)', costPerKg: 6.5 },
  { type: 'Encre UV', costPerKg: 14 },
  { type: 'Toner numérique', costPerKg: 38 },
  { type: 'Encre grand format (latex/éco-solvant)', costPerKg: 55 },
];

// ─── Valeurs effectives des parametres de prix ───────────────────────────────

/**
 * Valeurs de prix effectives d une machine : defauts du TYPE, surcharges du
 * MODELE, puis saisies de l imprimeur — dans cet ordre.
 *
 * La bibliotheque est passee en argument et non lue depuis un tableau global :
 * elle vient maintenant du serveur, donc elle est chargee par l ecran.
 */
export function machinePriceValues(
  m: Pick<ParkMachine, 'type' | 'libraryId' | 'params'>,
  library: ReadonlyArray<LibraryMachine>,
): Record<string, number> {
  const lib = m.libraryId ? library.find((x) => x.id === m.libraryId) : undefined;
  const out: Record<string, number> = {};
  for (const p of PRICE_PARAMS[m.type] ?? []) {
    out[p.key] = m.params?.[p.key] ?? lib?.priceDefaults?.[p.key] ?? p.def;
  }
  return out;
}

// ─── Acces au domaine — les cinq fonctions historiques ───────────────────────
//
// Memes noms, memes parametres qu avant la bascule. Ce qui change, et ne
// pouvait pas ne pas changer : elles rendent des PROMESSES. `localStorage`
// repondait dans le meme tour de boucle ; une API traverse le reseau, et
// aucune signature ne peut faire semblant du contraire.
//
// Elles ne contiennent aucune logique : leur role est de nommer, dans le
// vocabulaire des ecrans, ce que l adaptateur expose dans celui du contrat.

/** Tous les parcs de l espace. Un espace sans parc rend `[]`, pas une erreur. */
export function loadParks(tenantId: string): Promise<MachinePark[]> {
  return httpParkApi.listParks(tenantId);
}

/** Remplace TOUTE la collection de l espace (reprise en masse, import). */
export function saveParks(tenantId: string, parks: MachineParkInput[]): Promise<MachinePark[]> {
  return httpParkApi.replaceParks(tenantId, parks);
}

/** Cree le parc si `park.id` est absent, le remplace integralement sinon. */
export function upsertPark(tenantId: string, park: MachineParkInput): Promise<MachinePark> {
  return httpParkApi.upsertPark(tenantId, park);
}

/** Idempotent : supprimer un parc deja supprime reussit. */
export function deletePark(tenantId: string, parkId: string): Promise<void> {
  return httpParkApi.deletePark(tenantId, parkId);
}

/**
 * Le parc permet-il de sortir un prix ? (BK-17 : massicot obligatoire.)
 *
 * Reste SYNCHRONE et locale a dessein. Le serveur renvoie deja `calculable`
 * sur tout parc enregistre et fait foi ; mais le wizard doit pouvoir se
 * prononcer sur un parc EN COURS de constitution, qui n existe encore nulle
 * part. Une seule implementation, celle du contrat, sert les deux cas.
 */
export const parkIsCalculable = parkIsCalculableRule;

// ─── Referentiels — lus au serveur ───────────────────────────────────────────

/** Referentiel de machines, partage entre imprimeurs (lecture seule). */
export function loadMachineLibrary(type?: MachineTypeKey): Promise<LibraryMachine[]> {
  return httpParkApi.listMachineLibrary(type);
}

/** Referentiel Fournisseur unifie — BK-07. */
export function loadSuppliers(tenantId: string, kind?: SupplierKind): Promise<SupplierRef[]> {
  return httpParkApi.listSuppliers(tenantId, kind);
}
