/**
 * Renderer XLSX de l export comptable des commandes (story E10.18d, contrat
 * §8.24 point 5/7 — « le meme port, `write-excel-file` 4.1.1, entree `/node`,
 * version epinglee »).
 *
 * DEUXIEME renderer derriere le port `OrderExportRenderer`
 * (`../order-export-renderer.ts`) — AUCUN autre fichier du depot ne connait
 * cette bibliotheque (contrat §8.24 point 6 : « c est ce qui rend le choix
 * de bibliotheque tardif et reversible »).
 *
 * ── NE JAMAIS importer `write-excel-file/universal` ────────────────────────
 * MESURE (banc `supabase/edge-runtime:v1.69.12`, 2026-09-12, contrat §8.24
 * point 7 precaution 1, VOCABULAIRE ALIGNE sur la treizieme correction du
 * bandeau, point (i), 2026-09-13) : `fflate` y bascule sur un **Worker**
 * des que **160 000 OCTETS NON COMPRESSES, PAR FICHIER INTERNE A
 * L ARCHIVE**, sont depasses — ce n est ni « compresse » ni « le classeur
 * final » (le classeur fini est environ NEUF FOIS plus petit que
 * `sheet1.xml`, la premiere formulation de ce commentaire disait a tort
 * « donnees compressees »). Le Worker n est PAS implemente dans l Edge
 * Runtime Deno. Consequence mesuree : ca casse vers 2 000 lignes
 * et passe a 1 000 — donc ca survit a tous les tests de developpement et ca
 * tombe en production, le jour du premier vrai export comptable. Verifie
 * dans le code source du paquet (`modules/export/writeXlsxFileUniversal.js`,
 * `modules/zip/zipToArrayBuffer.js`) : l entree `/universal` n expose meme
 * QUE `.toBlob()`, et delegue a `zip()` (API ASYNCHRONE de `fflate`, celle
 * qui recourt aux Workers), jamais a `zipSync()`/`ZipDeflate` (utilisees par
 * l entree `/node`, `modules/zip/zipToStream.js` — AUCUN Worker). L entree
 * retenue ici est **`/node`**, et UNIQUEMENT elle. Un test d architecture
 * (`tests/architecture/order-export-xlsx-library-boundaries.test.ts`) fait
 * echouer la CI si `write-excel-file/universal` apparait n importe ou dans
 * le depot.
 *
 * ── Version EPINGLEE (jamais `^4.1.1`) ──────────────────────────────────────
 * L entree `/node` n evite le Worker que grace a une CONSTANTE INTERNE NON
 * EXPORTEE (`COMPRESS_FILES_IN_PARALLEL = false`,
 * `modules/zip/zipToStream.js`) : un detail d implementation, pas un contrat
 * public, que rien n empeche une version mineure de changer. D ou le test de
 * non-regression a VOLUME REEL (>= 5 000 lignes, `worker_threads.Worker`
 * REELLEMENT casse — PAS `globalThis.Worker`, qui n est jamais lu par
 * `fflate` sous Node : voir l en-tete de
 * `tests/modules/order-exports/xlsx-renderer.volume.test.ts` pour le detail
 * complet et le piege corrige par la qa-review du 2026-09-13) plutot qu un
 * test de developpement de trois lignes, qui ne franchirait jamais le
 * seuil des 160 Ko et ne prouverait donc rien —
 * `tests/modules/order-exports/xlsx-renderer.volume.test.ts`.
 *
 * Meme discipline que le renderer CSV (contrat §8.24 point 7, dernier
 * paragraphe) : PUR (aucune I/O), ne `throw` JAMAIS vers l appelant — un
 * verdict `{ok:false, code, detail}` en cas d erreur, jamais une exception
 * qui ferait rejouer l export entier au tour suivant pour rien.
 *
 * ── `import 'fflate';` ci-dessous : EPINGLAGE, PAS un import mort ─────────
 * MESURE (treizieme correction du bandeau §8.24, point (ii), 2026-09-13) :
 * `write-excel-file` 4.1.1 declare sa dependance `fflate` en INTERVALLE
 * semver (`^0.8.2`), et cote DENO, NI une entree d import map SEULE NI un
 * `deno.lock` ne fige la version TRANSITIVE — seul un IMPORT REEL a
 * version exacte le fait (verifie par execution reelle dans
 * `supabase/edge-runtime:v1.69.12` : une entree `"fflate": "npm:fflate@0.8.2"`
 * SANS import reel ne fige rien, la version la plus haute compatible
 * (0.8.3) est quand meme telechargee ; un `deno.lock` v4 qui epingle 0.8.2
 * est IGNORE, sans erreur ni controle d integrite). Cette ligne, en
 * apparence inutilisee (`write-excel-file` importe deja `fflate` en
 * interne), FIGE la resolution transitive au COTE DE l import-map du
 * runner (`supabase/functions/magrit-order-export-runner/deno.json`,
 * meme version EXACTE que `package.json`, verifie par
 * `tests/architecture/order-export-xlsx-library-boundaries.test.ts`) : NE
 * PAS LA RETIRER, meme si aucun symbole d elle n est utilise ici.
 */
import writeExcelFile from 'write-excel-file/node';
import 'fflate';
import type { Cell, SheetData } from 'write-excel-file/node';
import { formatCivilDateInReferenceTimeZone, orderExportColumnsFor, type SpreadsheetCell } from '../order-export-columns.ts';
import type { OrderExportRenderer, OrderExportRenderInput, OrderExportRenderResult } from '../order-export-renderer.ts';

/** Decimal STRICT, jamais une notation scientifique ni un separateur de milliers (contrat point 6, exigence opposable). */
const STRICT_DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

/** `yyyy-mm-dd` — CA6 (« destine a etre ouvert tel quel »), contrat §8.24 point 5 regle 5. */
const DATE_CELL_FORMAT = 'yyyy-mm-dd';

/**
 * Format de cellule par KIND de `SpreadsheetCell` (contrat §8.24 point 5
 * regle 4) — UNE TABLE UNIQUE ET NOMMEE, jamais recopiee cellule par
 * cellule, jamais deduite du NOM d une colonne.
 *
 * TRANCHE PAR L ARCHITECTE (onzieme correction du bandeau §8.24, 2026-09-13),
 * PAS PAR CE LOT : un format par FAMILLE DE CELLULE, JAMAIS PAR COLONNE —
 * `money` -> `0.00`, `rate` -> `0.0000`, SANS EXCEPTION, sur les QUATRE
 * colonnes de kind `rate` (« Taux de remise effectif », « Taux de TVA »,
 * « Taux de remise ligne », « PU HT indicatif »). Cadrage initial insuffisant
 * (« `0.0000` sur la SEULE colonne PU HT indicatif ») corrige a la racine :
 * l arbitrage colonne 1 (motif du PU, « ce n est pas un montant, c est la
 * famille des taux ») ne tient QUE si les trois autres taux portent le meme
 * format — sans quoi le PU redevient seul a quatre decimales et son signal
 * s inverse (« plus precis », donc plus autoritaire, l exact contre-risque
 * que l arbitrage nommait). AUCUN format pourcentage : un taux s affiche
 * `0,2000`, jamais `20,00 %`, pour deux raisons ecrites au contrat — la
 * regle 2 (« le CSV ne convertit rien ») interdit une multiplication par
 * 100 quelque part, et un pourcentage en XLSX a cote d un `0,2000` en CSV
 * ferait lire la meme valeur de deux facons au meme destinataire.
 *
 * `rate` designe une ECHELLE DE QUATRE DECIMALES, pas litteralement le type
 * DB `Rate` : « PU HT indicatif » (`unit_price_indicative`) a une partie
 * entiere NON BORNEE (`12000.0000` pour un exemplaire a 12 000 €), donc NE
 * PASSE PAS le motif de `Rate` (`^-?[0-9]{1,2}\.[0-9]{4}$`). C est pourquoi
 * `toSpreadsheetNumber()` (ci-dessous) ne borne JAMAIS le nombre de chiffres
 * de la partie entiere — valider une cellule `rate` contre le motif de
 * `Rate` ferait echouer cette colonne en production sur un tirage courant.
 *
 * Cellule NULLE (`money` ou `rate`) -> cellule VIDE, JAMAIS `0` : `0,0000`
 * affirmerait « aucune remise », ce qui est un fait distinct de « le rapport
 * n a pas de sens ici » (base nulle, ou hors intervalle `numeric(6,4)`).
 *
 * `integer` (« Position », « Quantité ») : format `0` (entier, sans
 * decimale) — exigence du cadrage (CA5, « nombre entier natif »), corrigee
 * en qa-review round 1 (2026-09-13) : la premiere version de ce lot laissait
 * ces deux colonnes SANS format explicite (`format` omis), ce qui les
 * livrait sous le format General d Excel — lisible pour un entier, mais un
 * detail d implementation d Excel, pas une garantie du produit.
 */
const NUMBER_FORMAT_BY_CELL_KIND: Readonly<Record<'money' | 'rate' | 'integer', string>> = Object.freeze({
  money: '0.00',
  rate: '0.0000',
  integer: '0',
});

/**
 * Largeurs de colonnes (`write-excel-file`, `columns: [{ width }]`, en
 * caracteres) — UNE TABLE UNIQUE PAR EN-TETE, a mon jugement (le contrat
 * n exige rien au-dela d une mise en page « raisonnable », CA6). Couvre les
 * 19 en-tetes de la granularite `order` et les 18 de `line`
 * (`order-export-columns.ts`, SOURCE DE VERITE du catalogue). Une colonne
 * FUTURE sans entree ici fait ECHOUER LE RENDU (throw interne, attrape par
 * `render()`) plutot que de produire silencieusement un classeur avec une
 * colonne sans largeur explicite — meme discipline que `translateEnum()`
 * (`order-export-columns.ts`) : verifie par
 * `tests/modules/order-exports/xlsx-renderer.reference.test.ts`
 * (« complete pour les deux granularites »).
 */
const COLUMN_WIDTH_BY_HEADER: Readonly<Record<string, number>> = Object.freeze({
  'Numéro de commande': 20,
  "Devis d'origine": 16,
  'Date de commande': 14,
  'Type de client': 14,
  Client: 26,
  SIRET: 15,
  'Numéro de TVA': 16,
  Interlocuteur: 22,
  'Courriel interlocuteur': 28,
  'Statut commercial': 16,
  'Étape de production': 20,
  'Total lignes HT': 15,
  'Remise globale': 15,
  'Taux de remise effectif': 16,
  'Net HT': 12,
  'Taux de TVA': 12,
  'Régime de TVA': 22,
  'Montant TVA': 13,
  'Total TTC': 13,
  Position: 9,
  Désignation: 30,
  Quantité: 10,
  'Montant HT barème (avant remise)': 24,
  'Taux de remise ligne': 17,
  'PU HT indicatif': 14,
  'Montant HT': 13,
});

function columnWidthFor(header: string): number {
  const width = COLUMN_WIDTH_BY_HEADER[header];
  if (width === undefined) {
    throw new TypeError(
      `xlsx-renderer: aucune largeur de colonne definie pour l en-tete "${header}" (table COLUMN_WIDTH_BY_HEADER non a jour — voir order-export-columns.ts).`,
    );
  }
  return width;
}

/**
 * Point de conversion UNIQUE `string -> number` (contrat point 5 regle 1,
 * point 6 exigence 6) — n existe NULLE PART ailleurs, en particulier pas
 * dans le renderer CSV (voir son en-tete), qui ne convertit rien.
 *
 * Refuse toute chaine qui n est pas un decimal STRICT
 * (`/^-?\d+(\.\d+)?$/`) et tout resultat non fini — throw INTERNE, attrape
 * par `render()` et converti en verdict `{ok:false}`, jamais propage tel
 * quel a l appelant.
 */
export function toSpreadsheetNumber(decimal: string): number {
  if (!STRICT_DECIMAL_PATTERN.test(decimal)) {
    throw new TypeError(
      `xlsx-renderer: toSpreadsheetNumber attend un decimal strict (/^-?\\d+(\\.\\d+)?$/), recu ${JSON.stringify(decimal)}.`,
    );
  }
  const value = Number(decimal);
  if (!Number.isFinite(value)) {
    throw new TypeError(`xlsx-renderer: toSpreadsheetNumber - valeur non finie pour ${JSON.stringify(decimal)}.`);
  }
  return value;
}

/**
 * Instant UTC -> date CIVILE Europe/Paris -> `Date` UTC SANS PART
 * FRACTIONNAIRE (contrat §8.24 point 5 regle 6, ORDRE IMPOSE — intervertir
 * decale d un jour une commande de debut de mois). MESURE, pas deduit (banc
 * du 2026-09-12) : une `Date` construite avec le constructeur LOCAL produit
 * une serie Excel fractionnaire (`46022,958…` observe), le comptable voit
 * une heure parasite sur une colonne qui ne porte qu un jour.
 *
 * `formatCivilDateInReferenceTimeZone` (reexportee par
 * `order-export-columns.ts`, JAMAIS reimplementee ici) rend TOUJOURS
 * `YYYY-MM-DD` (`Intl.DateTimeFormat('en-CA', ...)`, fuseau
 * `Europe/Paris`) — c est l ETAPE 1. `Date.UTC(a, m - 1, j)` est l ETAPE 2,
 * et elle seule rend un instant dont `getTime()` est un multiple EXACT
 * d une journee (86 400 000 ms), condition necessaire et suffisante pour
 * que le numero de serie Excel (`convertDateToSerialNumber`,
 * `date.getTime() / 86400000 + constante`) soit un ENTIER.
 */
function civilInstantToSpreadsheetDate(instant: string): Date {
  const civilDate = formatCivilDateInReferenceTimeZone(instant);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(civilDate);
  if (!match) {
    throw new TypeError(`xlsx-renderer: date civile inattendue "${civilDate}" pour l instant "${instant}".`);
  }
  const [, yearText, monthText, dayText] = match as unknown as [string, string, string, string];
  return new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)));
}

/** En-tete : texte GRAS (`fontWeight`, propriete de style universelle du paquet), FIGE par `stickyRowsCount: 1` (contrat CA6). */
function headerCell(header: string): Cell {
  return { value: header, type: String, fontWeight: 'bold' };
}

/**
 * Cellule NULLE -> cellule VIDE (`null`), JAMAIS `0`, JAMAIS un tiret
 * (contrat point 5 regle 5, exigence opposable). Nombres NATIFS
 * (`type: Number`), jamais une chaine formatee cote serveur — l interdit
 * exprès du Dev Note.
 */
function dataCell(cell: SpreadsheetCell): Cell {
  switch (cell.kind) {
    case 'text':
      return cell.value === null ? null : { value: cell.value, type: String };
    case 'integer':
      return { value: cell.value, type: Number, format: NUMBER_FORMAT_BY_CELL_KIND.integer };
    case 'money':
      return cell.decimal === null
        ? null
        : { value: toSpreadsheetNumber(cell.decimal), type: Number, format: NUMBER_FORMAT_BY_CELL_KIND.money };
    case 'rate':
      return cell.decimal === null
        ? null
        : { value: toSpreadsheetNumber(cell.decimal), type: Number, format: NUMBER_FORMAT_BY_CELL_KIND.rate };
    case 'date':
      return { value: civilInstantToSpreadsheetDate(cell.instant), type: Date, format: DATE_CELL_FORMAT };
    default: {
      const exhaustive: never = cell;
      throw new TypeError(`xlsx-renderer: type de cellule inconnu ${JSON.stringify(exhaustive)}.`);
    }
  }
}

export const xlsxOrderExportRenderer: OrderExportRenderer = Object.freeze({
  format: 'xlsx',
  contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  fileExtension: 'xlsx',
  async render(input: OrderExportRenderInput): Promise<OrderExportRenderResult> {
    try {
      const columns = orderExportColumnsFor(input.granularity);
      const sheetData: SheetData = [columns.map((column) => headerCell(column.header))];
      for (const row of input.rows) {
        sheetData.push(columns.map((column) => dataCell(column.cell(row))));
      }

      const workbook = writeExcelFile(sheetData, {
        sheet: input.granularity === 'order' ? 'Commandes' : 'Lignes de commande',
        // CA6 : volet fige sur la ligne d en-tete.
        stickyRowsCount: 1,
        columns: columns.map((column) => ({ width: columnWidthFor(column.header) })),
      });
      const buffer = await workbook.toBuffer();
      return { ok: true, bytes: buffer };
    } catch (error) {
      return {
        ok: false,
        code: 'order_export.generation_failed',
        detail: error instanceof Error ? error.message : 'Erreur inattendue du renderer XLSX.',
      };
    }
  },
});
