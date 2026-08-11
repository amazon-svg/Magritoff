/**
 * Contrat d'API du domaine « Parc machine » — R1 (API-first).
 *
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │ CE FICHIER EST PARTAGE ENTRE LE FRONT ET LE SERVEUR.                    │
 * │                                                                        │
 * │ Il est importe par :                                                   │
 * │   - le navigateur, via `src/app/.../machinePark.helpers.ts` (Vite)      │
 * │   - l edge function `supabase/functions/park-api/` (Deno)               │
 * │                                                                        │
 * │ Sa seule dependance est `zod`, resolue des deux cotes : par             │
 * │ node_modules cote Vite, par `supabase/functions/import_map.json`        │
 * │ (`zod` -> `npm:zod@4.4.3`) cote Deno. N AJOUTER AUCUN AUTRE IMPORT      │
 * │ sans verifier qu il se resout dans les deux environnements — en         │
 * │ particulier rien de React, rien de `@supabase/supabase-js`, rien qui    │
 * │ touche au DOM.                                                         │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * Le document de reference est `docs/API_PARC_MACHINE.md`. Ce fichier en est
 * la forme executable : ce qui est ecrit la-bas doit etre verifiable ici.
 *
 * Origine metier : seance RP#070826 (Expert Solutions x AGE Dvt.) —
 * BK-07 referentiel Fournisseur unifie, BK-09/10 qualification et
 * sous-traitance, BK-13 couts d externalisation, BK-15 parcours du wizard,
 * BK-16 selection par facettes, BK-17 massicot obligatoire, BK-18 fournisseurs,
 * BK-19 encres, BK-22 modele de cout, BK-27 machine inactive.
 */

import { z } from 'zod';

export const PARK_API_VERSION = '1.0';

// ─── Types de machines ───────────────────────────────────────────────────────

export const MACHINE_TYPE_KEYS = [
  'offset',
  'numerique',
  'grand_format',
  'roto',
  'decoupe',
  'pliage',
  'massicot',
  'finition',
] as const;

export type MachineTypeKey = (typeof MACHINE_TYPE_KEYS)[number];

export const machineTypeKeySchema = z.enum(MACHINE_TYPE_KEYS);

/**
 * Le type de machine SANS lequel aucun prix ne peut sortir (BK-17).
 *
 * Tout ce qui s imprime se coupe : sans poste de massicotage, la chaine de
 * production est incomplete et le moteur de prix n a pas de quoi conclure.
 */
export const MANDATORY_MACHINE_TYPE: MachineTypeKey = 'massicot';

// ─── Referentiel de machines (partage, lecture seule) ────────────────────────

export const libraryMachineSchema = z.object({
  id: z.string().min(1),
  type: machineTypeKeySchema,
  /** Sous-famille de tri du selecteur. */
  family: z.string().min(1),
  /** Rang de popularite DANS sa famille — 1 = la plus vendue. */
  rank: z.number().int().positive(),
  brand: z.string().min(1),
  model: z.string().min(1),
  format: z.string().min(1),
  colors: z.number().int().positive().optional(),
  varnish: z.boolean().optional(),
  /**
   * Valeurs par defaut du MODELE pour les parametres de prix.
   *
   * Nombres nus, SANS devise : le referentiel est partage entre imprimeurs,
   * un cout plaque de 8 se libelle en euros ou en dollars a l affichage selon
   * `tenants.currency`. Y ecrire un symbole rendrait le referentiel
   * non partageable.
   */
  priceDefaults: z.record(z.string(), z.number()).optional(),
});

export type LibraryMachine = z.infer<typeof libraryMachineSchema>;

// ─── Referentiel Fournisseur unifie — BK-07 ──────────────────────────────────

export const SUPPLIER_KINDS = ['paper', 'transport', 'subcontractor'] as const;
export type SupplierKind = (typeof SUPPLIER_KINDS)[number];
export const supplierKindSchema = z.enum(SUPPLIER_KINDS);

export const supplierRefSchema = z.object({
  id: z.string().min(1),
  kind: supplierKindSchema,
  name: z.string().min(1),
  /** `shared` = referentiel commun · `tenant` = ajoute par cet imprimeur. */
  scope: z.enum(['shared', 'tenant']),
});

export type SupplierRef = z.infer<typeof supplierRefSchema>;

// ─── Machine installee dans un parc ──────────────────────────────────────────

/** Ce que le CLIENT envoie : l id est attribue par le serveur. */
export const parkMachineInputSchema = z.object({
  /**
   * Modele du referentiel dont la machine derive. `null` admis : une machine
   * dont l entree de referentiel a disparu reste une machine de l atelier.
   */
  libraryId: z.string().min(1).nullable().default(null),
  type: machineTypeKeySchema,
  brand: z.string().min(1),
  model: z.string().min(1),
  format: z.string(),
  colors: z.number().int().positive().nullable().optional(),
  varnish: z.boolean().nullable().optional(),
  /**
   * BK-09 : qualification DISPONIBLE mais NON obligatoire. `null` est une
   * valeur de premier rang — l arbitrage de seance a donne la priorite au
   * setup rapide, la qualification vient ensuite.
   */
  location: z.enum(['interne', 'externe']).nullable().default(null),
  /** BK-10 : saisie libre, alimentee par autocompletion. */
  subcontractor: z.string().nullable().optional(),
  /** BK-13 : zero est une valeur legitime, pas une absence. */
  transportCost: z.number().min(0).nullable().optional(),
  /** BK-13 : couts fixes d externalisation, distincts du transport. */
  fixedCost: z.number().min(0).nullable().optional(),
  /** BK-22 : absent = taux du parc. */
  hourlyRate: z.number().min(0).nullable().optional(),
  /** BK-27 : `false` = exclue des calculs servis. */
  active: z.boolean().optional().default(true),
  /** Saisies utilisateur des parametres de prix. */
  params: z.record(z.string(), z.number()).nullable().optional(),
});

export type ParkMachineInput = z.infer<typeof parkMachineInputSchema>;

/** Ce que le SERVEUR renvoie : identifiant attribue. */
export const parkMachineSchema = parkMachineInputSchema.extend({
  id: z.string().min(1),
});

export type ParkMachine = z.infer<typeof parkMachineSchema>;

// ─── Parc ────────────────────────────────────────────────────────────────────

export const inkSchema = z.object({
  type: z.string().min(1),
  costPerKg: z.number().min(0),
});

export type Ink = z.infer<typeof inkSchema>;

export const machineParkInputSchema = z.object({
  /** Absent ou `null` = creation. Present = remplacement complet. */
  id: z.string().min(1).nullable().optional(),
  name: z.string().min(1, 'Le parc doit porter un nom.'),
  machines: z.array(parkMachineInputSchema).default([]),
  /** BK-18 : ecrans papier et transport separes. */
  paperSuppliers: z.array(z.string()).default([]),
  transportSuppliers: z.array(z.string()).default([]),
  /** BK-19. */
  inks: z.array(inkSchema).default([]),
  /** BK-22 : taux horaire main d oeuvre, saisi. */
  laborRate: z.number().min(0),
  /** BK-22 : cout kWh, valeur par defaut non saisie. */
  energyRate: z.number().min(0),
  /** BK-15 : donnee d arbitrage ergonomique, conservee telle quelle. */
  wizardVariant: z.enum(['A', 'B']).nullable().optional(),
  wizardClicks: z.number().int().min(0).nullable().optional(),
  completedAt: z.string().nullable().optional(),
});

export type MachineParkInput = z.infer<typeof machineParkInputSchema>;

export const machineParkSchema = machineParkInputSchema.extend({
  id: z.string().min(1),
  machines: z.array(parkMachineSchema),
  /**
   * LECTURE SEULE — conclusion calculee par le serveur, jamais acceptee en
   * ecriture : l accepter reviendrait a laisser un client declarer calculable
   * un parc qui ne l est pas.
   */
  calculable: z.boolean(),
});

export type MachinePark = z.infer<typeof machineParkSchema>;

// ─── Regle metier BK-17 ──────────────────────────────────────────────────────

/**
 * Le parc permet-il de sortir un prix ? (BK-17 : massicot obligatoire.)
 *
 * UNE SEULE implementation, importee par le serveur ET par le front :
 *   - le serveur l evalue a la lecture et renvoie `calculable` — il fait foi ;
 *   - le front l evalue sur le parc EN COURS de constitution dans le wizard,
 *     avant tout enregistrement : sans cela la validation ne pourrait rien
 *     dire tant que rien n est enregistre.
 *
 * Une machine INACTIVE ne compte pas (BK-27) : elle est exclue des calculs
 * servis, donc un parc dont le seul massicot est desactive ne peut pas
 * davantage produire un prix qu un parc sans massicot.
 *
 * Distinction voisine a ne pas confondre : l absence de PLIEUSE n est pas
 * bloquante. Elle est suspecte et declenche une demande de confirmation, parce
 * qu il existe un cas legitime — presse numerique avec groupe de pliage en
 * ligne. C est une question, pas un refus.
 */
export function parkIsCalculable(park: {
  machines: ReadonlyArray<{ type: MachineTypeKey; active?: boolean | null }>;
}): boolean {
  return park.machines.some(
    (m) => m.type === MANDATORY_MACHINE_TYPE && m.active !== false,
  );
}

// ─── Enveloppes de requete et de reponse ─────────────────────────────────────

const tenantIdSchema = z.string().uuid("L'identifiant d'espace est invalide.");

export const listParksQuerySchema = z.object({ tenantId: tenantIdSchema });

export const upsertParkBodySchema = z.object({
  tenantId: tenantIdSchema,
  park: machineParkInputSchema,
});

export type UpsertParkBody = z.infer<typeof upsertParkBodySchema>;

export const replaceParksBodySchema = z.object({
  tenantId: tenantIdSchema,
  parks: z.array(machineParkInputSchema),
});

export type ReplaceParksBody = z.infer<typeof replaceParksBodySchema>;

export const listSuppliersQuerySchema = z.object({
  kind: supplierKindSchema.optional(),
  tenantId: tenantIdSchema.optional(),
});

export const listMachineLibraryQuerySchema = z.object({
  type: machineTypeKeySchema.optional(),
});

// ─── Erreurs ─────────────────────────────────────────────────────────────────

export const PARK_ERROR_CODES = [
  'invalid_payload',
  'unauthenticated',
  'forbidden_tenant',
  'not_found',
  'method_not_allowed',
  'internal',
] as const;

export type ParkErrorCode = (typeof PARK_ERROR_CODES)[number];

export interface ParkApiError {
  code: ParkErrorCode;
  /** Message en francais, destine a l affichage. */
  message: string;
}

export const HTTP_STATUS_BY_ERROR_CODE: Record<ParkErrorCode, number> = {
  invalid_payload: 400,
  unauthenticated: 401,
  forbidden_tenant: 403,
  not_found: 404,
  method_not_allowed: 405,
  internal: 500,
};

/**
 * Erreur typee levee par l adaptateur client, pour que les ecrans puissent
 * distinguer « pas le droit » de « panne reseau » sans lire un message.
 * Meme intention que `ClariprintError` dans le module Clariprint.
 */
export class ParkApiRequestError extends Error {
  readonly code: ParkErrorCode | 'network';
  readonly status: number | null;

  constructor(code: ParkErrorCode | 'network', message: string, status: number | null = null) {
    super(message);
    this.name = 'ParkApiRequestError';
    this.code = code;
    this.status = status;
  }
}
