/**
 * Garde-fous opposables sur la bibliotheque XLSX (story E10.18d, contrat
 * §8.24 point 7, precautions 1 et 2).
 *
 * PRECAUTION 1 — `write-excel-file/universal` NE DOIT JAMAIS etre importe
 * nulle part dans le depot. MESURE (banc `supabase/edge-runtime:v1.69.12`,
 * 2026-09-12 ; VOCABULAIRE ALIGNE sur la treizieme correction du bandeau
 * §8.24, point (i), 2026-09-13) : `fflate` y bascule sur un Worker des que
 * la TAILLE BRUTE (AVANT COMPRESSION) d un fichier INTERNE A L ARCHIVE
 * depasse 160 Ko — jamais « les donnees compressees » (formulation
 * precedente, imprecise), et jamais la taille du classeur final (environ
 * NEUF FOIS plus petit que `sheet1.xml`). Le Worker n est PAS implemente
 * dans l Edge Runtime Deno — ca casse vers 2 000 lignes et passe a 1 000,
 * donc ca survit a tous les tests de developpement et tombe en production.
 *
 * PRECAUTION 2 — la version est EPINGLEE EXACTEMENT (jamais un intervalle
 * semver) dans `package.json` ET dans l import-map Deno de l Edge Function
 * `magrit-order-export-runner`, POUR LES DEUX PAQUETS `write-excel-file`
 * ET `fflate` (complete le 2026-09-13, treizieme entree du bandeau §8.24,
 * point (ii)) : l entree `/node` de `write-excel-file` n evite le Worker
 * que grace a une CONSTANTE INTERNE NON EXPORTEE
 * (`COMPRESS_FILES_IN_PARALLEL = false`, un detail d implementation que
 * rien n empeche une version mineure de changer) — ET `write-excel-file`
 * 4.1.1 declare sa propre dependance `fflate` en INTERVALLE semver
 * (`^0.8.2`), donc SANS un epinglage cote Deno qui lui est PROPRE, la
 * version transitive resolue peut deriver independamment de celle testee.
 * MESURE (execution reelle dans `supabase/edge-runtime:v1.69.12`) : NI une
 * entree d import map SEULE NI un `deno.lock` ne figent la version
 * transitive — SEUL un IMPORT REEL de `fflate`, a version exacte dans
 * l import-map, le fait. D ou la troisieme garde ci-dessous : l import
 * reel de `fflate` doit exister dans `xlsx-renderer.ts`.
 *
 * CORRIGE (qa-review round 1, 2026-09-13) — le motif precedent ratait
 * plusieurs formes reelles d importation (`await import('write-excel-file/universal')`,
 * `import 'write-excel-file/universal'` en effet de bord, une entree
 * d import-map Deno citant `npm:write-excel-file@X.Y.Z/universal`) et
 * `git grep` sans `--untracked` ne voyait meme pas un fichier nouvellement
 * cree et pas encore ajoute a l index (exactement l etat de
 * `xlsx-renderer.ts` pendant une bonne partie de ce lot). Remplace par UN
 * SEUL motif large : toute chaine ENTRE GUILLEMETS DROITS (jamais des
 * guillemets typographiques ni des accents graves, ce qui exclut les
 * commentaires de ce depot — tous ecrits avec des accents graves) qui
 * correspond a `(npm:)?write-excel-file(@version)?/universal` — peu importe
 * la syntaxe qui l entoure (`from`, `require(`, `import(`, `import '...'`,
 * ou une valeur JSON d import-map).
 *
 * CORRIGE (qa-review round 3, 2026-09-13) — le motif precedent (une regex
 * sur le TEXTE SOURCE, ancree en debut de ligne) restait VERT sur un
 * import COMMENTE dont l instruction occupe seule sa ligne :
 *   /*
 *   import 'fflate';
 *   *\/
 * L ancrage `^...$/m` ne distingue pas une ligne de CODE d une ligne DE
 * COMMENTAIRE — c est precisement la meme famille de faiblesse que celle
 * deja corrigee pour `/universal` au round 1, mais pour les BLOCS
 * commentes plutot que les CITATIONS en prose. **Correctif definitif** :
 * les verifications sur des fichiers `.ts` ne lisent plus jamais le TEXTE
 * SOURCE par regex — elles PARSENT le fichier avec le compilateur
 * TypeScript (`ts.createSourceFile`) et parcourent les VRAIS noeuds
 * `ImportDeclaration`/`import()`/`require()` de l AST. Un commentaire, de
 * quelque forme qu il soit (`//`, `/* *\/`, un bloc JSDoc), n a JAMAIS de
 * representation dans l AST : aucune regex, si prudente soit-elle, ne
 * peut offrir cette garantie — seul un PARSEUR REEL le peut. `git grep`
 * reste utilise UNIQUEMENT pour les fichiers SANS syntaxe de commentaire
 * a distinguer d un import (`deno.json`, JSON pur : toute occurrence
 * entre guillemets droits y est une VALEUR, jamais un commentaire).
 *
 * CORRIGE (qa-review round 4, 2026-09-13) — REGRESSION introduite par le
 * passage a l AST du round 3 : `hasRealImportMatching` ne reconnaissait que
 * `ImportDeclaration`/`import()`/`require()`, pas les formes qui CHARGENT
 * pourtant un module a l execution SANS etre un `import` au sens strict :
 * une reexportation `export { x } from '<spec>'` ou `export * from '<spec>'`
 * (`ExportDeclaration` avec `moduleSpecifier`), et l ancienne syntaxe CJS
 * `import x = require('<spec>')` (`ImportEqualsDeclaration` avec une
 * `ExternalModuleReference`). Les deux sont desormais reconnues (a
 * l exclusion de leurs variantes `type`, qui n executent jamais rien).
 * Egalement corrige : le motif `git grep` de PRESELECTION des candidats
 * n acceptait que les guillemets droits (`'`/`"`), jamais l accent grave —
 * un `import(\`write-excel-file/universal\`)` (gabarit de texte SANS
 * substitution, deja reconnu par l AST via `NoSubstitutionTemplateLiteral`)
 * ne rendait donc jamais le fichier CANDIDAT, et l AST qui l aurait pourtant
 * detecte ne le voyait jamais. `.mts`/`.cts` route desormais explicitement
 * par l AST (meme syntaxe de commentaire que `.ts`), plutot que par le
 * comportement « tout candidat non .ts/.tsx est un contrevenant » qui ne
 * les couvrait que par accident.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const RENDERER_PATH = 'src/modules/order-exports/application/renderers/xlsx-renderer.ts';
const DENO_JSON_PATH = 'supabase/functions/magrit-order-export-runner/deno.json';

function readPackageJsonDependencies(): Record<string, string> {
  const packageJson = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  return packageJson.dependencies ?? {};
}

function readDenoImportMap(): Record<string, string> {
  const denoJson = JSON.parse(readFileSync(resolve(projectRoot, DENO_JSON_PATH), 'utf8')) as {
    imports?: Record<string, string>;
  };
  return denoJson.imports ?? {};
}

function parseTypeScriptFile(relativePath: string): ts.SourceFile {
  const absolutePath = resolve(projectRoot, relativePath);
  const sourceText = readFileSync(absolutePath, 'utf8');
  return ts.createSourceFile(
    absolutePath,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
    relativePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS, // .ts/.mts/.cts partagent la meme syntaxe d import/commentaire
  );
}

/**
 * Parcourt REELLEMENT l AST (jamais le texte source par regex) a la
 * recherche d une importation REELLE — `import ... from '<spec>'`,
 * `import '<spec>'` (effet de bord), `import('<spec>')` (dynamique), ou
 * `require('<spec>')` — dont le specificateur satisfait `matches`. Un
 * `import type` est EXCLU : efface a la compilation, il ne peut RIEN
 * figer a l execution (Deno). Un COMMENTAIRE, quelle que soit sa forme,
 * n a jamais de noeud AST : cette fonction ne peut PAS etre trompee par
 * un import commente, contrairement a une regex sur le texte source
 * (piege reel, corrige en qa-review round 3 — voir l en-tete de fichier).
 */
function hasRealImportMatching(sourceFile: ts.SourceFile, matches: (specifier: string) => boolean): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly && ts.isStringLiteralLike(node.moduleSpecifier)) {
      if (matches(node.moduleSpecifier.text)) {
        found = true;
        return;
      }
    }
    // Reexportation `export { ... } from '<spec>'` ou `export * from '<spec>'`
    // (avec ou sans `as ns`) : CHARGE le module vise a l execution, au meme
    // titre qu un `import ... from`. Seule `export type { ... } from` (ou
    // `export * from` avec `isTypeOnly`) est exclue : effacee a la
    // compilation, elle ne charge jamais rien en Deno (qa-review round 4).
    if (
      ts.isExportDeclaration(node) &&
      !node.isTypeOnly &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      if (matches(node.moduleSpecifier.text)) {
        found = true;
        return;
      }
    }
    // `import x = require('<spec>')` (ImportEqualsDeclaration avec une
    // reference de module EXTERNE) : forme CJS historique, toujours un
    // chargement REEL a l execution. `import type x = require(...)` est
    // exclu (isTypeOnly) — meme raisonnement que les deux cas ci-dessus.
    if (
      ts.isImportEqualsDeclaration(node) &&
      !node.isTypeOnly &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      if (matches(node.moduleReference.expression.text)) {
        found = true;
        return;
      }
    }
    if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequireCall = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      const [firstArgument] = node.arguments;
      // `ts.isStringLiteralLike` couvre DEJA le NoSubstitutionTemplateLiteral
      // (un gabarit de texte SANS `${...}`, ex. `import(\`...\/universal\`)`)
      // au meme titre qu une chaine a guillemets simples/doubles — aucun
      // traitement special requis ICI (voir en revanche le motif `git grep`
      // de presélection des candidats, qui doit aussi accepter l accent
      // grave, corrige separement).
      if ((isDynamicImport || isRequireCall) && firstArgument && ts.isStringLiteralLike(firstArgument)) {
        if (matches(firstArgument.text)) {
          found = true;
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

/** `(npm:)?write-excel-file(@version)?/universal` — motif du SPECIFICATEUR seul (sans guillemets, deja extrait par le parseur). */
const UNIVERSAL_SPECIFIER_PATTERN = /^(npm:)?write-excel-file(@[^'"/]+)?\/universal$/;

/**
 * Meme motif que ci-dessus mais SUR LE TEXTE BRUT, guillemets droits
 * compris — sert UNIQUEMENT a `git grep` pour trouver des CANDIDATS dans
 * TOUT `src/`/`supabase/` (JSON compris, ex. `deno.json`) en un seul
 * appel rapide. Les candidats `.ts`/`.tsx` sont ENSUITE reverifies par
 * l AST (voir `filesReallyImportingUniversalEntry`) : `git grep` seul ne
 * distingue pas un import d une citation en commentaire ou d un bloc
 * commente — c est exactement le defaut corrige aux rounds 1 et 3.
 */
// Guillemets droits ET accent grave : un gabarit de texte SANS substitution
// (`` `write-excel-file/universal` ``) est un import() valide (voir
// `hasRealImportMatching`, `NoSubstitutionTemplateLiteral`) — si `git grep`
// ne le presente jamais comme candidat, l AST qui le reconnaitrait pourtant
// ne voit jamais le fichier (qa-review round 4, MOYEN).
const UNIVERSAL_IMPORT_GREP_PATTERN = '[\'"`](npm:)?write-excel-file(@[^\'"`/]+)?/universal[\'"`]';

function candidateFilesMentioningUniversal(): string[] {
  // `git grep` : rapide, couvre `src/` ET `supabase/` d un seul appel —
  // exactement le perimetre que la precaution 1 doit couvrir (contrat :
  // « nulle part dans le depot »). `--untracked` est OBLIGATOIRE : sans
  // lui, `git grep` ignore silencieusement un fichier cree mais pas encore
  // `git add`-e (verifie : `xlsx-renderer.ts` lui-meme est reste UNTRACKED
  // une bonne partie de ce lot, ce qui aurait rendu ce test aveugle a une
  // regression dans le fichier meme qu il est cense garder). Respecte
  // toujours `.gitignore` (donc jamais `node_modules`). `execFileSync`
  // (jamais `execSync` + interpolation de chaine) : le motif est passe en
  // ARGUMENT DE PROCESSUS, sans jamais passer par un shell — un accent
  // grave dans le motif (necessaire depuis qa-review round 4, MOYEN)
  // declencherait sinon une substitution de commande si le motif etait
  // interpole dans une chaine executee par `/bin/sh -c`.
  try {
    const output = execFileSync('git', ['grep', '-l', '-E', '--untracked', UNIVERSAL_IMPORT_GREP_PATTERN, '--', 'src', 'supabase'], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    return output.split('\n').filter((line) => line.length > 0);
  } catch (error) {
    // `git grep` rend un statut 1 (PAS une erreur) quand AUCUNE occurrence
    // n est trouvee — c est le cas NOMINAL et attendu ici.
    const status = (error as { status?: number }).status;
    if (status === 1) return [];
    throw error;
  }
}

/**
 * Filtre les candidats du grep : pour un fichier `.ts`/`.tsx`, seule une
 * IMPORTATION REELLE (AST) compte — une simple mention en commentaire
 * (prose OU bloc commente) est ECARTEE. Pour tout autre fichier (ex.
 * `deno.json`, JSON pur, sans syntaxe de commentaire), le grep suffit :
 * toute occurrence entre guillemets droits y est une VALEUR, jamais un
 * commentaire.
 */
/** Extensions dont la syntaxe de commentaire (bloc ou ligne) doit etre distinguee d un import REEL par l AST — `.mts`/`.cts` inclus (qa-review round 4). */
const TYPESCRIPT_SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts'];

function filesReallyImportingUniversalEntry(): string[] {
  const candidates = candidateFilesMentioningUniversal();
  return candidates.filter((relativePath) => {
    if (!TYPESCRIPT_SOURCE_EXTENSIONS.some((extension) => relativePath.endsWith(extension))) return true;
    const sourceFile = parseTypeScriptFile(relativePath);
    return hasRealImportMatching(sourceFile, (specifier) => UNIVERSAL_SPECIFIER_PATTERN.test(specifier));
  });
}

describe('bibliotheque XLSX — write-excel-file/universal jamais IMPORTE (contrat §8.24 point 7, precaution 1)', () => {
  it('aucun fichier de src/ ou supabase/ ne l importe (imports REELS, AST pour le .ts, grep pour le JSON — pas les commentaires qui l expliquent)', () => {
    const offenders = filesReallyImportingUniversalEntry();
    expect(offenders).toEqual([]);
  });

  it('le renderer XLSX importe REELLEMENT l entree /node, jamais une autre (AST, jamais une regex sur le texte source)', () => {
    const sourceFile = parseTypeScriptFile(RENDERER_PATH);
    expect(hasRealImportMatching(sourceFile, (specifier) => specifier === 'write-excel-file/node')).toBe(true);
    expect(hasRealImportMatching(sourceFile, (specifier) => UNIVERSAL_SPECIFIER_PATTERN.test(specifier))).toBe(false);
    expect(hasRealImportMatching(sourceFile, (specifier) => specifier === 'write-excel-file/browser')).toBe(false);
  });
});

/**
 * PRECAUTION 2, ETENDUE (treizieme entree du bandeau, point (ii)) — DEUX
 * paquets a epingler, pas un seul : `write-excel-file` (dont l entree
 * `/node` porte le detail d implementation qui evite le Worker) ET
 * `fflate` (sa dependance transitive, qui EST la bibliotheque qui bascule
 * sur `Worker`). Chaque entree ci-dessous decrit, pour un paquet, sous
 * quelle CLE il apparait dans l import-map Deno et quel sous-chemin (le
 * cas echeant) doit suivre la version dans la valeur `npm:...`.
 */
const PINNED_PACKAGES = [
  { packageName: 'write-excel-file', importMapKey: 'write-excel-file/node', importMapSubpath: '/node' },
  { packageName: 'fflate', importMapKey: 'fflate', importMapSubpath: '' },
] as const;

const EXACT_SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

describe.each(PINNED_PACKAGES)(
  'bibliotheque XLSX — $packageName : version EPINGLEE exactement, IDENTIQUE entre package.json et l import-map Deno (contrat §8.24 point 7, precaution 2)',
  ({ packageName, importMapKey, importMapSubpath }) => {
    it(`package.json declare ${packageName} en version EXACTE (jamais un intervalle semver : ni ^ ni ~)`, () => {
      const dependencies = readPackageJsonDependencies();
      const declared = dependencies[packageName];
      expect(declared, `${packageName} devrait etre declare dans package.json > dependencies`).toBeDefined();
      expect(declared).toMatch(EXACT_SEMVER_PATTERN);
    });

    it(`l import-map Deno du runner porte "${importMapKey}" a EXACTEMENT la meme version que package.json`, () => {
      const dependencies = readPackageJsonDependencies();
      const importMap = readDenoImportMap();
      const declaredVersion = dependencies[packageName];
      const importMapValue = importMap[importMapKey];

      expect(declaredVersion, `${packageName} devrait etre declare dans package.json > dependencies`).toBeDefined();
      expect(importMapValue, `l import-map devrait porter une entree "${importMapKey}"`).toBeDefined();
      // Egalite STRICTE, DERIVEE de package.json (jamais deux constantes
      // recopiees independamment) : une version qui diverge d un seul cote
      // fait tomber CE test, quel que soit le sens de la divergence.
      expect(importMapValue).toBe(`npm:${packageName}@${declaredVersion}${importMapSubpath}`);
    });
  },
);

describe('bibliotheque XLSX — import REEL de fflate dans le renderer (treizieme entree du bandeau §8.24, point (ii))', () => {
  it('xlsx-renderer.ts importe REELLEMENT fflate (AST — insensible a un bloc commente ou a une citation en prose)', () => {
    const sourceFile = parseTypeScriptFile(RENDERER_PATH);
    // AST, PAS une regex sur le texte source (qa-review round 3) : un
    // `import 'fflate';` place a l interieur d un bloc `/* ... */`, ou en
    // commentaire `// import 'fflate';`, ne produit AUCUN noeud
    // `ImportDeclaration` — cette assertion ne peut donc pas etre trompee
    // par l un ou l autre, contrairement au motif regex ancre precedent.
    expect(hasRealImportMatching(sourceFile, (specifier) => specifier === 'fflate')).toBe(true);
  });
});
