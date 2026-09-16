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
 *  1. **La règle du paquet réécrite en toutes lettres** : un objet qui étale
 *     `config` puis pose une clé `quantity` depuis une source externe
 *     (`config: { ...xxx, quantity: yyy }`). Signature textuelle exacte des
 *     trois copies historiques (PortalCatalog.tsx, PortalProduct.tsx —
 *     fermées par BCP-10 — et GammePage.tsx, fermée par BCP-11) et de
 *     `toPackLine` lui-même.
 *
 *  2. **Une `CartLine` construite à la main** (qa-review round 2, défaut 4) :
 *     un objet littéral qui porte à la fois une clé `product` et une clé
 *     `qty`, quel que soit l'ordre ou la forme (`product:`/`product,` ×
 *     `qty:`/`qty,`). Round 1 de ce lot affirmait ce garde dans le
 *     commentaire de `cartLine.ts` sans l'implémenter : la preuve retenue
 *     par la qa-review est que `return [...prev, { product, qty: 500 }];`
 *     dans `PublicShop.tsx` — un nombre nu à l'emplacement paquets, DANS le
 *     fichier même que ce lot type — passait `pnpm typecheck` et les 3054
 *     tests sans qu'aucun ne rougisse. Cette seconde garde ferme
 *     spécifiquement ce trou.
 *
 * Limite assumée (texte, pas AST), commune aux deux gardes : une réécriture
 * qui évite ces deux formes précises (par exemple `const nextConfig =
 * { ...base }; nextConfig.quantity = result.qty;` suivi d'une `CartLine`
 * assemblée en plusieurs instructions plutôt qu'un littéral unique) leur
 * échappe. C'est le compromis explicitement accepté au point 3.6 (e) :
 * « une règle d'architecture qui ne rougit pas sur la faute qu'elle prétend
 * interdire ne vaut pas la ligne qu'elle occupe » — vérifié ci-dessous par
 * des tests qui rejouent littéralement M7 et le défaut 4.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

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
 * Motif 2 (qa-review round 2, défaut 4) : une clé `product` et une clé `qty`
 * comme MEMBRES DE PREMIER NIVEAU du même littéral d'objet (`{ product, qty:
 * 500 }`, `{ product: p, qty }`, `{ qty: n, product: p }`, peu importe
 * l'ordre ou la forme longue/raccourcie).
 *
 * "Membre de premier niveau" est essentiel, pas cosmétique : une première
 * version de ce garde cherchait juste le MOT "product" suivi de `:`/`,`/`}`
 * n'importe où dans le bloc, et se déclenchait sur
 * `{ productConfigured: buildConfiguredProduct(product, options, phase), qty:
 * options.quantity }` (`useProductConfigurator.ts`) — "product" y est un
 * ARGUMENT d'appel imbriqué, pas une clé de cet objet (sa clé réelle est
 * `productConfigured`). D'où la découpe explicite par profondeur de
 * parenthèses/crochets ci-dessous, pour ne retenir que les clés qui
 * appartiennent VRAIMENT à ce littéral.
 *
 * `[^{}]*` (dans `hasHandBuiltCartLineLiteral`) borne chaque bloc à un
 * littéral SANS accolade imbriquée : une interface (`product: ShopProduct;
 * qty: number;`, séparateurs `;`) n'a donc aucune virgule de premier niveau
 * et devient un unique "membre" dont la clé est `product` seul — `qty` n'en
 * devient jamais une clé distincte, donc pas de faux positif sur
 * `types.ts`/`ProductOverlay.tsx` (déclarations de type, pas construction).
 */
function splitTopLevelMembers(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of inner) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim() !== '') parts.push(current);
  return parts;
}

function memberKey(member: string): string | null {
  const trimmed = member.trim();
  if (trimmed.startsWith('...')) return null; // spread : pas de clé propre
  let depth = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ':' && depth === 0) return trimmed.slice(0, i).trim();
  }
  return trimmed; // forme raccourcie : le membre entier est la clé
}

function hasHandBuiltCartLineLiteral(src: string): boolean {
  const blocks = src.match(/\{[^{}]*\}/g) ?? [];
  return blocks.some((block) => {
    const inner = block.slice(1, -1);
    const keys = splitTopLevelMembers(inner)
      .map(memberKey)
      .filter((k): k is string => k !== null);
    return keys.includes('product') && keys.includes('qty');
  });
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
      'une CartLine a la main (littéral portant à la fois `product` et `qty`) ' +
      '(qa-review round 2, défaut 4)',
    () => {
      const offenders: string[] = [];
      for (const rel of listUiFiles()) {
        if (rel === ALLOWED_FILE) continue;
        const src = readFileSync(resolve(root, rel), 'utf-8');
        if (hasHandBuiltCartLineLiteral(src)) offenders.push(rel);
      }
      expect(offenders).toEqual([]);
    },
  );

  it('le second garde repose bien sur un littéral réel (sanity check, pas un test vide)', () => {
    expect(hasHandBuiltCartLineLiteral('return { product, qty: packCount };')).toBe(true);
    expect(hasHandBuiltCartLineLiteral('return packLine(product, packCount);')).toBe(false);
  });

  it(
    'preuve retenue par la qa-review (défaut 4) : un nombre nu dans ' +
      "l'emplacement paquets, en littéral CartLine, est bien détecté",
    () => {
      // Forme exacte relevée en qa-review : `PublicShop.tsx` compilait et la
      // suite complète passait avec ce littéral en lieu et place de
      // `packLine(product, packCount)`.
      expect(hasHandBuiltCartLineLiteral('return [...prev, { product, qty: 500 }];')).toBe(true);
    },
  );
});
