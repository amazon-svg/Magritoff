/**
 * Q17-a, durcissement H1 du coordinateur (qa-review round 3).
 *
 * Le lot Q17-a retire aux roles applicatifs (`anon`, `authenticated`) le droit
 * d ecrire EN DIRECT dans `tenant_order_items` et `tenant_orders`. C est la
 * propriete de securite la plus importante du lot : sans elle, un membre de
 * l atelier reecrit en base le prix ET son marqueur `price_origin`, et la
 * commande se valide sans qu aucun refus ne se declenche ni qu aucune trace ne
 * soit ecrite (defaut C1, reproduit par la qa-review).
 *
 * Elle n etait gardee que par `tests/sql/storefront-order-price-revaluation.sql`
 * (cas 19 et 20), qui exige Docker et **ne tourne pas en CI** :
 * `.github/workflows/architecture.yml` lance `typecheck`, `test:architecture`,
 * `gen:api:check`, `test:contract` et les tests `order-exports`, jamais
 * `test:storefront:sql`.
 *
 * Or le revoke est une EXCEPTION par table a un `grant` global
 * (`20260811000100_api_role_table_grants.sql` : « grant select, insert, update,
 * delete on all tables in schema public to anon, authenticated »), et ce motif
 * a deja ete repete une fois dans l histoire du depot (`20260819000100`, pour
 * `service_role`). Une future migration qui le rejoue rouvrirait C1 EN SILENCE.
 *
 * Ce garde-la tourne donc en CI, sans base et sans Docker : il lit le texte des
 * migrations. Deux proprietes :
 *   1. les deux `revoke` de Q17-a sont toujours presents ;
 *   2. aucune migration POSTERIEURE a Q17-a ne redonne ces droits, ni par un
 *      grant global sur le schema, ni par un grant cible sur ces deux tables.
 *
 * Limite assumee, dite plutot que tue : c est une lecture de texte. Un grant
 * construit dynamiquement (`execute format(...)`) lui echapperait. Elle couvre
 * la reecriture distraite du grant global, qui est le scenario reel.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');
const Q17A = '20260919000100_gescom_q17a_storefront_order_price_revaluation.sql';
const TABLES = ['tenant_order_items', 'tenant_orders'] as const;

/** Retire les commentaires `--` et ecrase les espaces : un `grant` du depot
 *  s ecrit sur plusieurs lignes, une detection ligne a ligne ne verrait rien. */
const normalize = (sql: string): string =>
  sql.replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ');

const GRANT_ALL_TABLES =
  /grant\b[^;]*\bon all tables in schema public\b[^;]*\bto\b[^;]*\b(anon|authenticated)\b/i;

const GRANT_ON_ORDER_TABLES = new RegExp(
  String.raw`grant\b(?![^;]*\bon (function|sequence|schema)\b)[^;]*\bon (public\.)?(${TABLES.join('|')})\b[^;]*\bto\b[^;]*\b(anon|authenticated)\b`,
  'i',
);

const migrations = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort();

describe('Q17-a — les ecritures directes sur les commandes restent revoquees', () => {
  it('les deux revoke de Q17-a sont presents dans sa migration', () => {
    const sql = normalize(readFileSync(resolve(MIGRATIONS_DIR, Q17A), 'utf-8'));
    expect(sql).toMatch(
      /revoke[^;]*\binsert\b[^;]*\bupdate\b[^;]*\bdelete\b[^;]*\bon (public\.)?tenant_order_items\b[^;]*\bfrom\b[^;]*\banon\b[^;]*\bauthenticated\b/i,
    );
    expect(sql).toMatch(
      /revoke[^;]*\bupdate\b[^;]*\bon (public\.)?tenant_orders\b[^;]*\bfrom\b[^;]*\banon\b[^;]*\bauthenticated\b/i,
    );
  });

  it('aucune migration POSTERIEURE ne redonne ces droits aux roles applicatifs', () => {
    const posterieures = migrations.filter((name) => name > Q17A);
    const fautives: string[] = [];
    for (const name of posterieures) {
      const sql = normalize(readFileSync(resolve(MIGRATIONS_DIR, name), 'utf-8'));
      if (GRANT_ALL_TABLES.test(sql)) fautives.push(`${name} (grant global sur le schema public)`);
      if (GRANT_ON_ORDER_TABLES.test(sql)) fautives.push(`${name} (grant cible sur une table de commandes)`);
    }
    // Si ce test rougit : une migration rouvre le defaut C1 de Q17-a. Le
    // correctif n est PAS de l ajouter a une liste d exceptions, c est de
    // re-revoquer les deux tables a la fin de cette migration.
    expect(fautives).toEqual([]);
  });

  it('le grant global historique est bien ANTERIEUR a Q17-a (sinon le revoke serait ecrase)', () => {
    const porteurs = migrations.filter((name) =>
      GRANT_ALL_TABLES.test(normalize(readFileSync(resolve(MIGRATIONS_DIR, name), 'utf-8'))),
    );
    expect(porteurs).toEqual(['20260811000100_api_role_table_grants.sql']);
    for (const name of porteurs) expect(name < Q17A).toBe(true);
  });
});
