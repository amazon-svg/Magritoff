/**
 * Non-regression a VOLUME REEL du renderer XLSX (story E10.18d, contrat
 * §8.24 point 7, precaution 2). Un classeur de trois lignes ne franchit
 * JAMAIS le seuil qui declenche le piege du Worker — il ne prouverait donc
 * rien. Ce test rend PLUSIEURS MILLIERS de lignes et VERIFIE que le seuil
 * est REELLEMENT franchi (mesure, pas suppose).
 *
 * ── CORRIGE (qa-review round 1, 2026-09-13) — `globalThis.Worker` NE FAIT
 * ── RIEN ICI, verifie sur le code source REELLEMENT execute sous vitest ────
 * La premiere version de ce fichier cassait `globalThis.Worker`. C etait
 * SANS EFFET : sous Node (donc sous `vitest`), le specificateur nu `fflate`
 * resout — via les `exports` conditionnels de son `package.json`, condition
 * `"node"` — sur `esm/index.mjs`, qui ne lit JAMAIS `globalThis.Worker` : il
 * fait `var require = createRequire('/')` puis
 * `Worker = require('worker_threads').Worker` **au chargement du module**.
 * Preuve directe (verifiee par execution reelle, pas supposee) : avec
 * `globalThis.Worker` casse, `write-excel-file/universal` sur 5 000 lignes
 * REND QUAND MEME un fichier valide — la sonde ne protegeait rien.
 *
 * Le VRAI point d injection, sous Node, est donc
 * `require('node:worker_threads').Worker` — PAS `globalThis.Worker` (ce
 * dernier est le point d injection sous Deno/navigateur, ou `fflate` resout
 * sur `esm/browser.js`, qui LUI lit bien `globalThis.Worker` ; c est ce
 * qu affirmait a tort le commentaire precedent en melangeant les deux
 * runtimes). `withBrokenWorkerThreads()` ci-dessous patch DIRECTEMENT
 * l objet retourne par `require('node:worker_threads')` — le MEME objet
 * singleton que `fflate` lira — puis appelle
 * `module.syncBuiltinESMExports()` pour propager la mutation aux liaisons
 * ESM. **La mutation doit intervenir AVANT le tout premier chargement de
 * `fflate` dans ce PROCESSUS** : une fois charge, `fflate` capture `Worker`
 * dans une variable de FERMETURE au niveau module, et ni `vi.resetModules()`
 * ni aucune restauration ulterieure de l objet `worker_threads` ne peut plus
 * l atteindre (verifie par execution reelle : un module npm externalise,
 * une fois evalue par le vrai chargeur ESM de Node, reste en cache pour
 * toute la duree du processus — `vi.resetModules()` ne gouverne que le
 * registre de modules de Vite/vitest, pas le cache ESM natif de Node pour
 * les paquets `node_modules`). C est pourquoi CE FICHIER **n importe
 * STATIQUEMENT ni le renderer, ni `write-excel-file`, ni `fflate`** — seul
 * un `import type` (efface a la compilation) est statique — et **casse le
 * Worker en `beforeAll`, avant tout `import()` dynamique**. Vitest isole
 * chaque fichier de test dans son propre processus (`pool` par defaut,
 * verifie par execution reelle : une pollution dans un fichier ne fuit PAS
 * vers un autre fichier), donc cette poison est sans consequence sur les
 * autres tests XLSX (`xlsx-renderer.reference.test.ts`,
 * `xlsx-renderer.test.ts`), executes dans des processus distincts.
 *
 * ── Le seuil exact, verifie sur le code source du paquet `fflate` ──────────
 * (VOCABULAIRE ALIGNE sur la treizieme correction du bandeau §8.24, point
 * (i), 2026-09-13 : « taille BRUTE de chaque fichier interne de l archive »
 * — ni « compressee », ni celle du classeur final) `fflate`
 * (`esm/index.mjs`, fonction `zip()`) decide FICHIER PAR FICHIER (a
 * l interieur de l archive `.zip`) : `size < 160000` (taille BRUTE, AVANT
 * COMPRESSION, d un fichier interne — PAS la taille du classeur final, qui
 * est environ NEUF FOIS plus petit que `sheet1.xml`) -> compression
 * SYNCHRONE (`deflateSync`) ; au-dela -> chemin
 * ASYNCHRONE (`deflate()`), qui appelle `wk()` -> `new Worker(...)` SANS
 * AUCUNE detection de disponibilite. C est ce chemin que
 * `write-excel-file/universal` emprunte (`modules/zip/zipToArrayBuffer.js`,
 * `import { zip } from 'fflate'`), et qui CASSE sous l Edge Runtime Deno
 * (aucun `Worker` fonctionnel).
 *
 * `write-excel-file/node` (l entree RETENUE ici) n emprunte JAMAIS ce
 * chemin : `modules/zip/zipToStream.js` utilise la classe `ZipDeflate`
 * (`COMPRESS_FILES_IN_PARALLEL = false`), qui repose sur `new Deflate(...)`
 * — TOUJOURS synchrone, quelle que soit la taille du fichier, JAMAIS de
 * `Worker`. Ce fichier verifie CETTE PROPRIETE EN CREUX (le rendu `/node`
 * reussit malgre le Worker casse) ET la verifie PAR CONTRASTE (un temoin
 * NEGATIF sur `/universal`, avec le MEME harnais, DOIT echouer — sinon rien
 * ne prouve que le harnais attrape quoi que ce soit, exigence explicite de
 * la qa-review).
 */
import { createRequire } from 'node:module';
import * as nodeModule from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { OrderExportRawRow } from '@/modules/order-exports/application/order-export-columns';

// ── AUCUN import statique de `fflate`, `write-excel-file` ni du renderer ──
// (seul un `import type`, efface a la compilation, figure ci-dessus) : un
// import STATIQUE de `fflate` (meme un simple `unzipSync`) s executerait au
// CHARGEMENT DE CE FICHIER, donc AVANT `beforeAll()` — bien trop tot pour
// que la casse de `worker_threads.Worker` ait le moindre effet (piege
// REELLEMENT rencontre en ecrivant ce test : une premiere version important
// `unzipSync` de `fflate` de facon statique laissait le temoin negatif
// passer au VERT a tort, `fflate` ayant deja capture un `Worker` intact
// avant que `beforeAll` ne le casse). `unzipSync` est donc importe
// DYNAMIQUEMENT plus bas, comme tout le reste.

const ROW_COUNT = 5000;
/** Seuil EXACT verifie dans le code source de `fflate` (voir en-tete de fichier). */
const FFLATE_SYNC_ASYNC_THRESHOLD_BYTES = 160_000;

function bigOrderRow(index: number): OrderExportRawRow {
  return {
    order_number: `CDE-2026-${String(index).padStart(6, '0')}`,
    quote_number: `DEV-2026-${String(index).padStart(6, '0')}`,
    order_created_at: '2026-03-15T08:00:00+00:00',
    customer_type: index % 2 === 0 ? 'company' : 'individual',
    customer_name: `Client de test numero ${index} - raison sociale suffisamment longue pour peser reellement dans le fichier produit`,
    customer_siret: '73282932000074',
    customer_vat_number: 'FR40303265045',
    customer_contact_name: 'Jean Dupont',
    customer_contact_email: 'jean.dupont@example.test',
    order_status: 'validated',
    production_step_label: 'Impression offset grand format',
    lines_subtotal: '1090.00',
    global_discount: '0.00',
    effective_discount_rate: null,
    net_total: '1090.00',
    vat_rate: '0.2000',
    vat_regime: 'metropole_fr',
    vat_amount: '218.00',
    total_incl_tax: '1308.00',
  };
}

/**
 * Sheet data MINIMALE (pas le catalogue de production) pour le TEMOIN
 * `/universal` — suffisante pour que `xl/worksheets/sheet1.xml` depasse les
 * 160 000 octets NON compresses (verifie : c est exactement cette taille,
 * pas le nombre de colonnes, qui declenche le chemin `Worker` de `fflate`).
 */
function buildWitnessSheetData(rowCount: number): unknown[][] {
  const header = ['Colonne A', 'Colonne B', 'Colonne C', 'Colonne D', 'Colonne E'];
  const rows: unknown[][] = [header.map((value) => ({ value, type: String }))];
  for (let index = 0; index < rowCount; index += 1) {
    rows.push([
      { value: `Ligne de texte suffisamment longue pour peser dans le fichier numero ${index}`, type: String },
      { value: index, type: Number },
      { value: 1234.5, type: Number, format: '0.00' },
      { value: new Date(Date.UTC(2026, 0, 1)), type: Date, format: 'yyyy-mm-dd' },
      { value: index % 2 === 0, type: Boolean },
    ]);
  }
  return rows;
}

/**
 * Casse `require('node:worker_threads').Worker` — le POINT REEL que
 * `fflate` lit sous Node, voir en-tete de fichier. `syncBuiltinESMExports()`
 * propage la mutation aux liaisons ESM de `node:worker_threads` (utile si
 * un consommateur y accede par `import` plutot que par `require`).
 */
function breakNodeWorkerThreads(): () => void {
  const req = createRequire(import.meta.url);
  const workerThreads = req('node:worker_threads') as { Worker: unknown };
  const original = workerThreads.Worker;
  workerThreads.Worker = class BrokenWorkerThreadsWorker {
    constructor() {
      throw new ReferenceError('Worker is not defined (Edge Runtime Deno simule pour ce test).');
    }
  };
  nodeModule.syncBuiltinESMExports();
  return () => {
    workerThreads.Worker = original;
    nodeModule.syncBuiltinESMExports();
  };
}

describe('xlsxOrderExportRenderer — non-regression a volume REEL, worker_threads.Worker CASSE (le vrai point d injection sous Node)', () => {
  let restoreWorkerThreads: () => void;

  beforeAll(() => {
    // DOIT s executer AVANT le premier `import()` dynamique de ce fichier
    // (aucun import statique de `fflate`/`write-excel-file` ci-dessus) —
    // voir en-tete de fichier : une fois `fflate` charge, la mutation ne
    // peut plus l atteindre.
    restoreWorkerThreads = breakNodeWorkerThreads();
  });

  afterAll(() => {
    restoreWorkerThreads();
    // Hygiene uniquement : `fflate`, une fois charge dans ce processus,
    // reste poisonne pour sa duree de vie quoi qu il arrive (voir en-tete)
    // — ce processus est de toute facon propre a ce seul fichier de test.
  });

  it(`rend ${ROW_COUNT} lignes via /node et FRANCHIT REELLEMENT le seuil fflate de ${FFLATE_SYNC_ASYNC_THRESHOLD_BYTES} octets (mesure, pas suppose)`, async () => {
    const { xlsxOrderExportRenderer } = await import('@/modules/order-exports/application/renderers/xlsx-renderer');
    const { unzipSync } = await import('fflate');
    const rows = Array.from({ length: ROW_COUNT }, (_unused, index) => bigOrderRow(index));

    const result = await xlsxOrderExportRenderer.render({ granularity: 'order', rows });

    // Le `throw` (qui porte le CODE et le DETAIL de l echec) est place AVANT
    // le `expect(result.ok).toBe(true)` — sous mutation, on lit ainsi la
    // VRAIE cause de l echec plutot que le seul « expected false to be true ».
    if (!result.ok) throw new Error(`rendu attendu OK, obtenu echec : ${result.code} ${result.detail}`);
    expect(result.ok).toBe(true);

    // Le classeur PRODUIT est lui-meme une archive ZIP valide (donc lisible
    // par `unzipSync`) MEME AVEC `worker_threads.Worker` CASSE — c est la
    // preuve comportementale que `/node` ne l a jamais sollicite.
    const files = unzipSync(result.bytes);
    const sheetEntry = Object.keys(files).find((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path));
    if (!sheetEntry) throw new Error('xl/worksheets/sheetN.xml introuvable dans le classeur produit.');

    const uncompressedSheetSize = files[sheetEntry]!.byteLength;
    const compressedFileSize = result.bytes.byteLength;

    // MESURE (pas suppose) : la feuille NON COMPRESSEE franchit reellement
    // le seuil qui, dans le chemin `/universal`, ferait basculer `fflate`
    // sur le chemin asynchrone base sur `Worker`.
    expect(uncompressedSheetSize).toBeGreaterThan(FFLATE_SYNC_ASYNC_THRESHOLD_BYTES);
    expect(compressedFileSize).toBeGreaterThan(0);

    // eslint-disable-next-line no-console -- mesure demandee par le mandat, a reporter dans le rapport de fin de story.
    console.log(
      `[xlsx-renderer volume] ${ROW_COUNT} lignes -> ` +
        `xl/worksheets/${sheetEntry.split('/').pop()} NON compresse = ${uncompressedSheetSize} octets ` +
        `(seuil fflate = ${FFLATE_SYNC_ASYNC_THRESHOLD_BYTES}) ; classeur .xlsx final (compresse) = ${compressedFileSize} octets, ` +
        `worker_threads.Worker CASSE pendant tout le rendu.`,
    );
  });

  it(
    'TEMOIN NEGATIF OBLIGATOIRE — le MEME harnais applique a write-excel-file/universal + .toBlob() ECHOUE ' +
      '(sinon rien ne prouve que le harnais attrape quoi que ce soit — exigence explicite de la qa-review)',
    async () => {
      const { default: writeExcelFileUniversal } = await import('write-excel-file/universal');
      const sheetData = buildWitnessSheetData(ROW_COUNT);

      // `toThrow()` SANS argument accepterait N IMPORTE QUELLE erreur — un
      // harnais NEUTRALISE (Worker redevenu fonctionnel) mais une donnee du
      // temoin rendue invalide par ailleurs ferait ENCORE echouer l assertion,
      // pour une raison SANS RAPPORT avec le Worker, et le harnais passerait
      // pour actif a tort (qa-review round 2, B1 residuel). Le message DOIT
      // etre celui pose par `breakNodeWorkerThreads()` ci-dessus.
      await expect(
        (async () => {
          const blob = await writeExcelFileUniversal(sheetData as never, { sheet: 'Temoin', stickyRowsCount: 1 }).toBlob();
          return blob;
        })(),
      ).rejects.toThrow(/Worker is not defined/);
    },
  );
});
