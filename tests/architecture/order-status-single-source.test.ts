/**
 * BCP-5 (docs/api/CONVENTIONS.md §8.25 point 5.1) — une table de libellés
 * de statut de commande, une seule, sous `src/modules/orders/` et
 * `src/modules/roles/`.
 *
 * Historique du durcissement, chaque étape ayant échoué sur du code réel
 * avant d'être corrigée :
 *  1. L'architecte a relevé QUATRE tables sous `src/modules/orders/ui/` :
 *     `orderStatus.ts` (canonique), `ResumeBanner.tsx`, `PortalOrders.helpers.ts`
 *     et `orderAuditTrail.helpers.ts` (≥3 statuts canoniques recopiés comme
 *     CLÉS d'objet en dur).
 *  2. Sur un constat du dev-story de BCP-5 : `OrderRolesPage.tsx:578`, une
 *     PHRASE écrite en dur énumérant les libellés (VALEURS, pas clés), avec
 *     un huitième item fantôme. Le test a été étendu à cette forme et à
 *     `src/modules/roles/`.
 *  3. **qa-review de BCP-5 (2026-09-15), rejet bloquant** : le seuil à 3
 *     n'implémentait pas la règle opposable du point 5.1(c) — « refuse
 *     TOUT littéral de libellé de statut de commande hors de `orderStatus.ts` ».
 *     Un seuil ≥3 laissait passer UN SEUL littéral recopié (le cas réel :
 *     `ValidateOrderConfirmDialog.tsx` n'en portait que 2). **Seuil ramené à 1**,
 *     et la liste des libellés couvre désormais TOUTE la table (legacy
 *     `pending`/`approved` compris), plus `"Brouillon"` — le libellé
 *     superseded qu'une régression pourrait réintroduire.
 *
 * Il échoue sur le code d'avant chaque étape (rejoué et vérifié à chaque
 * fois, cf. story doc) :
 *  - `ResumeBanner.tsx`, `PortalOrders.helpers.ts`, `orderAuditTrail.helpers.ts`
 *    (≥3 clés de statut en dur, forme table) ;
 *  - `OrderRolesPage.tsx:578` (8 libellés de statut en dur dans une seule
 *    phrase, forme légende/énumération) ;
 *  - deux mutations adversariales de la qa-review (seuil 1 exigé pour les
 *    tuer) : `OrderHistoryTable.tsx` (`label: 'Brouillon'` conditionnel sur
 *    `o.status === 'draft'`) et une mini-table à 2 clés dans
 *    `PortalOrderEditor.tsx` (`draft: 'Brouillon', validated: 'Validée'`).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCAN_ROOTS = [
  resolve(process.cwd(), 'src/modules/orders'),
  resolve(process.cwd(), 'src/modules/roles'),
];
const CANONICAL_FILE = resolve(process.cwd(), 'src/modules/orders/ui/helpers/orderStatus.ts');

// Les 9 statuts `OrderStatus` (clés de `STATUS_LABELS`, `tenant_orders`
// canoniques + `shop_orders` hérités).
const STATUS_KEYS = [
  'draft',
  'validated',
  'in_production',
  'shipped',
  'delivered',
  'invoiced',
  'cancelled',
  'pending',
  'approved',
];

// TOUS les libellés (VALEURS) de la table unique — `tenant_orders` ET les
// statuts hérités `shop_orders` (`pending` → "En attente", `approved` →
// "Validée") — plus "Brouillon", le libellé SUPERSEDED de `draft` qu'une
// régression pourrait réintroduire. qa-review du 2026-09-15 : « la liste
// doit contenir TOUS les libellés de la table, plus "Brouillon" ».
const STATUS_LABELS_VALUES = [
  'Brouillon',
  'En attente',
  'En attente de validation',
  'Validée',
  'En production',
  'Expédiée',
  'Livrée',
  'Facturée',
  'Annulée',
];

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (['.ts', '.tsx'].includes(extname(full))) {
      out.push(full);
    }
  }
  return out;
}

/** Retire les commentaires `//` et `/* *\/` pour ne juger que du code/texte réellement servi. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('architecture — une seule table de libellés de statut sous src/modules/orders/ et src/modules/roles/', () => {
  it('aucun fichier hors orderStatus.ts ne recopie UNE SEULE entrée de statut comme clé d objet en dur', () => {
    const offenders: string[] = [];
    for (const root of SCAN_ROOTS) {
      for (const file of collectSourceFiles(root)) {
        if (file === CANONICAL_FILE) continue;
        const content = stripComments(readFileSync(file, 'utf8'));
        // Un statut CLE d'objet littéral : draft: {...} / 'draft': "..." / draft: 'Foo'
        const hits = STATUS_KEYS.filter((key) =>
          new RegExp(`['"\`]?\\b${key}\\b['"\`]?\\s*:\\s*['"\`{]`).test(content),
        );
        if (hits.length >= 1) {
          offenders.push(`${relative(process.cwd(), file)} (${hits.join(', ')})`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('aucun fichier hors orderStatus.ts ne recopie UN SEUL libellé de statut en dur (texte, phrase ou légende)', () => {
    const offenders: string[] = [];
    for (const root of SCAN_ROOTS) {
      for (const file of collectSourceFiles(root)) {
        if (file === CANONICAL_FILE) continue;
        const content = stripComments(readFileSync(file, 'utf8'));
        const hits = STATUS_LABELS_VALUES.filter((label) => content.includes(label));
        if (hits.length >= 1) {
          offenders.push(`${relative(process.cwd(), file)} (${hits.join(', ')})`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
