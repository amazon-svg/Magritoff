/**
 * Catalogue de colonnes de l export comptable (story E10.18c), COMMUN aux
 * deux renderers (CSV ici, XLSX en E10.18d) — c est ce qui rend le format
 * secondaire : un seul catalogue de cellules TYPEES, chaque renderer decide
 * seul comment ecrire chaque type.
 *
 * ── ORDRE ET CATALOGUE : `openapi/magrit-core.v1.yaml` (`OrderExportGranularity`)
 * EST LA SEULE SOURCE, arretee DEFINITIVEMENT le 2026-09-13 (qa-review round 1
 * d E10.18c) — voir ce schema pour le detail complet et le motif de chaque
 * colonne. Ce catalogue le reproduit A L IDENTIQUE : ONZE colonnes partagees
 * (dont « Courriel interlocuteur », rang 9, AJOUTEE par la migration additive
 * de la migration `20260913000000`, section 1bis), puis les colonnes propres
 * a chaque granularite. Toute correction se fait D ABORD dans l OpenAPI :
 * un ecart entre ce fichier et le fichier REELLEMENT PRODUIT s est deja
 * produit une fois (qa-review round 1) sans qu aucune des deux sources ne se
 * sache fausse — c est pour cela que l OpenAPI porte desormais la mention
 * explicite « copie de confort », et que ce catalogue ne doit JAMAIS diverger
 * en silence.
 *
 * ── Traduction des codes techniques (CRITERE opposable, contrat point 4, ────
 * ── amende 2026-09-13 : une liste ENUMEREE avait laisse passer `order_status`)
 * Une colonne se traduit SI ET SEULEMENT SI sa valeur en base provient d une
 * ENUMERATION FERMEE DE CE CONTRAT. Etat au 2026-09-13, dERIVE du critere,
 * TROIS colonnes et aucune autre : `customer_type` (`CustomerType`),
 * `order_status` (`CommercialOrderStatus`, `validated` -> « Validee »),
 * `vat_regime` (`TaxRegime`, cinq valeurs + le cas nul). `customer_type` et
 * `order_status`/`vat_regime` sortent BRUTS de `api_read_order_export_rows`
 * (les vues, puis cette fonction, ne presentent JAMAIS — c est le travail du
 * GENERATEUR DE CELLULE). Traduits ICI, et ICI SEULEMENT.
 *
 * LE PIEGE INVERSE, que le critere range correctement et qu une liste aurait
 * rate : « Etape de production » (`production_step_label`) NE SE TRADUIT
 * JAMAIS — c est un LIBELLE saisi par l imprimeur dans son propre referentiel
 * (E10.13), AUCUN schema de ce contrat n en enumere les valeurs. Un atelier
 * qui nomme une etape « draft » doit la voir ecrite telle quelle.
 *
 * CHAQUE table de traduction est verifiee EXHAUSTIVE au COMPILATEUR
 * (`satisfies Record<Enum, string>`, TypeScript refuse de compiler si
 * l enumeration source (`CustomerType`/`CommercialOrderStatus`/`TaxRegime`,
 * generees depuis l OpenAPI) gagne une valeur non couverte ICI) — c est un
 * test DERIVE DU SCHEMA, jamais une liste recopiee qui se perimerait de la
 * meme facon qu une liste normale. EN SUS, `translateEnum()` echoue
 * BRUYAMMENT (throw) si une valeur RENCONTREE A L EXECUTION ne figure pas
 * dans la table : PAS de repli silencieux `?? raw` qui laisserait passer un
 * code brut dans le fichier remis au comptable le jour ou la base porterait
 * une valeur que le contrat/TypeScript ne connaissent pas encore (dette
 * d un schema DB qui aurait avance sans que ce catalogue n ait ete revu).
 *
 * ── Familles de cellules, et pourquoi les taux ont QUATRE decimales ────────
 * `money` = `numeric(12,2)` (`Money`) ; `rate` = `numeric(6,4)` (`Rate`,
 * grandeur DERIVEE ou taux — le format `0.0000` est le signal "ce n est pas
 * un montant", contrat point 4 arbitrage colonne 1). Chaque colonne
 * numerique arrive de `api_read_order_export_rows` DEJA en CHAINE decimale
 * (le SQL caste explicitement chaque `numeric` en `::text` avant de
 * construire le jsonb, precisement pour que ce catalogue n ait JAMAIS a
 * deviner un nombre de decimales a partir d un flottant deja arrondi).
 */
import { formatCivilDateInReferenceTimeZone } from '../../../kernel/clock/index.ts';
import type { CommercialOrderStatus, CustomerType, TaxRegime } from '../../../platform/api/generated/magrit-core.v1.ts';
import type { OrderExportGranularity } from '../api/contracts.ts';

export type SpreadsheetCell =
  | Readonly<{ kind: 'text'; value: string | null }>
  | Readonly<{ kind: 'money'; decimal: string | null }>
  | Readonly<{ kind: 'rate'; decimal: string | null }>
  | Readonly<{ kind: 'integer'; value: number }>
  | Readonly<{ kind: 'date'; instant: string }>;

/** Une ligne brute rendue par `api_read_order_export_rows` (`row` du jsonb, cle par nom de colonne DB). */
export type OrderExportRawRow = Readonly<Record<string, unknown>>;

export type OrderExportColumn = Readonly<{
  /** En-tete de colonne, FIGE — voir `layout_version` (contrat). */
  header: string;
  cell(row: OrderExportRawRow): SpreadsheetCell;
}>;

/**
 * `satisfies Record<CustomerType, string>` : EXHAUSTIVITE VERIFIEE AU
 * COMPILATEUR — si `CustomerType` (genere depuis l OpenAPI) gagne une
 * valeur, `pnpm typecheck` echoue ICI avant qu un code brut n atteigne un
 * fichier remis au comptable.
 */
const CUSTOMER_TYPE_LABELS = Object.freeze({
  company: 'Société',
  individual: 'Particulier',
}) satisfies Record<CustomerType, string>;

/**
 * `CommercialOrderStatus` n a AUJOURD HUI qu une seule valeur (`validated`,
 * contrat) — colonne CONSTANTE, publiee maintenant pour que la mise en page
 * ne bouge pas le jour ou `cancelled`/`invoiced` apparaitront (arbitrage
 * colonne 2). `satisfies Record<CommercialOrderStatus, string>` : le jour ou
 * l enumeration grandit, `pnpm typecheck` echoue ICI tant que cette table
 * n a pas ete completee — exactement le defaut (liste qui se perime en
 * silence) que le critere de traduction existe pour empecher.
 */
const ORDER_STATUS_LABELS = Object.freeze({
  validated: 'Validée',
}) satisfies Record<CommercialOrderStatus, string>;

/**
 * CINQ valeurs + le cas nul (`CommercialOrderLine.vat_regime`/
 * `CommercialOrder.vat_regime`, contrat) — `satisfies Record<TaxRegime, string>`
 * : EXHAUSTIVITE VERIFIEE AU COMPILATEUR, ne pas se limiter aux valeurs
 * rencontrees en test (`dom_tom` n apparait dans AUCUNE fixture, un
 * imprimeur ultramarin le verrait passer en production si cette table
 * n etait pas complete).
 */
const VAT_REGIME_LABELS = Object.freeze({
  metropole_fr: 'France métropolitaine',
  dom_tom: 'DOM-TOM',
  franchise_tva: 'Franchise en base de TVA',
  export_eu: 'Export UE',
  export_world: 'Export hors UE',
}) satisfies Record<TaxRegime, string>;

/**
 * Traduction d un code d ENUMERATION FERMEE DE CE CONTRAT — jamais un repli
 * silencieux. Une valeur ABSENTE de `labels` a l EXECUTION (base plus a jour
 * que le contrat/TypeScript compiles) fait ECHOUER LA GENERATION du fichier
 * plutot que de livrer un code brut au comptable : c est exactement le
 * defaut qu un `?? raw` aurait reproduit, deplace dans le temps jusqu au
 * jour ou une sixieme valeur de regime, ou un second statut, apparaitrait.
 */
function translateEnum(labels: Readonly<Record<string, string>>, raw: string, columnName: string): string {
  // `Object.hasOwn`, pas `labels[raw] === undefined` : une valeur brute
  // litterale `"toString"`/`"constructor"` (heritee d'`Object.prototype`)
  // echapperait sinon au throw. Injoignable en pratique (colonne contrainte
  // par une enumeration en base), corrige quand meme — un mot ne coute rien
  // face au risque de laisser passer un code brut.
  if (!Object.hasOwn(labels, raw)) {
    throw new TypeError(
      `order-export-columns: valeur "${raw}" inconnue pour la colonne "${columnName}" (enumeration fermee du contrat) — contrat/table de traduction non a jour ?`,
    );
  }
  return labels[raw]!;
}

function textOf(row: OrderExportRawRow, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' ? value : null;
}

function decimalOf(row: OrderExportRawRow, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' ? value : null;
}

function integerOf(row: OrderExportRawRow, key: string): number {
  const value = row[key];
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`order-export-columns: valeur entiere attendue pour "${key}", recu ${JSON.stringify(value)}.`);
  }
  return parsed;
}

/** Colonne « Date de commande » : instant UTC brut -> date CIVILE Europe/Paris (contrat point 5 regle 5). */
function dateCell(row: OrderExportRawRow, key: string): SpreadsheetCell {
  const value = row[key];
  if (typeof value !== 'string') {
    throw new TypeError(`order-export-columns: date attendue pour "${key}", recu ${JSON.stringify(value)}.`);
  }
  return { kind: 'date', instant: value };
}

function customerTypeCell(row: OrderExportRawRow): SpreadsheetCell {
  const raw = textOf(row, 'customer_type');
  return { kind: 'text', value: raw === null ? null : translateEnum(CUSTOMER_TYPE_LABELS, raw, 'Type de client') };
}

/** « Statut commercial » — ENUMERATION FERMEE (`CommercialOrderStatus`), SE TRADUIT. A NE PAS confondre avec « Étape de production », qui ne se traduit JAMAIS (voir en-tete de fichier). */
function orderStatusCell(row: OrderExportRawRow): SpreadsheetCell {
  const raw = textOf(row, 'order_status');
  return { kind: 'text', value: raw === null ? null : translateEnum(ORDER_STATUS_LABELS, raw, 'Statut commercial') };
}

function vatRegimeCell(row: OrderExportRawRow): SpreadsheetCell {
  const raw = textOf(row, 'vat_regime');
  return { kind: 'text', value: raw === null ? null : translateEnum(VAT_REGIME_LABELS, raw, 'Régime de TVA') };
}

/**
 * Les ONZE colonnes partagees, DANS LE MEME ORDRE aux deux granularites
 * (openapi/magrit-core.v1.yaml, `OrderExportGranularity`, SEULE source
 * d ordre). Rang 9, « Courriel interlocuteur », AJOUTEE par la migration
 * additive `20260913000000` section 1bis (qa-review round 1, arbitrage
 * colonne 5).
 */
const SHARED_COLUMNS: readonly OrderExportColumn[] = Object.freeze([
  { header: 'Numéro de commande', cell: (row) => ({ kind: 'text', value: textOf(row, 'order_number') }) },
  { header: "Devis d'origine", cell: (row) => ({ kind: 'text', value: textOf(row, 'quote_number') }) },
  { header: 'Date de commande', cell: (row) => dateCell(row, 'order_created_at') },
  { header: 'Type de client', cell: customerTypeCell },
  { header: 'Client', cell: (row) => ({ kind: 'text', value: textOf(row, 'customer_name') }) },
  { header: 'SIRET', cell: (row) => ({ kind: 'text', value: textOf(row, 'customer_siret') }) },
  { header: 'Numéro de TVA', cell: (row) => ({ kind: 'text', value: textOf(row, 'customer_vat_number') }) },
  { header: 'Interlocuteur', cell: (row) => ({ kind: 'text', value: textOf(row, 'customer_contact_name') }) },
  { header: 'Courriel interlocuteur', cell: (row) => ({ kind: 'text', value: textOf(row, 'customer_contact_email') }) },
  { header: 'Statut commercial', cell: orderStatusCell },
  { header: 'Étape de production', cell: (row) => ({ kind: 'text', value: textOf(row, 'production_step_label') }) },
]);

/** Colonnes propres a la granularite `order` (une commande = un total). */
const ORDER_ONLY_COLUMNS: readonly OrderExportColumn[] = Object.freeze([
  { header: 'Total lignes HT', cell: (row) => ({ kind: 'money', decimal: decimalOf(row, 'lines_subtotal') }) },
  { header: 'Remise globale', cell: (row) => ({ kind: 'money', decimal: decimalOf(row, 'global_discount') }) },
  { header: 'Taux de remise effectif', cell: (row) => ({ kind: 'rate', decimal: decimalOf(row, 'effective_discount_rate') }) },
  { header: 'Net HT', cell: (row) => ({ kind: 'money', decimal: decimalOf(row, 'net_total') }) },
  { header: 'Taux de TVA', cell: (row) => ({ kind: 'rate', decimal: decimalOf(row, 'vat_rate') }) },
  { header: 'Régime de TVA', cell: vatRegimeCell },
  { header: 'Montant TVA', cell: (row) => ({ kind: 'money', decimal: decimalOf(row, 'vat_amount') }) },
  { header: 'Total TTC', cell: (row) => ({ kind: 'money', decimal: decimalOf(row, 'total_incl_tax') }) },
]);

/**
 * Colonnes propres a la granularite `line`. AUCUN total d entete repete
 * (arbitrage colonne 3), AUCUNE TVA (portee par l entete seule).
 * « Désignation », et non « Libelle produit » (renomme le 2026-09-13,
 * qa-review round 1) : c est le mot des pieces commerciales francaises
 * (devis, facture), donc celui que le destinataire attend.
 */
const LINE_ONLY_COLUMNS: readonly OrderExportColumn[] = Object.freeze([
  { header: 'Position', cell: (row) => ({ kind: 'integer', value: integerOf(row, 'line_position') }) },
  { header: 'Désignation', cell: (row) => ({ kind: 'text', value: textOf(row, 'line_label') }) },
  { header: 'Quantité', cell: (row) => ({ kind: 'integer', value: integerOf(row, 'quantity') }) },
  {
    header: 'Montant HT barème (avant remise)',
    cell: (row) => ({ kind: 'money', decimal: decimalOf(row, 'bracket_amount_excl_tax') }),
  },
  { header: 'Taux de remise ligne', cell: (row) => ({ kind: 'rate', decimal: decimalOf(row, 'discount_rate') }) },
  { header: 'PU HT indicatif', cell: (row) => ({ kind: 'rate', decimal: decimalOf(row, 'unit_price_indicative') }) },
  { header: 'Montant HT', cell: (row) => ({ kind: 'money', decimal: decimalOf(row, 'sale_price') }) },
]);

/** Catalogue COMPLET, dans l ordre final du fichier, pour une granularite donnee. */
export function orderExportColumnsFor(granularity: OrderExportGranularity): readonly OrderExportColumn[] {
  return granularity === 'order' ? [...SHARED_COLUMNS, ...ORDER_ONLY_COLUMNS] : [...SHARED_COLUMNS, ...LINE_ONLY_COLUMNS];
}

/** Reexporte pour les renderers (CSV ici, XLSX en E10.18d) : conversion UTC -> civile Europe/Paris d une cellule `date`. */
export { formatCivilDateInReferenceTimeZone };
