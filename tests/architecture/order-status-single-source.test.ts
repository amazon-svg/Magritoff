/**
 * BCP-5 (docs/api/CONVENTIONS.md §8.25 point 5.1) — une table de libellés
 * de statut de commande, une seule, sous `src/modules/orders/ui/`.
 *
 * Avant BCP-5, l'architecte a relevé QUATRE tables sous ce dossier :
 * `orderStatus.ts` (canonique), `ResumeBanner.tsx`, `PortalOrders.helpers.ts`
 * et `orderAuditTrail.helpers.ts`. Ce test échoue si une table hors
 * `orderStatus.ts` recopie, en dur, au moins trois des libellés de statut
 * canoniques comme des clés d'objet — c'est le signal d'une table qui
 * réapparaît au lieu d'importer/dériver `STATUS_LABELS`.
 *
 * Il échoue sur le code d'avant BCP-5 : `ResumeBanner.tsx` (6 clés),
 * `PortalOrders.helpers.ts` (9 clés) et `orderAuditTrail.helpers.ts`
 * (7 clés) y étaient tous les trois pris en défaut.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ORDERS_UI_ROOT = resolve(process.cwd(), 'src/modules/orders/ui');
const CANONICAL_FILE = resolve(ORDERS_UI_ROOT, 'helpers/orderStatus.ts');

const STATUS_KEYS = [
  'draft',
  'validated',
  'in_production',
  'shipped',
  'delivered',
  'invoiced',
  'cancelled',
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

describe('architecture — une seule table de libellés de statut sous src/modules/orders/ui/', () => {
  it('aucun fichier hors orderStatus.ts ne recopie une table de libellés de statut', () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles(ORDERS_UI_ROOT)) {
      if (file === CANONICAL_FILE) continue;
      const content = readFileSync(file, 'utf8');
      // Un statut CLE d'objet littéral : draft: {...} / 'draft': "..." / draft: 'Foo'
      const hits = STATUS_KEYS.filter((key) =>
        new RegExp(`['"\`]?\\b${key}\\b['"\`]?\\s*:\\s*['"\`{]`).test(content),
      );
      if (hits.length >= 3) {
        offenders.push(`${relative(process.cwd(), file)} (${hits.join(', ')})`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
