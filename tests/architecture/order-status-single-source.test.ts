/**
 * BCP-5 (docs/api/CONVENTIONS.md §8.25 point 5.1) — une table de libellés
 * de statut de commande, une seule, sous `src/modules/orders/` et
 * `src/modules/roles/`.
 *
 * Avant BCP-5, l'architecte a relevé QUATRE tables sous `src/modules/orders/ui/` :
 * `orderStatus.ts` (canonique), `ResumeBanner.tsx`, `PortalOrders.helpers.ts`
 * et `orderAuditTrail.helpers.ts`. Un premier test a échoué sur ces quatre
 * fichiers (≥3 statuts canoniques recopiés comme CLÉS d'objet en dur).
 *
 * Arbitrage architecte du 2026-09-15, sur un constat du dev-story de BCP-5 :
 * ce premier test laissait passer une CINQUIÈME forme de duplication —
 * `OrderRolesPage.tsx:578`, une PHRASE écrite en dur qui énumérait les
 * libellés (VALEURS, pas clés) avec un huitième item fantôme
 * ("Brouillon" + "En attente de validation" pour le même statut `draft`).
 * Le test est étendu à cette forme, et à `src/modules/roles/`.
 *
 * Il échoue sur le code d'avant :
 *  - `ResumeBanner.tsx`, `PortalOrders.helpers.ts`, `orderAuditTrail.helpers.ts`
 *    (≥3 clés de statut en dur, forme table) ;
 *  - `OrderRolesPage.tsx:578` (8 libellés de statut en dur dans une seule
 *    phrase, forme légende/énumération).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCAN_ROOTS = [
  resolve(process.cwd(), 'src/modules/orders'),
  resolve(process.cwd(), 'src/modules/roles'),
];
const CANONICAL_FILE = resolve(process.cwd(), 'src/modules/orders/ui/helpers/orderStatus.ts');

// Les 7 statuts `tenant_order_status` canoniques (clés de STATUS_LABELS).
const STATUS_KEYS = [
  'draft',
  'validated',
  'in_production',
  'shipped',
  'delivered',
  'invoiced',
  'cancelled',
];

// Les libellés (VALEURS) de ces mêmes 7 statuts, tels que rendus par la
// table unique — cf. `getOrderStatusLegendLabels()`. `pending`/`approved`
// (hérités `shop_orders`) sont volontairement exclus : leurs libellés
// ("En attente", "Validée") chevauchent trop les autres pour un seuil fiable,
// et ce ne sont pas des statuts `tenant_orders`.
const STATUS_LABELS_VALUES = [
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
  it('aucun fichier hors orderStatus.ts ne recopie une table de libellés de statut (clés en dur)', () => {
    const offenders: string[] = [];
    for (const root of SCAN_ROOTS) {
      for (const file of collectSourceFiles(root)) {
        if (file === CANONICAL_FILE) continue;
        const content = stripComments(readFileSync(file, 'utf8'));
        // Un statut CLE d'objet littéral : draft: {...} / 'draft': "..." / draft: 'Foo'
        const hits = STATUS_KEYS.filter((key) =>
          new RegExp(`['"\`]?\\b${key}\\b['"\`]?\\s*:\\s*['"\`{]`).test(content),
        );
        if (hits.length >= 3) {
          offenders.push(`${relative(process.cwd(), file)} (${hits.join(', ')})`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('aucun fichier hors orderStatus.ts n énumère les libellés de statut en dur (forme légende/phrase)', () => {
    const offenders: string[] = [];
    for (const root of SCAN_ROOTS) {
      for (const file of collectSourceFiles(root)) {
        if (file === CANONICAL_FILE) continue;
        const content = stripComments(readFileSync(file, 'utf8'));
        const hits = STATUS_LABELS_VALUES.filter((label) => content.includes(label));
        if (hits.length >= 3) {
          offenders.push(`${relative(process.cwd(), file)} (${hits.join(', ')})`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
