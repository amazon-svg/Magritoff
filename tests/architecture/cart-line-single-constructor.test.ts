/**
 * BCP-11 (docs/api/CONVENTIONS.md §8.25 point 3.6 (e)) — garde d'architecture
 * pour la mutation M7, qui échappe par construction aux tests unitaires.
 *
 * M7 : « réintroduire la normalisation dans GammePage.handleAdd (la troisième
 * copie) ». Une reconstruction manuelle et FONCTIONNELLEMENT CORRECTE de la
 * règle S-FIX-PANIER-11/05 (spread de `config`, écriture de `quantity: <une
 * variable externe>`) compilerait toujours et se comporterait comme avant ce
 * lot — aucun test sur `cartLine.ts`, `cartPricing.ts` ou
 * `orderRenewal.helpers.ts` ne la verrait jamais, puisqu'elle n'appelle aucune
 * de leurs fonctions. Le danger n'est pas fonctionnel ici : c'est la
 * DUPLICATION elle-même, qui a déjà produit un commentaire faux une fois
 * (BCP-10, PublicShop.tsx:207-214) et laissera la prochaine copie diverger de
 * `toPackLine` en silence.
 *
 * DEUX gardes, sous `src/modules/*``/ui/`, seul `cartLine.ts` en est exempté :
 *
 *  1. **La règle du paquet réécrite en toutes lettres** (garde TEXTUEL) : un
 *     objet qui étale `config` puis pose une clé `quantity` depuis une
 *     source externe (`config: { ...xxx, quantity: yyy }`). Signature
 *     textuelle exacte des trois copies historiques (PortalCatalog.tsx,
 *     PortalProduct.tsx — fermées par BCP-10 — et GammePage.tsx, fermée par
 *     BCP-11) et de `toPackLine` lui-même.
 *
 *  2. **Une `CartLine` construite à la main** (qa-review round 2, défaut 4 ;
 *     durci en round 3) : un littéral d'objet qui porte à la fois une clé
 *     `product` et une clé `qty`, quel que soit l'ordre, la forme
 *     (longue/raccourcie), l'imbrication ou les commentaires. Round 2
 *     implémentait ce garde par une découpe TEXTUELLE (profondeur de
 *     parenthèses/crochets sur des blocs `\{[^{}]*\}`) — la qa-review l'a
 *     contourné en trois lignes, toutes à `pnpm typecheck` 0 erreur et
 *     3061 tests verts :
 *       - `{ product: { ...product }, qty: 500 }` (valeur imbriquée : le
 *         bloc `\{[^{}]*\}` ne peut PAS matcher un objet contenant une
 *         accolade imbriquée, donc le littéral entier échappait au motif) ;
 *       - `{ product, /* paquets *\/ qty: 500 }` (un commentaire de bloc
 *         entre la virgule et la clé faisait échouer `memberKey()`, qui
 *         retournait `"/* paquets *\/ qty"` au lieu de `"qty"`) ;
 *       - la quatrième porte RECONSTRUITE ENTIÈREMENT à la main dans
 *         `orderRenewal.helpers.ts` (`toPackLine`/`packLine` jamais
 *         appelés), `lines.push({ product: { ...product, config: lineConfig
 *         }, qty })` — la forme historique exacte d'avant ce lot
 *         (`bcd8424b`), avec en plus une valeur imbriquée.
 *     **Round 3 : ce garde parcourt le véritable AST TypeScript**
 *     (`ts.createSourceFile` + `ts.isObjectLiteralExpression`), pas du
 *     texte. Les trois contournements ci-dessus n'ont plus prise : l'AST ne
 *     voit ni l'indentation, ni les commentaires (trivia, hors arbre), ni la
 *     forme des guillemets de clé, et une propriété est identifiée par sa
 *     position dans `node.properties` (donc son appartenance RÉELLE au
 *     littéral), jamais par proximité textuelle avec un argument d'appel
 *     imbriqué.
 *
 * Limite assumée du PREMIER garde (textuel) : une réécriture qui évite la
 * forme `config: { ...spread, quantity }` (par exemple `const nextConfig =
 * { ...base }; nextConfig.quantity = result.qty;`) lui échappe encore — voir
 * la limite détaillée dans `cartLine.ts`.
 *
 * Limite assumée du SECOND garde (AST) : il détecte un littéral d'objet
 * UNIQUE portant les deux clés. Une `CartLine` assemblée par AFFECTATIONS
 * successives (`const line = {} as CartLine; line.product = p; line.qty =
 * q;`) n'est pas un `ObjectLiteralExpression` portant les deux clés et lui
 * échappe. C'est le compromis explicitement accepté au point 3.6 (e) :
 * « une règle d'architecture qui ne rougit pas sur la faute qu'elle prétend
 * interdire ne vaut pas la ligne qu'elle occupe » — les formes qui restent
 * hors de portée sont nommées, pas cachées derrière un commentaire optimiste.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import * as ts from 'typescript';

const root = resolve(__dirname, '../..');
const uiRootsGlob = resolve(root, 'src/modules');

/**
 * Motif 1 : un spread (`...`) qui référence le `.config` d'un produit (avec
 * ou sans cast/nullish intermédiaire — les parenthèses imbriquées du cast
 * `as Record<string, unknown>` empêchent un ancrage strict sur une seule
 * paire de parenthèses), suivi à faible distance d'une clé `quantity` (forme
 * longue `quantity: xxx` OU raccourci `quantity,`/`quantity }` — les trois
 * copies historiques écrivaient la forme longue, `cartLine.ts` écrit le
 * raccourci).
 *
 * Vérifié pour ne PAS matcher `PortalCatalog.tsx` (spread `...c`/`...d`,
 * jamais `.config`, pour construire un produit éphémère depuis une
 * suggestion Magrit — sans rapport avec la règle du paquet).
 */
const PACK_RULE_PATTERN = /\.\.\.[\s\S]{0,80}?\.config\b[\s\S]{0,120}?\bquantity\s*(?::|[,}])/;

/**
 * Motif 2 (qa-review round 2, défaut 4 ; durci en AST au round 3) : une clé
 * `product` et une clé `qty` PORTÉES PAR LE MÊME `ObjectLiteralExpression`
 * (`node.properties`), sous forme longue (`PropertyAssignment`, y compris
 * clé entre guillemets) ou raccourcie (`ShorthandPropertyAssignment`). Un
 * `SpreadAssignment` (`...x`) n'introduit aucune clé propre au littéral —
 * cohérent avec l'intention du garde : `...product` n'est pas une CLÉ
 * `product`, c'est un ÉTALEMENT d'une valeur qui s'appelle `product`.
 */
function objectLiteralPropertyKey(prop: ts.ObjectLiteralElementLike): string | null {
  if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
    const name = prop.name;
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
      return name.text;
    }
    // Durcissement du coordinateur (qa-review round 3, durcissement 1) : une
    // cle CALCULEE dont l expression est une constante litterale — `{
    // ['product']: p, ['qty']: 500 }` — designe exactement la meme propriete
    // qu un identifiant, et echappait a ce garde. C etait la derniere evasion
    // purement cosmetique : elle rendait fausse la phrase de `cartLine.ts`.
    // Verifie sans faux positif sur l arbre reel.
    if (
      ts.isComputedPropertyName(name) &&
      (ts.isStringLiteral(name.expression) || ts.isNumericLiteral(name.expression))
    ) {
      return name.expression.text;
    }
  }
  return null;
}

function countHandBuiltCartLineLiterals(src: string, fileName: string): number {
  const scriptKind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, scriptKind);
  let count = 0;
  function visit(node: ts.Node): void {
    if (ts.isObjectLiteralExpression(node)) {
      const keys = new Set<string>();
      for (const prop of node.properties) {
        const key = objectLiteralPropertyKey(prop);
        if (key !== null) keys.add(key);
      }
      if (keys.has('product') && keys.has('qty')) count++;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return count;
}

function hasHandBuiltCartLineLiteral(src: string, fileName = 'sample.tsx'): boolean {
  return countHandBuiltCartLineLiterals(src, fileName) > 0;
}

const ALLOWED_FILE = 'src/modules/orders/ui/storefront/cartLine.ts';

function listUiFiles(): string[] {
  const results: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry)) continue;
      // Ne cible que les sous-arbres `ui/` de chaque module, comme prescrit.
      const rel = relative(root, full).replace(/\\/g, '/');
      if (!/^src\/modules\/[^/]+\/ui\//.test(rel)) continue;
      results.push(rel);
    }
  }
  walk(uiRootsGlob);
  return results;
}

describe('BCP-11 — cartLine.ts est le seul domicile de la règle du paquet (garde M7)', () => {
  it('aucun fichier sous src/modules/*/ui/ autre que cartLine.ts ne réécrit `config: { ...spread, quantity: ... }`', () => {
    const offenders: string[] = [];
    for (const rel of listUiFiles()) {
      if (rel === ALLOWED_FILE) continue;
      const src = readFileSync(resolve(root, rel), 'utf-8');
      if (PACK_RULE_PATTERN.test(src)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it('le garde repose bien sur le motif de cartLine.ts (sanity check, pas un test vide)', () => {
    const src = readFileSync(resolve(root, ALLOWED_FILE), 'utf-8');
    expect(PACK_RULE_PATTERN.test(src)).toBe(true);
  });

  it(
    'aucun fichier sous src/modules/*/ui/ autre que cartLine.ts ne construit ' +
      'une CartLine a la main (littéral AST portant à la fois `product` et `qty`) ' +
      '(qa-review round 2, défaut 4 ; garde AST depuis le round 3)',
    () => {
      const offenders: string[] = [];
      for (const rel of listUiFiles()) {
        if (rel === ALLOWED_FILE) continue;
        const src = readFileSync(resolve(root, rel), 'utf-8');
        if (hasHandBuiltCartLineLiteral(src, rel)) offenders.push(rel);
      }
      expect(offenders).toEqual([]);
    },
  );

  it('le second garde repose bien sur un littéral réel (sanity check, pas un test vide)', () => {
    expect(hasHandBuiltCartLineLiteral('return { product, qty: packCount };')).toBe(true);
    expect(hasHandBuiltCartLineLiteral('return packLine(product, packCount);')).toBe(false);
  });

  it(
    'preuve retenue par la qa-review (défaut 4, round 2) : un nombre nu dans ' +
      "l'emplacement paquets, en littéral CartLine, est bien détecté",
    () => {
      // Forme exacte relevée en qa-review round 2 : `PublicShop.tsx`
      // compilait et la suite complète passait avec ce littéral en lieu et
      // place de `packLine(product, packCount)`.
      expect(hasHandBuiltCartLineLiteral('return [...prev, { product, qty: 500 }];')).toBe(true);
    },
  );

  it(
    'les trois contournements du garde TEXTUEL round 2 (qa-review round 3) ' +
      'sont détectés par le garde AST',
    () => {
      // Contournement 1 : valeur imbriquée. `\{[^{}]*\}` ne pouvait pas
      // matcher un littéral contenant une accolade imbriquée — l'AST n'a
      // pas cette limite, `product` est une clé du littéral EXTÉRIEUR quelle
      // que soit la forme de sa valeur.
      expect(
        hasHandBuiltCartLineLiteral('return { product: { ...product }, qty: 500 };'),
      ).toBe(true);

      // Contournement 2 : un commentaire de bloc entre la virgule et la clé.
      // La découpe textuelle round 2 lisait la clé comme
      // "/* paquets */ qty" (jamais égale à "qty") ; l'AST ignore les
      // commentaires (trivia), la clé réelle est "qty".
      expect(
        hasHandBuiltCartLineLiteral('return { product, /* paquets */ qty: 500 };'),
      ).toBe(true);

      // Contournement 3, le plus grave : la quatrième porte reconstruite
      // ENTIÈREMENT à la main, sans jamais appeler `toPackLine`/`packLine` —
      // la forme historique exacte d'avant ce lot (`bcd8424b`), avec en plus
      // une valeur imbriquée pour `product`.
      const rebuiltDoorSrc = `
        function rebuildCartFromOrderItems(items, currentShopProducts) {
          const lines = [];
          for (const item of items) {
            const product = currentShopProducts.find((p) => p.id === item.product_id);
            const lineConfig = { ...product.config, ...item.clariprint_options };
            const qty = Math.max(1, Math.floor(item.quantity || 1));
            lines.push({ product: { ...product, config: lineConfig }, qty });
          }
          return { lines };
        }
      `;
      expect(hasHandBuiltCartLineLiteral(rebuiltDoorSrc)).toBe(true);
    },
  );

  it(
    'le garde AST ne se laisse pas abuser par les faux positifs du garde textuel round 2 ' +
      '(déclarations de type, argument d appel imbriqué)',
    () => {
      // types.ts : interface, pas un littéral d'objet — `ts.isObjectLiteralExpression`
      // ne matche jamais une InterfaceDeclaration.
      expect(
        hasHandBuiltCartLineLiteral(
          'export interface CartLine { product: ShopProduct; qty: number; }',
        ),
      ).toBe(false);

      // ProductOverlay.tsx : `qty` est un paramètre d'une signature de
      // fonction dans un type d'interface, pas une clé d'objet littéral.
      expect(
        hasHandBuiltCartLineLiteral(
          'interface P { product: ShopProduct | null; onConfirm: (productConfigured: ShopProduct, qty: number) => void; }',
        ),
      ).toBe(false);

      // useProductConfigurator.ts : "product" est un ARGUMENT d'appel
      // imbriqué dans `buildConfiguredProduct(product, ...)`, la vraie clé
      // de l'objet est "productConfigured" — l'AST les distingue nativement.
      expect(
        hasHandBuiltCartLineLiteral(
          'return { productConfigured: buildConfiguredProduct(product, options, phase), qty: options.quantity };',
        ),
      ).toBe(false);
    },
  );
});
