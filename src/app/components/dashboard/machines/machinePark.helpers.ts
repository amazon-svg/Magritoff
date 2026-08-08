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
  brand: string;
  model: string;
  /** Format papier max (presses) ou laize (grand format / roto). */
  format: string;
  /** Nombre de groupes / couleurs (presses). */
  colors?: number;
  /** Presence d un groupe vernis. */
  varnish?: boolean;
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

// ─── Bibliotheque de machines (mock — BK-16, sourcing reel non chiffre) ─────
// Profondeur : modeles recents ET historiques (une machine de 9 ans est
// toujours en production — seance RP#070826 §7.3).

export const MACHINE_LIBRARY: LibraryMachine[] = [
  // Offset
  { id: 'off-hd-sm52-4', type: 'offset', brand: 'Heidelberg', model: 'Speedmaster SM 52-4', format: '37×52', colors: 4 },
  { id: 'off-hd-sx74-5', type: 'offset', brand: 'Heidelberg', model: 'Speedmaster SX 74-5+L', format: '52×74', colors: 5, varnish: true },
  { id: 'off-hd-xl106-8', type: 'offset', brand: 'Heidelberg', model: 'Speedmaster XL 106-8-P', format: '75×106', colors: 8 },
  { id: 'off-km-l526', type: 'offset', brand: 'Komori', model: 'Lithrone G526', format: '52×74', colors: 5 },
  { id: 'off-km-gl840', type: 'offset', brand: 'Komori', model: 'Lithrone GL840+C', format: '75×102', colors: 8, varnish: true },
  { id: 'off-kba-105', type: 'offset', brand: 'Koenig & Bauer', model: 'Rapida 105-6+L', format: '74×105', colors: 6, varnish: true },
  { id: 'off-kba-75', type: 'offset', brand: 'Koenig & Bauer', model: 'Rapida 75-4', format: '52×75', colors: 4 },
  { id: 'off-ry-925', type: 'offset', brand: 'RMGT (Ryobi)', model: '925 A4', format: '60×92', colors: 4 },
  // Numerique
  { id: 'num-hp-7k', type: 'numerique', brand: 'HP Indigo', model: '7K Digital Press', format: '33×48', colors: 7 },
  { id: 'num-hp-100k', type: 'numerique', brand: 'HP Indigo', model: '100K Digital Press', format: '35×51', colors: 7 },
  { id: 'num-xe-iri', type: 'numerique', brand: 'Xerox', model: 'Iridesse', format: '33×48', colors: 6, varnish: true },
  { id: 'num-ca-v1000', type: 'numerique', brand: 'Canon', model: 'imagePRESS V1000', format: '33×48', colors: 4 },
  { id: 'num-km-c14000', type: 'numerique', brand: 'Konica Minolta', model: 'AccurioPress C14000', format: '33×48', colors: 4 },
  { id: 'num-ric-9500', type: 'numerique', brand: 'Ricoh', model: 'Pro C9500', format: '33×49', colors: 4 },
  // Grand format
  { id: 'gf-ro-vg3', type: 'grand_format', brand: 'Roland DG', model: 'TrueVIS VG3-640', format: 'laize 160 cm', colors: 8 },
  { id: 'gf-ep-s80600', type: 'grand_format', brand: 'Epson', model: 'SureColor S80600', format: 'laize 162 cm', colors: 9 },
  { id: 'gf-hp-l800', type: 'grand_format', brand: 'HP', model: 'Latex 800 W', format: 'laize 162 cm', colors: 7 },
  { id: 'gf-du-p5350', type: 'grand_format', brand: 'Durst', model: 'P5 350', format: 'laize 350 cm', colors: 6 },
  { id: 'gf-ag-jeti', type: 'grand_format', brand: 'Agfa', model: 'Jeti Tauro H3300', format: 'laize 330 cm', colors: 6 },
  // Rotatives
  { id: 'ro-goss-m600', type: 'roto', brand: 'Goss', model: 'M600 Folia', format: 'laize 96 cm', colors: 4 },
  { id: 'ro-km-38', type: 'roto', brand: 'Komori', model: 'System 38S', format: 'laize 96,5 cm', colors: 4 },
  // Decoupe
  { id: 'de-bobst-102', type: 'decoupe', brand: 'Bobst', model: 'SP 102-E', format: '72×102' },
  { id: 'de-zund-g3', type: 'decoupe', brand: 'Zünd', model: 'G3 L-2500', format: '180×250' },
  { id: 'de-esko-c66', type: 'decoupe', brand: 'Esko Kongsberg', model: 'C66', format: '320×220' },
  // Pliage
  { id: 'pl-stahl-kh82', type: 'pliage', brand: 'Heidelberg Stahlfolder', model: 'KH 82', format: '82 cm' },
  { id: 'pl-mbo-k80', type: 'pliage', brand: 'MBO', model: 'K80', format: '78 cm' },
  { id: 'pl-horizon-afc', type: 'pliage', brand: 'Horizon', model: 'AFC-566F', format: '56 cm' },
  // Massicots
  { id: 'ma-polar-115', type: 'massicot', brand: 'Polar', model: 'N 115 PLUS', format: '115 cm' },
  { id: 'ma-polar-78', type: 'massicot', brand: 'Polar', model: 'D 78', format: '78 cm' },
  { id: 'ma-wohl-115', type: 'massicot', brand: 'Wohlenberg', model: 'WB 115', format: '115 cm' },
  { id: 'ma-ideal-7228', type: 'massicot', brand: 'Ideal', model: '7228-06 LT', format: '72 cm' },
  // Finition
  { id: 'fi-mm-primera', type: 'finition', brand: 'Müller Martini', model: 'Primera MC (piqûre)', format: '—' },
  { id: 'fi-horizon-bq', type: 'finition', brand: 'Horizon', model: 'BQ-500 (dos carré collé)', format: '—' },
  { id: 'fi-duplo-600i', type: 'finition', brand: 'Duplo', model: 'DBM-600i (piqûre)', format: '—' },
  { id: 'fi-komfi-amiga', type: 'finition', brand: 'Komfi', model: 'Amiga 52 (pelliculage)', format: '52 cm' },
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
