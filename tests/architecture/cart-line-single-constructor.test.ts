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
 * Le garde : sous `src/modules/*``/ui/`, seul `cartLine.ts` a le droit
 * d'écrire un objet qui étale `config` puis pose une clé `quantity` depuis une
 * source externe (`config: { ...xxx, quantity: yyy }`). C'est la signature
 * textuelle exacte des trois copies historiques (PortalCatalog.tsx,
 * PortalProduct.tsx — fermées par BCP-10 — et GammePage.tsx, fermée par
 * BCP-11) et de `toPackLine` lui-même.
 *
 * Limite assumée (texte, pas AST) : un contournement qui évite le motif
 * `config: { ...`suivi de `quantity:` sur le même objet passerait au travers.
 * C'est le compromis explicitement accepté au point 3.6 (e) : « une règle
 * d'architecture qui ne rougit pas sur la faute qu'elle prétend interdire ne
 * vaut pas la ligne qu'elle occupe » — vérifié ci-dessous par un test qui
 * rejoue littéralement M7.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const uiRootsGlob = resolve(root, 'src/modules');

/**
 * Motif exact de la règle du paquet : un spread (`...`) qui référence le
 * `.config` d'un produit (avec ou sans cast/nullish intermédiaire — les
 * parenthèses imbriquées du cast `as Record<string, unknown>` empêchent un
 * ancrage strict sur une seule paire de parenthèses), suivi à faible distance
 * d'une clé `quantity` (forme longue `quantity: xxx` OU raccourci
 * `quantity,`/`quantity }` — les trois copies historiques écrivaient la forme
 * longue, `cartLine.ts` écrit le raccourci).
 *
 * Vérifié pour ne PAS matcher `PortalCatalog.tsx` (spread `...c`/`...d`,
 * jamais `.config`, pour construire un produit éphémère depuis une
 * suggestion Magrit — sans rapport avec la règle du paquet).
 */
const PACK_RULE_PATTERN = /\.\.\.[\s\S]{0,80}?\.config\b[\s\S]{0,120}?\bquantity\s*(?::|[,}])/;

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
});
