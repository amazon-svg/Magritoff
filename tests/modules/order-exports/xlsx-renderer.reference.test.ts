/**
 * Renderer XLSX de l export comptable (story E10.18d, contrat §8.24 point 5
 * regle 4/5/6, point 6 CA6, point 8 « Test A »).
 *
 * Test DE FICHIER DE REFERENCE : genere un classeur reel, le DEZIPPE
 * (`fflate`, meme discipline que le renderer CSV round 1 d E10.18c — « la
 * relecture seule ne suffit pas », ordre des colonnes) et LIT LE XML produit
 * (`xl/worksheets/sheetN.xml`, `xl/styles.xml`, `xl/sharedStrings.xml`).
 * Aucune de ces assertions ne se contente de « le renderer n a pas leve » :
 * chacune verifie un OCTET reellement ecrit.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { xlsxOrderExportRenderer } from '@/modules/order-exports/application/renderers/xlsx-renderer';
import { orderExportColumnsFor } from '@/modules/order-exports/application/order-export-columns';
import type { OrderExportGranularity, OrderExportRawRow } from '@/modules/order-exports/application/order-export-columns';

// ---------------------------------------------------------------------------
// Fixtures — memes valeurs que tests/modules/order-exports/csv-renderer.test.ts
// (memes donnees, deux renderers a comparer par un lecteur humain).
// ---------------------------------------------------------------------------

function orderRow(overrides: Partial<Record<string, unknown>> = {}): OrderExportRawRow {
  return {
    order_number: 'CDE-2026-00001',
    quote_number: 'DEV-2026-00001',
    order_created_at: '2026-03-15T08:00:00+00:00',
    customer_type: 'company',
    customer_name: 'Client Test',
    customer_siret: '73282932000074',
    customer_vat_number: 'FR40303265045',
    customer_contact_name: null,
    customer_contact_email: null,
    order_status: 'validated',
    production_step_label: 'draft',
    lines_subtotal: '1090.00',
    global_discount: '-5.00',
    effective_discount_rate: null,
    net_total: '1090.00',
    vat_rate: '0.2000',
    vat_regime: 'metropole_fr',
    vat_amount: '218.00',
    total_incl_tax: '1308.50',
    ...overrides,
  };
}

function lineRow(overrides: Partial<Record<string, unknown>> = {}): OrderExportRawRow {
  return {
    order_number: 'CDE-2026-00001',
    quote_number: 'DEV-2026-00001',
    order_created_at: '2026-03-15T08:00:00+00:00',
    customer_type: 'individual',
    customer_name: 'Alix Bernard',
    customer_siret: null,
    customer_vat_number: null,
    customer_contact_name: 'Jean Dupont',
    customer_contact_email: 'jean.dupont@example.test',
    order_status: 'validated',
    production_step_label: 'draft',
    line_position: 0,
    line_label: 'Depliants A5',
    quantity: 3,
    bracket_amount_excl_tax: '1100.00',
    discount_rate: '-0.0909',
    unit_price_indicative: '333.3333',
    sale_price: '1000.00',
    ...overrides,
  };
}

const EXPECTED_SHARED_HEADERS = [
  'Numéro de commande',
  "Devis d'origine",
  'Date de commande',
  'Type de client',
  'Client',
  'SIRET',
  'Numéro de TVA',
  'Interlocuteur',
  'Courriel interlocuteur',
  'Statut commercial',
  'Étape de production',
];

const EXPECTED_ORDER_HEADERS = [
  ...EXPECTED_SHARED_HEADERS,
  'Total lignes HT',
  'Remise globale',
  'Taux de remise effectif',
  'Net HT',
  'Taux de TVA',
  'Régime de TVA',
  'Montant TVA',
  'Total TTC',
];

const EXPECTED_LINE_HEADERS = [
  ...EXPECTED_SHARED_HEADERS,
  'Position',
  'Désignation',
  'Quantité',
  'Montant HT barème (avant remise)',
  'Taux de remise ligne',
  'PU HT indicatif',
  'Montant HT',
];

// ---------------------------------------------------------------------------
// Lecture minimale du XLSX produit — regex-based, PAS un parseur XML complet
// (aucune dependance DOM dans l environnement `node` de vitest). Suffisant
// pour la structure simple, connue et STABLE produite par `write-excel-file`
// (verifie contre le code source du paquet, pas suppose).
// ---------------------------------------------------------------------------

type ParsedCell = Readonly<{
  ref: string;
  column: string;
  rowNumber: number;
  style: number | null;
  type: string | null;
  rawValue: string | null;
}>;

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&');
}

function parseAttributes(attributeSource: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attributeRegex = /([\w:.-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = attributeRegex.exec(attributeSource))) {
    attributes[match[1]!] = decodeXmlEntities(match[2]!);
  }
  return attributes;
}

function parseRowCells(rowInner: string): ParsedCell[] {
  const cellRegex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  const cells: ParsedCell[] = [];
  let match: RegExpExecArray | null;
  while ((match = cellRegex.exec(rowInner))) {
    const attributes = parseAttributes(match[1] ?? '');
    const inner = match[2] ?? null;
    const valueMatch = inner ? /<v>([\s\S]*?)<\/v>/.exec(inner) : null;
    const ref = attributes.r ?? '';
    const refMatch = /^([A-Z]+)(\d+)$/.exec(ref);
    cells.push({
      ref,
      column: refMatch?.[1] ?? '',
      rowNumber: refMatch ? Number(refMatch[2]) : -1,
      style: attributes.s !== undefined ? Number(attributes.s) : null,
      type: attributes.t ?? null,
      rawValue: valueMatch ? decodeXmlEntities(valueMatch[1]!) : null,
    });
  }
  return cells;
}

function parseSheetRows(sheetXml: string): ParsedCell[][] {
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  const rows: ParsedCell[][] = [];
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(sheetXml))) {
    rows.push(parseRowCells(match[1]!));
  }
  return rows;
}

function parseSharedStrings(sharedStringsXml: string): string[] {
  const siRegex = /<si>([\s\S]*?)<\/si>/g;
  const strings: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = siRegex.exec(sharedStringsXml))) {
    const textMatch = /<t[^>]*>([\s\S]*?)<\/t>/.exec(match[1]!);
    strings.push(textMatch ? decodeXmlEntities(textMatch[1]!) : '');
  }
  return strings;
}

function parseNumFmts(stylesXml: string): Map<number, string> {
  const block = /<numFmts\b[^>]*>([\s\S]*?)<\/numFmts>/.exec(stylesXml)?.[1] ?? '';
  const numFmtRegex = /<numFmt\b([^>]*?)\/>/g;
  const map = new Map<number, string>();
  let match: RegExpExecArray | null;
  while ((match = numFmtRegex.exec(block))) {
    const attributes = parseAttributes(match[1]!);
    if (attributes.numFmtId !== undefined) map.set(Number(attributes.numFmtId), attributes.formatCode ?? '');
  }
  return map;
}

function parseCellXfs(stylesXml: string): Array<{ numFmtId: number | null }> {
  const block = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml)?.[1] ?? '';
  // `write-excel-file` emet `<xf ...></xf>` (PAS auto-fermant), meme quand
  // le contenu est vide (`<xf ></xf>`) — verifie sur le fichier REELLEMENT
  // produit, pas suppose : la forme auto-fermante n apparait jamais ici.
  const xfRegex = /<xf\b([^>]*?)>[\s\S]*?<\/xf>/g;
  const xfs: Array<{ numFmtId: number | null }> = [];
  let match: RegExpExecArray | null;
  while ((match = xfRegex.exec(block))) {
    const attributes = parseAttributes(match[1]!);
    xfs.push({ numFmtId: attributes.numFmtId !== undefined ? Number(attributes.numFmtId) : null });
  }
  return xfs;
}

function columnLetter(zeroBasedIndex: number): string {
  let n = zeroBasedIndex + 1;
  let letters = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

type RenderedWorkbook = Readonly<{
  sheetXml: string;
  stylesXml: string;
  sharedStrings: string[];
  numFmts: Map<number, string>;
  cellXfs: Array<{ numFmtId: number | null }>;
  rows: ParsedCell[][];
}>;

async function renderAndUnzip(
  granularity: OrderExportGranularity,
  rows: readonly OrderExportRawRow[],
): Promise<RenderedWorkbook> {
  const result = await xlsxOrderExportRenderer.render({ granularity, rows });
  if (!result.ok) throw new Error(`rendu attendu OK, obtenu echec : ${result.code} ${result.detail}`);

  const files = unzipSync(result.bytes);
  const sheetEntry = Object.keys(files).find((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path));
  if (!sheetEntry) throw new Error('xl/worksheets/sheetN.xml introuvable dans le classeur produit.');

  const decoder = new TextDecoder('utf-8');
  const sheetXml = decoder.decode(files[sheetEntry]!);
  const stylesXml = decoder.decode(files['xl/styles.xml']!);
  const sharedStringsBytes = files['xl/sharedStrings.xml'];
  const sharedStrings = sharedStringsBytes ? parseSharedStrings(decoder.decode(sharedStringsBytes)) : [];

  return {
    sheetXml,
    stylesXml,
    sharedStrings,
    numFmts: parseNumFmts(stylesXml),
    cellXfs: parseCellXfs(stylesXml),
    rows: parseSheetRows(sheetXml),
  };
}

function resolveCellText(cell: ParsedCell, sharedStrings: readonly string[]): string | null {
  if (cell.rawValue === null) return null;
  if (cell.type === 's') return sharedStrings[Number(cell.rawValue)] ?? null;
  return cell.rawValue;
}

function numFmtOf(cell: ParsedCell, workbook: RenderedWorkbook): string | null {
  if (cell.style === null) return null;
  const xf = workbook.cellXfs[cell.style];
  if (!xf || xf.numFmtId === null) return null;
  return workbook.numFmts.get(xf.numFmtId) ?? null;
}

function findCell(row: readonly ParsedCell[], column: string): ParsedCell | undefined {
  return row.find((cell) => cell.column === column);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('xlsxOrderExportRenderer — volet fige (CA6)', () => {
  it('pose un <pane .../> avec state="frozen" (stickyRowsCount: 1)', async () => {
    const workbook = await renderAndUnzip('order', [orderRow()]);
    expect(workbook.sheetXml).toMatch(/<pane\b[^>]*state="frozen"[^>]*\/>/);
  });
});

describe('xlsxOrderExportRenderer — date de commande (Europe/Paris PUIS Date.UTC, ordre impose)', () => {
  it(
    '1er du mois a 00h30 Paris (= veille 22h30 UTC en ete) : la cellule porte le 1er, SERIE ENTIERE ' +
      '(mesure du 2026-09-12 : intervertir l ordre decale d un jour une commande de debut de mois)',
    async () => {
      const workbook = await renderAndUnzip('order', [orderRow({ order_created_at: '2026-08-31T22:30:00+00:00' })]);
      const dataRow = workbook.rows[1]!;
      const dateCell = findCell(dataRow, columnLetter(2))!;
      // Formule Excel documentee (`convertDateToSerialNumber.js` du paquet,
      // NON reimplementee en production — ici, seulement pour PROUVER la
      // valeur exacte attendue) : jours depuis l epoque Excel (1900-01-01),
      // via l epoque Unix. Reproduit ici a des fins de VERIFICATION externe
      // uniquement, aucune de ces deux lignes ne vit dans le renderer.
      const daysBeforeUnixEpoch = 70 * 365 + 19;
      const expectedSerial = Date.UTC(2026, 8, 1) / 86_400_000 + daysBeforeUnixEpoch;
      expect(Number(dateCell.rawValue)).toBe(expectedSerial);
      expect(Number.isInteger(Number(dateCell.rawValue))).toBe(true);
    },
  );

  it('un instant UTC de fin de journee en France (hiver, decalage +1h) reste dans la BONNE date civile', async () => {
    const workbook = await renderAndUnzip('order', [orderRow({ order_created_at: '2026-03-15T00:30:00+00:00' })]);
    const dataRow = workbook.rows[1]!;
    const dateCell = findCell(dataRow, columnLetter(2))!;
    const daysBeforeUnixEpoch = 70 * 365 + 19;
    const expectedSerial = Date.UTC(2026, 2, 15) / 86_400_000 + daysBeforeUnixEpoch;
    expect(Number(dateCell.rawValue)).toBe(expectedSerial);
  });
});

describe(
  'xlsxOrderExportRenderer — Date.UTC prouve INDEPENDAMMENT du fuseau de la machine qui execute le test (qa-review round 1, M3)',
  () => {
    const originalTZ = process.env.TZ;

    beforeAll(() => {
      // Fuseau NON-UTC FORCE, quel que soit celui de la machine qui execute
      // ce test. MOTIF EXACT (qa-review) : les deux tests ci-dessus ne
      // prouvaient la regle QUE sur une machine dont le fuseau AMBIANT
      // differe de UTC (ce qui etait le cas de la machine de developpement).
      // Sous `TZ=UTC` (le reglage typique d un runner CI), le constructeur
      // LOCAL `new Date(annee, mois, jour)` — celui de la mutation a
      // detecter — produit EXACTEMENT le meme instant que
      // `Date.UTC(annee, mois, jour)` (local == UTC quand le fuseau local
      // EST UTC) : la mutation ne faisait alors tomber AUCUN test. En
      // forcant ICI un fuseau non-UTC, la difference entre les deux
      // constructeurs redevient observable QUEL QUE SOIT le fuseau ambiant
      // de la machine — prouve ci-dessous en executant volontairement ce
      // fichier avec `TZ=UTC` cote machine (voir le rapport de fin de
      // story pour la preuve par mutation).
      process.env.TZ = 'America/Los_Angeles';
    });

    afterAll(() => {
      if (originalTZ === undefined) delete process.env.TZ;
      else process.env.TZ = originalTZ;
    });

    it('la serie de date est INCHANGEE sous TZ=America/Los_Angeles (Date.UTC ignore par construction le fuseau local)', async () => {
      const workbook = await renderAndUnzip('order', [orderRow({ order_created_at: '2026-08-31T22:30:00+00:00' })]);
      const dataRow = workbook.rows[1]!;
      const dateCell = findCell(dataRow, columnLetter(2))!;
      const daysBeforeUnixEpoch = 70 * 365 + 19;
      const expectedSerial = Date.UTC(2026, 8, 1) / 86_400_000 + daysBeforeUnixEpoch;
      expect(Number(dateCell.rawValue)).toBe(expectedSerial);
      expect(Number.isInteger(Number(dateCell.rawValue))).toBe(true);
    });
  },
);

describe.each([
  ['order', () => [orderRow()], EXPECTED_ORDER_HEADERS] as const,
  ['line', () => [lineRow()], EXPECTED_LINE_HEADERS] as const,
])('xlsxOrderExportRenderer — granularite %s', (granularity, buildRows, expectedHeaders) => {
  it('en-tetes dans l ordre EXACT du contrat (openapi/magrit-core.v1.yaml, OrderExportGranularity, SEULE source d ordre)', async () => {
    const workbook = await renderAndUnzip(granularity, buildRows());
    const headerRow = workbook.rows[0]!;
    const headerTexts = [...headerRow]
      .sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true }))
      .map((cell) => resolveCellText(cell, workbook.sharedStrings));
    expect(headerTexts).toEqual(expectedHeaders);
    // Correspondance de longueur avec le catalogue TypeScript (copie de
    // confort, jamais la source — voir order-export-columns.ts en-tete).
    expect(headerRow).toHaveLength(orderExportColumnsFor(granularity).length);
  });

  it('pose une largeur de colonne explicite pour CHAQUE colonne (<cols><col .../></cols>)', async () => {
    const workbook = await renderAndUnzip(granularity, buildRows());
    const columnCount = orderExportColumnsFor(granularity).length;
    const colMatches = workbook.sheetXml.match(/<col\b[^>]*\/>/g) ?? [];
    expect(colMatches).toHaveLength(columnCount);
    for (const col of colMatches) expect(col).toContain('customWidth="1"');
  });

  it('cellules NUMERIQUES sans t="s" ni t="inlineStr" — montants et dates', async () => {
    const workbook = await renderAndUnzip(granularity, buildRows());
    const dataRow = workbook.rows[1]!;
    // "Date de commande" est la 3e colonne des deux granularites (index 2).
    const dateCell = findCell(dataRow, columnLetter(2));
    expect(dateCell?.type).toBeNull();
    const orderColumns = orderExportColumnsFor(granularity);
    const moneyColumnIndex = orderColumns.findIndex((column) => column.cell(buildRows()[0]!).kind === 'money');
    expect(moneyColumnIndex).toBeGreaterThanOrEqual(0);
    const moneyCell = findCell(dataRow, columnLetter(moneyColumnIndex));
    expect(moneyCell?.type).toBeNull();
  });

  it('date "Date de commande" : serie ENTIERE (Date.UTC, jamais de fraction horaire) et numFmt yyyy-mm-dd', async () => {
    const workbook = await renderAndUnzip(granularity, buildRows());
    const dataRow = workbook.rows[1]!;
    const dateCell = findCell(dataRow, columnLetter(2))!;
    expect(dateCell.rawValue).not.toBeNull();
    expect(Number(dateCell.rawValue)).toBeGreaterThan(0);
    // Serie ENTIERE : aucune part fractionnaire (contrat point 5 regle 6).
    expect(Number.isInteger(Number(dateCell.rawValue))).toBe(true);
    expect(numFmtOf(dateCell, workbook)).toBe('yyyy-mm-dd');
  });

  it('cellule NULLE -> ABSENTE du XML (jamais 0, jamais un tiret) — "Interlocuteur" force a null pour ce test', async () => {
    // `customer_contact_name` est deja nul par defaut dans `orderRow()` mais
    // renseigne dans `lineRow()` — on le force explicitement a `null` ici
    // pour que ce test vaille IDENTIQUEMENT pour les deux granularites.
    const rows = buildRows().map((row) => ({ ...row, customer_contact_name: null }));
    const workbook = await renderAndUnzip(granularity, rows);
    const dataRow = workbook.rows[1]!;
    const interlocuteurCell = findCell(dataRow, columnLetter(7)); // "Interlocuteur", 8e colonne partagee.
    expect(interlocuteurCell).toBeUndefined();
  });

  it('traduit les codes techniques (order_status, customer_type, vat_regime pour `order`) — jamais de code brut', async () => {
    const workbook = await renderAndUnzip(granularity, buildRows());
    expect(workbook.sharedStrings).toContain('Validée');
    expect(workbook.sharedStrings).not.toContain('validated');
    if (granularity === 'order') {
      expect(workbook.sharedStrings).toContain('Société');
      expect(workbook.sharedStrings).not.toContain('company');
      expect(workbook.sharedStrings).toContain('France métropolitaine');
      expect(workbook.sharedStrings).not.toContain('metropole_fr');
    } else {
      expect(workbook.sharedStrings).toContain('Particulier');
      expect(workbook.sharedStrings).not.toContain('individual');
    }
  });

  it('NE traduit PAS « Étape de production » — piège inverse, "draft" reste "draft"', async () => {
    const workbook = await renderAndUnzip(granularity, buildRows());
    expect(workbook.sharedStrings).toContain('draft');
  });
});

describe('xlsxOrderExportRenderer — granularite `order` (formats de nombre)', () => {
  it('"Total lignes HT"/"Total TTC" : numFmt 0.00, valeur numerique NATIVE (pas de zeros de queue en trop)', async () => {
    const workbook = await renderAndUnzip('order', [orderRow({ total_incl_tax: '1308.50' })]);
    const dataRow = workbook.rows[1]!;
    const totalTtcCell = findCell(dataRow, columnLetter(EXPECTED_ORDER_HEADERS.indexOf('Total TTC')))!;
    expect(totalTtcCell.rawValue).toBe('1308.5');
    expect(numFmtOf(totalTtcCell, workbook)).toBe('0.00');
  });

  it('un montant negatif (remise globale) est ecrit tel quel, jamais denature', async () => {
    const workbook = await renderAndUnzip('order', [orderRow({ global_discount: '-5.00' })]);
    const dataRow = workbook.rows[1]!;
    const remiseCell = findCell(dataRow, columnLetter(EXPECTED_ORDER_HEADERS.indexOf('Remise globale')))!;
    expect(remiseCell.rawValue).toBe('-5');
  });

  it(
    // TRANCHE PAR L ARCHITECTE (onzieme correction du bandeau §8.24,
    // 2026-09-13, voir xlsx-renderer.ts, NUMBER_FORMAT_BY_CELL_KIND) :
    // `0.0000` sur TOUT `rate`, sans exception — plus une reserve ouverte.
    '"Taux de TVA" (kind rate) : numFmt 0.0000 (arbitrage architecte, sans exception), valeur native sans zeros de queue',
    async () => {
      const workbook = await renderAndUnzip('order', [orderRow({ vat_rate: '0.2000' })]);
      const dataRow = workbook.rows[1]!;
      const vatRateCell = findCell(dataRow, columnLetter(EXPECTED_ORDER_HEADERS.indexOf('Taux de TVA')))!;
      expect(vatRateCell.rawValue).toBe('0.2');
      expect(numFmtOf(vatRateCell, workbook)).toBe('0.0000');
    },
  );

  it(
    'BLOQUANT (qa-review B2) — une cellule MONEY ou RATE nulle est ABSENTE du XML, jamais 0 ' +
      '("Total lignes HT" et "Taux de remise effectif")',
    async () => {
      const workbook = await renderAndUnzip('order', [orderRow({ lines_subtotal: null, effective_discount_rate: null })]);
      const dataRow = workbook.rows[1]!;
      const totalLignesCell = findCell(dataRow, columnLetter(EXPECTED_ORDER_HEADERS.indexOf('Total lignes HT')));
      const tauxRemiseCell = findCell(dataRow, columnLetter(EXPECTED_ORDER_HEADERS.indexOf('Taux de remise effectif')));
      expect(totalLignesCell, '"Total lignes HT" (money) doit etre ABSENTE, jamais 0').toBeUndefined();
      expect(tauxRemiseCell, '"Taux de remise effectif" (rate) doit etre ABSENTE, jamais 0').toBeUndefined();
    },
  );
});

describe('xlsxOrderExportRenderer — granularite `line` (colonne "PU HT indicatif")', () => {
  it('333,3333 (1000,00 / 3) preserve toutes ses decimales, jamais remultiplie ni arrondi davantage', async () => {
    const workbook = await renderAndUnzip('line', [lineRow({ unit_price_indicative: '333.3333', sale_price: '1000.00' })]);
    const dataRow = workbook.rows[1]!;
    const puCell = findCell(dataRow, columnLetter(EXPECTED_LINE_HEADERS.indexOf('PU HT indicatif')))!;
    expect(puCell.rawValue).toBe('333.3333');
    expect(numFmtOf(puCell, workbook)).toBe('0.0000');
  });

  it('0,0900 (90,00 / 1000) : valeur STOCKEE 0.09 (nombre natif), AFFICHAGE 4 decimales porte par le format, jamais par la valeur', async () => {
    const workbook = await renderAndUnzip('line', [lineRow({ unit_price_indicative: '0.0900' })]);
    const dataRow = workbook.rows[1]!;
    const puCell = findCell(dataRow, columnLetter(EXPECTED_LINE_HEADERS.indexOf('PU HT indicatif')))!;
    // La valeur NATIVE est 0.09 (Number), PAS la chaine "0.0900" — c est le
    // style de cellule (numFmt 0.0000) qui fera afficher "0,0900" dans
    // Excel, jamais une chaine formatee cote serveur (contrat, interdit
    // explicite du Dev Note).
    expect(puCell.rawValue).toBe('0.09');
    expect(numFmtOf(puCell, workbook)).toBe('0.0000');
  });

  it(
    'BLOQUANT (qa-review B2) — une cellule MONEY ou RATE nulle est ABSENTE du XML, jamais 0 ' +
      '("Montant HT barème (avant remise)" et "Taux de remise ligne")',
    async () => {
      const workbook = await renderAndUnzip('line', [lineRow({ bracket_amount_excl_tax: null, discount_rate: null })]);
      const dataRow = workbook.rows[1]!;
      const baremeCell = findCell(dataRow, columnLetter(EXPECTED_LINE_HEADERS.indexOf('Montant HT barème (avant remise)')));
      const tauxRemiseLigneCell = findCell(dataRow, columnLetter(EXPECTED_LINE_HEADERS.indexOf('Taux de remise ligne')));
      expect(baremeCell, '"Montant HT barème (avant remise)" (money) doit etre ABSENTE, jamais 0').toBeUndefined();
      expect(tauxRemiseLigneCell, '"Taux de remise ligne" (rate) doit etre ABSENTE, jamais 0').toBeUndefined();
    },
  );
});

describe('xlsxOrderExportRenderer — verdict (jamais de throw vers l appelant)', () => {
  it('une valeur decimale invalide (colonne money/rate) rend ok:false, order_export.generation_failed', async () => {
    const result = await xlsxOrderExportRenderer.render({
      granularity: 'order',
      rows: [orderRow({ total_incl_tax: 'not-a-number' })],
    });
    expect(result).toMatchObject({ ok: false, code: 'order_export.generation_failed' });
  });

  it('une valeur d enumeration inconnue (order_status) rend ok:false, jamais un code brut silencieux', async () => {
    const result = await xlsxOrderExportRenderer.render({
      granularity: 'order',
      rows: [orderRow({ order_status: 'cancelled' })],
    });
    expect(result).toMatchObject({ ok: false, code: 'order_export.generation_failed' });
  });
});

// ---------------------------------------------------------------------------
// Comparaison COLONNE PAR COLONNE contre la table de l ordre (contrat
// §8.24, `OrderExportGranularity` de l OpenAPI — SEULE source d ordre ;
// voir en-tete de `order-export-columns.ts`) — qa-review round 1, M2. Les
// tests precedents ne couvraient JAMAIS le numFmt de « Taux de remise
// effectif » ni de « Taux de remise ligne » : ce tableau les couvre, ainsi
// que TOUTES les autres colonnes, en un seul test lisible colonne par
// colonne (intitule, position, type de cellule, numFmt).
// ---------------------------------------------------------------------------

type ExpectedColumnKind = 'text' | 'integer' | 'money' | 'rate' | 'date';

type ExpectedColumn = Readonly<{ header: string; kind: ExpectedColumnKind }>;

/** Cellules ATTENDUES pour un `t=` XML donne — `null` = pas d attribut `t` (numerique/date, defaut). */
const CELL_TYPE_ATTRIBUTE_BY_KIND: Readonly<Record<ExpectedColumnKind, string | null>> = {
  text: 's',
  integer: null,
  money: null,
  rate: null,
  date: null,
};

/** `numFmt` ATTENDU par famille — `null` = aucun style pose (texte, format General). */
const EXPECTED_NUMFMT_BY_KIND: Readonly<Record<ExpectedColumnKind, string | null>> = {
  text: null,
  integer: '0',
  money: '0.00',
  rate: '0.0000',
  date: 'yyyy-mm-dd',
};

const EXPECTED_SHARED_COLUMNS: readonly ExpectedColumn[] = [
  { header: 'Numéro de commande', kind: 'text' },
  { header: "Devis d'origine", kind: 'text' },
  { header: 'Date de commande', kind: 'date' },
  { header: 'Type de client', kind: 'text' },
  { header: 'Client', kind: 'text' },
  { header: 'SIRET', kind: 'text' },
  { header: 'Numéro de TVA', kind: 'text' },
  { header: 'Interlocuteur', kind: 'text' },
  { header: 'Courriel interlocuteur', kind: 'text' },
  { header: 'Statut commercial', kind: 'text' },
  { header: 'Étape de production', kind: 'text' },
];

const EXPECTED_ORDER_COLUMNS: readonly ExpectedColumn[] = [
  ...EXPECTED_SHARED_COLUMNS,
  { header: 'Total lignes HT', kind: 'money' },
  { header: 'Remise globale', kind: 'money' },
  { header: 'Taux de remise effectif', kind: 'rate' },
  { header: 'Net HT', kind: 'money' },
  { header: 'Taux de TVA', kind: 'rate' },
  { header: 'Régime de TVA', kind: 'text' },
  { header: 'Montant TVA', kind: 'money' },
  { header: 'Total TTC', kind: 'money' },
];

const EXPECTED_LINE_COLUMNS: readonly ExpectedColumn[] = [
  ...EXPECTED_SHARED_COLUMNS,
  { header: 'Position', kind: 'integer' },
  { header: 'Désignation', kind: 'text' },
  { header: 'Quantité', kind: 'integer' },
  { header: 'Montant HT barème (avant remise)', kind: 'money' },
  { header: 'Taux de remise ligne', kind: 'rate' },
  { header: 'PU HT indicatif', kind: 'rate' },
  { header: 'Montant HT', kind: 'money' },
];

describe.each([
  [
    'order',
    () => [orderRow({ customer_contact_name: 'Jean Dupont', customer_contact_email: 'jean.dupont@example.test', effective_discount_rate: '0.0500' })],
    EXPECTED_ORDER_COLUMNS,
  ] as const,
  ['line', () => [lineRow({ customer_siret: '73282932000074', customer_vat_number: 'FR40303265045' })], EXPECTED_LINE_COLUMNS] as const,
])(
  'xlsxOrderExportRenderer — granularite %s : comparaison COLONNE PAR COLONNE contre OrderExportGranularity (qa-review M2)',
  (granularity, buildRows, expectedColumns) => {
    it('intitule, position, type de cellule ET numFmt EXACTS pour CHAQUE colonne (toutes valeurs non nulles pour ce test)', async () => {
      const workbook = await renderAndUnzip(granularity, buildRows());
      const headerRow = [...workbook.rows[0]!].sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true }));
      const dataRow = [...workbook.rows[1]!].sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true }));

      expect(headerRow, 'nombre de colonnes dans l en-tete').toHaveLength(expectedColumns.length);

      expectedColumns.forEach((expected, index) => {
        const headerCell = headerRow[index];
        expect(headerCell, `en-tete manquant a la position ${index + 1} (attendu "${expected.header}")`).toBeDefined();
        expect(resolveCellText(headerCell!, workbook.sharedStrings), `intitule a la position ${index + 1}`).toBe(
          expected.header,
        );

        const valueCell = dataRow.find((cell) => cell.column === headerCell!.column);
        expect(valueCell, `cellule de donnees absente pour "${expected.header}" (fixture censee etre non nulle)`).toBeDefined();
        expect(valueCell!.type, `type de cellule XML ('t=') pour "${expected.header}"`).toBe(
          CELL_TYPE_ATTRIBUTE_BY_KIND[expected.kind],
        );
        expect(numFmtOf(valueCell!, workbook), `numFmt pour "${expected.header}"`).toBe(
          EXPECTED_NUMFMT_BY_KIND[expected.kind],
        );
      });
    });
  },
);
