/**
 * REFONTE-UX (2026-08-08) — Parc machine : types, bibliotheque et persistance.
 *
 * Module issu de la session RP#070826 (Expert Solutions x AGE Dvt.) :
 *   - BK-14 wizard guide par type de machine
 *   - BK-15 deux parcours comparatifs (arbitrage au nombre de clics)
 *   - BK-16 selection par tags / facettes, logique panier (pas d arborescence)
 *   - BK-17 validations bloquantes (massicot obligatoire, confirmation plieuse)
 *   - BK-09/10 qualification interne / externe NON bloquante + sous-traitant
 *     par autocompletion
 *   - BK-18 ecrans papier et transport separes
 *   - BK-19 champs encres
 *   - BK-22 modele de cout (taux horaire avec valeur par defaut)
 *
 * V1 = maquette fonctionnelle : bibliotheque embarquee (mock) et persistance
 * locale par tenant. Le stockage definitif rejoindra le module Clariprint Data
 * (cote Expert Solutions) une fois l architecture API-first en place — R1/R2
 * du jeu d instructions RP#070826.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type MachineTypeKey =
  | 'offset'
  | 'numerique'
  | 'grand_format'
  | 'roto'
  | 'decoupe'
  | 'pliage'
  | 'massicot'
  | 'finition';

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

export interface LibraryMachine {
  id: string;
  type: MachineTypeKey;
  /** Sous-famille du type — sections du selecteur (demande Arnaud point 2,
   * 2026-08-08). Ex. offset : « Demi-format (52×74) ». */
  family: string;
  /** Rang de popularite DANS sa famille — 1 = la plus vendue. Le selecteur
   * trie sur ce rang (demande Arnaud point 1). */
  rank: number;
  brand: string;
  model: string;
  /** Format papier max (presses) ou laize (grand format / roto). */
  format: string;
  /** Nombre de groupes / couleurs (presses). */
  colors?: number;
  /** Presence d un groupe vernis. */
  varnish?: boolean;
  /** Valeurs par defaut propres au modele pour les parametres de prix
   * (surchargent les defauts du type). Indicatives, ajustables. */
  priceDefaults?: Record<string, number>;
}

// ─── Parametres de prix par type (demande Arnaud point 3) ────────────────────
// Seules les caracteristiques qui PESENT SUR LE PRIX du produit imprime sont
// exposees. Valeurs par defaut indicatives — l utilisateur ajuste les siennes
// (meme logique que BK-22 : defaut propose, saisie facultative).

export interface PriceParamDef {
  key: string;
  label: string;
  unit: string;
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
    { key: 'plateCost', label: 'Coût plaque', unit: '€/plaque', def: 8, step: 0.5 },
  ],
  numerique: [
    { key: 'clickColor', label: 'Coût clic couleur', unit: '€/face A4', def: 0.045, step: 0.005 },
    { key: 'clickBW', label: 'Coût clic noir', unit: '€/face A4', def: 0.012, step: 0.002 },
    { key: 'speedPpm', label: 'Vitesse', unit: 'pages A4/min', def: 100, step: 5 },
  ],
  grand_format: [
    { key: 'inkCostM2', label: 'Coût encre', unit: '€/m²', def: 1.8, step: 0.1 },
    { key: 'speedM2h', label: 'Vitesse', unit: 'm²/h', def: 25, step: 5 },
  ],
  roto: [
    { key: 'speed', label: 'Vitesse', unit: 'ex/h', def: 40000, step: 1000 },
    { key: 'makeReadyMin', label: 'Temps de calage', unit: 'min', def: 45 },
    { key: 'makeReadyWaste', label: 'Gâche de calage', unit: 'm de bande', def: 500, step: 50 },
    { key: 'plateCost', label: 'Coût plaque', unit: '€/plaque', def: 8, step: 0.5 },
  ],
  decoupe: [
    { key: 'dieCost', label: 'Coût forme de découpe', unit: '€/forme', def: 350, step: 10 },
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
    { key: 'consumableCost', label: 'Consommable (colle, fil, film…)', unit: '€/ex', def: 0.05, step: 0.01 },
  ],
};

/** Valeurs de prix effectives d une machine de parc : defauts du type,
 * surcharges du modele, puis saisies utilisateur. */
export function machinePriceValues(m: Pick<ParkMachine, 'type' | 'libraryId' | 'params'>): Record<string, number> {
  const lib = MACHINE_LIBRARY.find((x) => x.id === m.libraryId);
  const out: Record<string, number> = {};
  for (const p of PRICE_PARAMS[m.type] ?? []) {
    out[p.key] = m.params?.[p.key] ?? lib?.priceDefaults?.[p.key] ?? p.def;
  }
  return out;
}

export interface ParkMachine {
  /** id unique dans le parc (libraryId + suffixe si doublon). */
  id: string;
  libraryId: string;
  type: MachineTypeKey;
  brand: string;
  model: string;
  format: string;
  colors?: number;
  varnish?: boolean;
  /**
   * Qualification interne / externe — DISPONIBLE mais NON OBLIGATOIRE
   * (BK-09, arbitrage seance : priorite au setup rapide, affinage ensuite).
   * null = non renseignee.
   */
  location: 'interne' | 'externe' | null;
  /** Nom du sous-traitant (saisie libre + autocompletion, BK-10). */
  subcontractor?: string;
  /** Cout de transport associe a l externalisation, zero admis (BK-13). */
  transportCost?: number;
  /** Couts fixes d externalisation, distincts du transport (BK-13). */
  fixedCost?: number;
  /** Taux horaire propre a la machine — vide = taux du parc (BK-22). */
  hourlyRate?: number;
  /** false = exclue des calculs servis (esquisse draft BK-27). Defaut true. */
  active?: boolean;
  /** Saisies utilisateur des parametres de prix (cf. PRICE_PARAMS) —
   * absent = defauts type/modele (demande Arnaud point 3, 2026-08-08). */
  params?: Record<string, number>;
}

export interface MachinePark {
  /** Point 8 (retour Arnaud 2026-08-08) : un client peut avoir PLUSIEURS
   * parcs — chaque parc a une identite propre. */
  id: string;
  name: string;
  machines: ParkMachine[];
  paperSuppliers: string[];
  transportSuppliers: string[];
  inks: { type: string; costPerKg: number }[];
  /** Taux horaire main d oeuvre, saisi (defaut propose 45). BK-22. */
  laborRate: number;
  /** Cout kWh — valeur par defaut non saisie (BK-22). */
  energyRate: number;
  /** Parcours utilise pour constituer le parc (arbitrage BK-15). */
  wizardVariant?: 'A' | 'B';
  /** Nombre de clics du parcours — critere d arbitrage BK-15. */
  wizardClicks?: number;
  completedAt?: string;
}

export const DEFAULT_LABOR_RATE = 45;
export const DEFAULT_ENERGY_RATE = 0.18;

export const DEFAULT_INKS: MachinePark['inks'] = [
  { type: 'Encre offset process (CMJN)', costPerKg: 6.5 },
  { type: 'Encre UV', costPerKg: 14 },
  { type: 'Toner numérique', costPerKg: 38 },
  { type: 'Encre grand format (latex/éco-solvant)', costPerKg: 55 },
];

/** Fournisseurs papier proposes — inclut le stock local (BK-08 : l imprimeur
 * est lui-meme un fournisseur de papier, prix a la feuille). */
export const PAPER_SUPPLIERS = [
  'Mon stock papier (prix à la feuille)',
  'Antalis',
  'Inapa',
  'Papyrus',
  'Torraspapel',
  'Fedrigoni',
];

export const TRANSPORT_SUPPLIERS = [
  'Mes livraisons (véhicule interne)',
  'Chronopost',
  'Colissimo',
  'DPD',
  'GLS',
  'Transporteur régional (grille négociée)',
];

/** Referentiel de sous-traitants pour l autocompletion (BK-10 — mock du
 * referentiel fournisseurs/imprimeurs ; en production : table Fournisseur
 * unifiee BK-07). */
export const KNOWN_SUBCONTRACTORS = [
  'Imprimerie Laville (Bordeaux)',
  'Reliure Occitane (Toulouse)',
  'Façonnage Atlantique (Nantes)',
  'Brochage Express (Lyon)',
  'Découpe Précision (Lille)',
];

// ─── Bibliotheque de machines (demande Arnaud points 1-2, 2026-08-08) ────────
// Les modeles LES PLUS VENDUS de chaque categorie d abord (rank 1 = best
// seller de sa famille), classes par sous-familles pour un choix lisible.
// Profondeur : modeles recents ET historiques (une machine de 9 ans est
// toujours en production — seance RP#070826 §7.3). Specs et defauts de prix
// INDICATIFS, ajustables machine par machine. Sourcing reel : BK-WM040826-02.

export const MACHINE_LIBRARY: LibraryMachine[] = [
  // ── OFFSET · Petit format (35×52 — B3) ─────────────────────────────────────
  { id: 'off-hd-sm52-4', type: 'offset', family: 'Petit format (35×52)', rank: 1, brand: 'Heidelberg', model: 'Speedmaster SM 52-4', format: '37×52', colors: 4, priceDefaults: { speed: 15000, makeReadyMin: 15, makeReadyWaste: 150, plateCost: 6 } },
  { id: 'off-hd-sm52-5l', type: 'offset', family: 'Petit format (35×52)', rank: 2, brand: 'Heidelberg', model: 'Speedmaster SM 52-5+L', format: '37×52', colors: 5, varnish: true, priceDefaults: { speed: 15000, makeReadyMin: 18, makeReadyWaste: 150, plateCost: 6 } },
  { id: 'off-rmgt-525', type: 'offset', family: 'Petit format (35×52)', rank: 3, brand: 'RMGT (Ryobi)', model: '525 GX', format: '37×52', colors: 5, priceDefaults: { speed: 13000, makeReadyMin: 18, makeReadyWaste: 150, plateCost: 6 } },
  // ── OFFSET · Demi-format (52×74 — B2) ──────────────────────────────────────
  { id: 'off-hd-xl75-5l', type: 'offset', family: 'Demi-format (52×74)', rank: 1, brand: 'Heidelberg', model: 'Speedmaster XL 75-5+L', format: '53×75', colors: 5, varnish: true, priceDefaults: { speed: 16500, makeReadyMin: 20, makeReadyWaste: 200, plateCost: 8 } },
  { id: 'off-hd-sx74-4', type: 'offset', family: 'Demi-format (52×74)', rank: 2, brand: 'Heidelberg', model: 'Speedmaster SX 74-4', format: '53×74', colors: 4, priceDefaults: { speed: 15000, makeReadyMin: 20, makeReadyWaste: 200, plateCost: 8 } },
  { id: 'off-km-g529', type: 'offset', family: 'Demi-format (52×74)', rank: 3, brand: 'Komori', model: 'Lithrone G529+C', format: '53×75', colors: 5, varnish: true, priceDefaults: { speed: 16500, makeReadyMin: 20, makeReadyWaste: 200, plateCost: 8 } },
  { id: 'off-kba-76', type: 'offset', family: 'Demi-format (52×74)', rank: 4, brand: 'Koenig & Bauer', model: 'Rapida 76-5+L', format: '53×76', colors: 5, varnish: true, priceDefaults: { speed: 16000, makeReadyMin: 20, makeReadyWaste: 200, plateCost: 8 } },
  // ── OFFSET · Grand format feuilles (70×102+ — B1) ──────────────────────────
  { id: 'off-hd-xl106-8p', type: 'offset', family: 'Grand format feuilles (70×102+)', rank: 1, brand: 'Heidelberg', model: 'Speedmaster XL 106-8-P', format: '75×106', colors: 8, priceDefaults: { speed: 18000, makeReadyMin: 25, makeReadyWaste: 300, plateCost: 12 } },
  { id: 'off-hd-cx102-6l', type: 'offset', family: 'Grand format feuilles (70×102+)', rank: 2, brand: 'Heidelberg', model: 'Speedmaster CX 102-6+L', format: '72×102', colors: 6, varnish: true, priceDefaults: { speed: 16500, makeReadyMin: 25, makeReadyWaste: 300, plateCost: 12 } },
  { id: 'off-km-gl840', type: 'offset', family: 'Grand format feuilles (70×102+)', rank: 3, brand: 'Komori', model: 'Lithrone GL840+C', format: '75×102', colors: 8, varnish: true, priceDefaults: { speed: 16500, makeReadyMin: 25, makeReadyWaste: 300, plateCost: 12 } },
  { id: 'off-kba-106-6l', type: 'offset', family: 'Grand format feuilles (70×102+)', rank: 4, brand: 'Koenig & Bauer', model: 'Rapida 106-6+L', format: '74×106', colors: 6, varnish: true, priceDefaults: { speed: 18000, makeReadyMin: 25, makeReadyWaste: 300, plateCost: 12 } },
  { id: 'off-mr-706', type: 'offset', family: 'Grand format feuilles (70×102+)', rank: 5, brand: 'manroland', model: 'Roland 706 LV', format: '74×104', colors: 6, varnish: true, priceDefaults: { speed: 16000, makeReadyMin: 28, makeReadyWaste: 300, plateCost: 12 } },
  { id: 'off-rmgt-920', type: 'offset', family: 'Grand format feuilles (70×102+)', rank: 6, brand: 'RMGT (Ryobi)', model: '920 ST-4', format: '65×92', colors: 4, priceDefaults: { speed: 15000, makeReadyMin: 22, makeReadyWaste: 250, plateCost: 10 } },
  // ── NUMERIQUE · Toner sec ──────────────────────────────────────────────────
  { id: 'num-xe-v4100', type: 'numerique', family: 'Toner sec', rank: 1, brand: 'Xerox', model: 'Versant 4100', format: '33×66', colors: 4, priceDefaults: { clickColor: 0.04, clickBW: 0.01, speedPpm: 100 } },
  { id: 'num-km-c14000', type: 'numerique', family: 'Toner sec', rank: 2, brand: 'Konica Minolta', model: 'AccurioPress C14000', format: '33×90', colors: 4, priceDefaults: { clickColor: 0.038, clickBW: 0.01, speedPpm: 140 } },
  { id: 'num-ca-v1350', type: 'numerique', family: 'Toner sec', rank: 3, brand: 'Canon', model: 'imagePRESS V1350', format: '33×74', colors: 4, priceDefaults: { clickColor: 0.038, clickBW: 0.01, speedPpm: 135 } },
  { id: 'num-ric-9500', type: 'numerique', family: 'Toner sec', rank: 4, brand: 'Ricoh', model: 'Pro C9500', format: '33×70', colors: 4, priceDefaults: { clickColor: 0.04, clickBW: 0.01, speedPpm: 135 } },
  { id: 'num-xe-iri', type: 'numerique', family: 'Toner sec', rank: 5, brand: 'Xerox', model: 'Iridesse (5e/6e couleur)', format: '33×66', colors: 6, varnish: true, priceDefaults: { clickColor: 0.055, clickBW: 0.012, speedPpm: 120 } },
  { id: 'num-km-c7100', type: 'numerique', family: 'Toner sec', rank: 6, brand: 'Konica Minolta', model: 'AccurioPress C7100', format: '33×49', colors: 4, priceDefaults: { clickColor: 0.042, clickBW: 0.011, speedPpm: 71 } },
  // ── NUMERIQUE · ElectroInk & jet d encre feuilles ──────────────────────────
  { id: 'num-hp-7k', type: 'numerique', family: "ElectroInk & jet d'encre", rank: 1, brand: 'HP Indigo', model: '7K Digital Press', format: '33×48', colors: 7, priceDefaults: { clickColor: 0.06, clickBW: 0.015, speedPpm: 120 } },
  { id: 'num-hp-100k', type: 'numerique', family: "ElectroInk & jet d'encre", rank: 2, brand: 'HP Indigo', model: '100K Digital Press', format: '35×51', colors: 7, priceDefaults: { clickColor: 0.05, clickBW: 0.013, speedPpm: 200 } },
  { id: 'num-hp-15k', type: 'numerique', family: "ElectroInk & jet d'encre", rank: 3, brand: 'HP Indigo', model: '15K Digital Press (B2)', format: '53×75', colors: 7, priceDefaults: { clickColor: 0.09, clickBW: 0.022, speedPpm: 115 } },
  { id: 'num-fu-jp750', type: 'numerique', family: "ElectroInk & jet d'encre", rank: 4, brand: 'Fujifilm', model: 'Jet Press 750S (B2 jet d’encre)', format: '53×75', colors: 4, priceDefaults: { clickColor: 0.1, clickBW: 0.025, speedPpm: 120 } },
  { id: 'num-ca-ix3200', type: 'numerique', family: "ElectroInk & jet d'encre", rank: 5, brand: 'Canon', model: 'varioPRINT iX3200', format: '32×48', colors: 4, priceDefaults: { clickColor: 0.035, clickBW: 0.009, speedPpm: 320 } },
  // ── GRAND FORMAT · Rouleau (roll-to-roll) ──────────────────────────────────
  { id: 'gf-hp-l800w', type: 'grand_format', family: 'Rouleau (roll-to-roll)', rank: 1, brand: 'HP', model: 'Latex 800 W', format: 'laize 162 cm', colors: 7, priceDefaults: { inkCostM2: 1.9, speedM2h: 36 } },
  { id: 'gf-ro-vg3', type: 'grand_format', family: 'Rouleau (roll-to-roll)', rank: 2, brand: 'Roland DG', model: 'TrueVIS VG3-640', format: 'laize 160 cm', colors: 8, priceDefaults: { inkCostM2: 1.6, speedM2h: 12 } },
  { id: 'gf-ep-s80600', type: 'grand_format', family: 'Rouleau (roll-to-roll)', rank: 3, brand: 'Epson', model: 'SureColor S80600', format: 'laize 162 cm', colors: 9, priceDefaults: { inkCostM2: 1.5, speedM2h: 12 } },
  { id: 'gf-mi-jv330', type: 'grand_format', family: 'Rouleau (roll-to-roll)', rank: 4, brand: 'Mimaki', model: 'JV330-160', format: 'laize 161 cm', colors: 8, priceDefaults: { inkCostM2: 1.5, speedM2h: 21 } },
  { id: 'gf-ca-colorado', type: 'grand_format', family: 'Rouleau (roll-to-roll)', rank: 5, brand: 'Canon', model: 'Colorado 1650 (UVgel)', format: 'laize 163 cm', colors: 4, priceDefaults: { inkCostM2: 1.2, speedM2h: 55 } },
  { id: 'gf-hp-l2700', type: 'grand_format', family: 'Rouleau (roll-to-roll)', rank: 6, brand: 'HP', model: 'Latex 2700', format: 'laize 320 cm', colors: 7, priceDefaults: { inkCostM2: 1.9, speedM2h: 77 } },
  // ── GRAND FORMAT · À plat (flatbed) & hybrides ─────────────────────────────
  { id: 'gf-sq-nyala', type: 'grand_format', family: 'À plat (flatbed) & hybrides', rank: 1, brand: 'swissQprint', model: 'Nyala 4', format: 'plateau 320×205 cm', colors: 6, varnish: true, priceDefaults: { inkCostM2: 2.2, speedM2h: 90 } },
  { id: 'gf-du-p5350', type: 'grand_format', family: 'À plat (flatbed) & hybrides', rank: 2, brand: 'Durst', model: 'P5 350', format: 'laize 350 cm', colors: 6, priceDefaults: { inkCostM2: 2.2, speedM2h: 150 } },
  { id: 'gf-ag-jeti', type: 'grand_format', family: 'À plat (flatbed) & hybrides', rank: 3, brand: 'Agfa', model: 'Jeti Tauro H3300', format: 'laize 330 cm', colors: 6, priceDefaults: { inkCostM2: 2.0, speedM2h: 230 } },
  // ── ROTATIVES · Offset bobine ──────────────────────────────────────────────
  { id: 'ro-mr-rotoman', type: 'roto', family: 'Offset bobine', rank: 1, brand: 'manroland', model: 'Rotoman N', format: 'laize 96,5 cm', colors: 4, priceDefaults: { speed: 65000, makeReadyMin: 45, makeReadyWaste: 800, plateCost: 10 } },
  { id: 'ro-goss-m600', type: 'roto', family: 'Offset bobine', rank: 2, brand: 'Goss', model: 'M600 Folia', format: 'laize 96 cm', colors: 4, priceDefaults: { speed: 50000, makeReadyMin: 45, makeReadyWaste: 800, plateCost: 10 } },
  { id: 'ro-km-38', type: 'roto', family: 'Offset bobine', rank: 3, brand: 'Komori', model: 'System 38S', format: 'laize 96,5 cm', colors: 4, priceDefaults: { speed: 50000, makeReadyMin: 45, makeReadyWaste: 800, plateCost: 10 } },
  // ── ROTATIVES · Jet d encre bobine ─────────────────────────────────────────
  { id: 'ro-hp-t250', type: 'roto', family: "Jet d'encre bobine", rank: 1, brand: 'HP', model: 'PageWide T250 HD', format: 'laize 56 cm', colors: 4, priceDefaults: { speed: 30000, makeReadyMin: 15, makeReadyWaste: 100, plateCost: 0 } },
  { id: 'ro-sc-jet520', type: 'roto', family: "Jet d'encre bobine", rank: 2, brand: 'Screen', model: 'Truepress Jet 520HD', format: 'laize 52 cm', colors: 4, priceDefaults: { speed: 25000, makeReadyMin: 15, makeReadyWaste: 100, plateCost: 0 } },
  { id: 'ro-ric-vc70000', type: 'roto', family: "Jet d'encre bobine", rank: 3, brand: 'Ricoh', model: 'Pro VC70000', format: 'laize 52 cm', colors: 4, priceDefaults: { speed: 28000, makeReadyMin: 15, makeReadyWaste: 100, plateCost: 0 } },
  // ── DECOUPE · Platines (formes de découpe) ─────────────────────────────────
  { id: 'de-bobst-nova106', type: 'decoupe', family: 'Platines (formes de découpe)', rank: 1, brand: 'Bobst', model: 'Novacut 106 E', format: '76×106', priceDefaults: { dieCost: 400, makeReadyMin: 25, speed: 6500 } },
  { id: 'de-hd-pro106', type: 'decoupe', family: 'Platines (formes de découpe)', rank: 2, brand: 'Heidelberg', model: 'Promatrix 106 CS', format: '76×106', priceDefaults: { dieCost: 400, makeReadyMin: 25, speed: 7700 } },
  { id: 'de-bobst-sp102', type: 'decoupe', family: 'Platines (formes de découpe)', rank: 3, brand: 'Bobst', model: 'SP 102-E (historique)', format: '72×102', priceDefaults: { dieCost: 350, makeReadyMin: 35, speed: 5000 } },
  // ── DECOUPE · Tables numériques (sans forme) ───────────────────────────────
  { id: 'de-zund-g3', type: 'decoupe', family: 'Tables numériques (sans forme)', rank: 1, brand: 'Zünd', model: 'G3 L-2500', format: 'table 180×250 cm', priceDefaults: { dieCost: 0, makeReadyMin: 5, speed: 300 } },
  { id: 'de-esko-c66', type: 'decoupe', family: 'Tables numériques (sans forme)', rank: 2, brand: 'Esko Kongsberg', model: 'C66', format: 'table 320×220 cm', priceDefaults: { dieCost: 0, makeReadyMin: 5, speed: 300 } },
  { id: 'de-highcon-b2', type: 'decoupe', family: 'Tables numériques (sans forme)', rank: 3, brand: 'Highcon', model: 'Beam 2 (laser)', format: '76×106', priceDefaults: { dieCost: 0, makeReadyMin: 10, speed: 5000 } },
  // ── PLIAGE ─────────────────────────────────────────────────────────────────
  { id: 'pl-stahl-th82', type: 'pliage', family: 'Plieuses', rank: 1, brand: 'Heidelberg Stahlfolder', model: 'TH 82-P', format: '82 cm', priceDefaults: { speed: 14000, makeReadyMin: 15 } },
  { id: 'pl-stahl-kh82', type: 'pliage', family: 'Plieuses', rank: 2, brand: 'Heidelberg Stahlfolder', model: 'KH 82', format: '82 cm', priceDefaults: { speed: 10000, makeReadyMin: 15 } },
  { id: 'pl-mbo-k80', type: 'pliage', family: 'Plieuses', rank: 3, brand: 'MBO', model: 'K80', format: '78 cm', priceDefaults: { speed: 10000, makeReadyMin: 15 } },
  { id: 'pl-mbo-k8rs', type: 'pliage', family: 'Plieuses', rank: 4, brand: 'MBO', model: 'K8 RS', format: '78 cm', priceDefaults: { speed: 12000, makeReadyMin: 15 } },
  { id: 'pl-horizon-afc746', type: 'pliage', family: 'Plieuses', rank: 5, brand: 'Horizon', model: 'AFC-746F', format: '74 cm', priceDefaults: { speed: 9000, makeReadyMin: 10 } },
  { id: 'pl-horizon-af406', type: 'pliage', family: 'Plieuses', rank: 6, brand: 'Horizon', model: 'AF-406 (petit format)', format: '40 cm', priceDefaults: { speed: 7000, makeReadyMin: 8 } },
  // ── MASSICOTS ──────────────────────────────────────────────────────────────
  { id: 'ma-polar-115', type: 'massicot', family: 'Massicots', rank: 1, brand: 'Polar', model: 'N 115 PLUS', format: '115 cm', priceDefaults: { liftsPerHour: 350 } },
  { id: 'ma-polar-137', type: 'massicot', family: 'Massicots', rank: 2, brand: 'Polar', model: 'N 137 PLUS', format: '137 cm', priceDefaults: { liftsPerHour: 350 } },
  { id: 'ma-polar-80', type: 'massicot', family: 'Massicots', rank: 3, brand: 'Polar', model: 'D 80 PRO', format: '80 cm', priceDefaults: { liftsPerHour: 300 } },
  { id: 'ma-wohl-115', type: 'massicot', family: 'Massicots', rank: 4, brand: 'Wohlenberg', model: 'WB 115 / Cut-tec', format: '115 cm', priceDefaults: { liftsPerHour: 330 } },
  { id: 'ma-perfecta-92', type: 'massicot', family: 'Massicots', rank: 5, brand: 'Perfecta', model: '92 TVC', format: '92 cm', priceDefaults: { liftsPerHour: 300 } },
  { id: 'ma-ideal-7228', type: 'massicot', family: 'Massicots', rank: 6, brand: 'Ideal', model: '7228-06 LT (petit atelier)', format: '72 cm', priceDefaults: { liftsPerHour: 200 } },
  // ── FINITION · Piqûre à cheval ─────────────────────────────────────────────
  { id: 'fi-mm-presto', type: 'finition', family: 'Piqûre à cheval', rank: 1, brand: 'Müller Martini', model: 'Presto II Digital', format: '—', priceDefaults: { speed: 9000, makeReadyMin: 20, consumableCost: 0.02 } },
  { id: 'fi-horizon-stitch', type: 'finition', family: 'Piqûre à cheval', rank: 2, brand: 'Horizon', model: 'StitchLiner Mark V', format: '—', priceDefaults: { speed: 6000, makeReadyMin: 15, consumableCost: 0.02 } },
  { id: 'fi-duplo-600i', type: 'finition', family: 'Piqûre à cheval', rank: 3, brand: 'Duplo', model: 'DBM-600i', format: '—', priceDefaults: { speed: 5000, makeReadyMin: 15, consumableCost: 0.02 } },
  // ── FINITION · Dos carré collé ─────────────────────────────────────────────
  { id: 'fi-horizon-bq500', type: 'finition', family: 'Dos carré collé', rank: 1, brand: 'Horizon', model: 'BQ-500', format: '—', priceDefaults: { speed: 800, makeReadyMin: 20, consumableCost: 0.12 } },
  { id: 'fi-mm-vareo', type: 'finition', family: 'Dos carré collé', rank: 2, brand: 'Müller Martini', model: 'Vareo PRO', format: '—', priceDefaults: { speed: 1300, makeReadyMin: 20, consumableCost: 0.12 } },
  { id: 'fi-duplo-dpb500', type: 'finition', family: 'Dos carré collé', rank: 3, brand: 'Duplo', model: 'DPB-500', format: '—', priceDefaults: { speed: 500, makeReadyMin: 15, consumableCost: 0.12 } },
  // ── FINITION · Pelliculage ─────────────────────────────────────────────────
  { id: 'fi-komfi-delta52', type: 'finition', family: 'Pelliculage', rank: 1, brand: 'Komfi', model: 'Delta 52', format: '52 cm', priceDefaults: { speed: 2000, makeReadyMin: 15, consumableCost: 0.08 } },
  { id: 'fi-autobond-76', type: 'finition', family: 'Pelliculage', rank: 2, brand: 'Autobond', model: 'Micro 76 TH', format: '76 cm', priceDefaults: { speed: 3000, makeReadyMin: 15, consumableCost: 0.1 } },
  { id: 'fi-foliant-530', type: 'finition', family: 'Pelliculage', rank: 3, brand: 'Foliant', model: 'Mercury 530 SF', format: '53 cm', priceDefaults: { speed: 2500, makeReadyMin: 12, consumableCost: 0.08 } },
  // ── FINITION · Vernis sélectif & dorure numérique ──────────────────────────
  { id: 'fi-duplo-dusense', type: 'finition', family: 'Vernis sélectif & dorure', rank: 1, brand: 'Duplo', model: 'DuSense DDC-810', format: '36×102', priceDefaults: { speed: 2200, makeReadyMin: 10, consumableCost: 0.15 } },
  { id: 'fi-mgi-jv3d', type: 'finition', family: 'Vernis sélectif & dorure', rank: 2, brand: 'MGI', model: 'JetVarnish 3D Evo', format: '36×102', priceDefaults: { speed: 2000, makeReadyMin: 10, consumableCost: 0.2 } },
  // ── FINITION · Raineuses-plieuses ──────────────────────────────────────────
  { id: 'fi-duplo-dc646', type: 'finition', family: 'Raineuses-plieuses', rank: 1, brand: 'Duplo', model: 'DC-646 PRO', format: '33×65', priceDefaults: { speed: 1500, makeReadyMin: 5, consumableCost: 0 } },
  { id: 'fi-morgana-pro50', type: 'finition', family: 'Raineuses-plieuses', rank: 2, brand: 'Morgana', model: 'AutoCreaser Pro 50', format: '50 cm', priceDefaults: { speed: 5000, makeReadyMin: 5, consumableCost: 0 } },
];

// ─── Persistance locale (maquette V1) — PARCS MULTIPLES ──────────────────────
// Point 8 (retour Arnaud 2026-08-08) : un tenant porte une LISTE de parcs.
// L ancien format mono-parc est migre a la volee.

const parksKey = (tenantId: string) => `magrit_machine_parks__${tenantId}`;
const legacyKey = (tenantId: string) => `magrit_machine_park__${tenantId}`;

export function loadParks(tenantId: string): MachinePark[] {
  try {
    const raw = localStorage.getItem(parksKey(tenantId));
    if (raw) return JSON.parse(raw) as MachinePark[];
    // Migration : ancien format mono-parc → liste a un element.
    const legacy = localStorage.getItem(legacyKey(tenantId));
    if (legacy) {
      const old = JSON.parse(legacy) as Omit<MachinePark, 'id' | 'name'>;
      const migrated: MachinePark[] = [
        { id: 'parc-principal', name: 'Parc principal', ...old },
      ];
      localStorage.setItem(parksKey(tenantId), JSON.stringify(migrated));
      localStorage.removeItem(legacyKey(tenantId));
      return migrated;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveParks(tenantId: string, parks: MachinePark[]): void {
  localStorage.setItem(parksKey(tenantId), JSON.stringify(parks));
}

/** Ajoute ou remplace un parc (cle : id). */
export function upsertPark(tenantId: string, park: MachinePark): void {
  const parks = loadParks(tenantId);
  const idx = parks.findIndex((p) => p.id === park.id);
  if (idx >= 0) parks[idx] = park;
  else parks.push(park);
  saveParks(tenantId, parks);
}

export function deletePark(tenantId: string, parkId: string): void {
  saveParks(tenantId, loadParks(tenantId).filter((p) => p.id !== parkId));
}

/** Le parc permet-il de sortir un prix ? (BK-17 : massicot obligatoire.) */
export function parkIsCalculable(park: Pick<MachinePark, 'machines'>): boolean {
  return park.machines.some((m) => m.type === 'massicot');
}
