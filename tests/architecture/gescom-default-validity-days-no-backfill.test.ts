/**
 * Lot "parametre de validite des devis" (Q18, docs/api/CONVENTIONS.md §8.25
 * point 13 (3)) -- garde-fou directement issu d une correction qa-review
 * adversariale du 2026-09-19.
 *
 * La revue a supprime les trois lignes d `UPDATE` (backfill) de la premiere
 * version de `20260919000200_gescom_default_validity_days_30.sql` et rejoue
 * `test:architecture`/`test:storefront:sql` : les deux restaient VERTS. La
 * raison : le scenario B de `tests/sql/gescom-default-validity-days-30.sql`
 * REJOUAIT SA PROPRE COPIE de l `UPDATE`, jamais celui de la migration --
 * aucun test n exercait reellement le fichier de migration lui-meme sur ce
 * point. Un test qui rejoue le code qu il pretend garder ne garde rien.
 *
 * Ce test lit directement le TEXTE de la migration (meme convention que
 * `dashboard-orders-surface.test.ts`) : il echoue si une future retouche de
 * CE FICHIER precis reintroduit un backfill (`update ... commercial_
 * settings ... where default_validity_days is null`), qu un test SQL
 * autonome ne peut pas voir s il ne source pas le fichier de migration lui-
 * meme. Le retrofit des espaces deja crees a `null` est une question ouverte
 * (Q24) : tant qu elle n est pas tranchee par Arnaud, cette migration ne
 * doit ecrire AUCUNE donnee, seulement le defaut de colonne.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260919000200_gescom_default_validity_days_30.sql',
  ),
  'utf8',
);

describe('migration 20260919000200 (Q18) — defaut de colonne seul, aucun backfill de donnee', () => {
  it('pose le defaut de colonne a 30', () => {
    expect(migration).toContain('alter column default_validity_days set default 30');
  });

  it('ne contient AUCUN update sur commercial_settings (aucun retrofit des espaces existants, Q24 reste ouverte)', () => {
    // La premiere version de ce commentaire annoncait couvrir un backfill
    // reintroduit « sous une autre forme ». C etait FAUX, et la qa-review l a
    // mesure : sur sept facons d ecrire une ecriture dans cette table, cinq
    // passaient. La pire -- `insert ... on conflict do update` -- a ete jouee
    // en base : elle ecrase AUSSI les valeurs choisies, donc pire que le
    // backfill rejete, et c est l idiome que ce depot emploie ailleurs
    // (`commercial-settings-repository.ts`, `.upsert({ onConflict })`).
    //
    // Les motifs ci-dessous couvrent donc les six formes rejouees rouges :
    // UPDATE qualifie ou non, `update only`, identifiant entre guillemets,
    // upsert, `merge into`, et `execute` dynamique.
    //
    // LIMITE DECLAREE, plutot que promesse d exhaustivite : ceci reste une
    // lecture de texte. Ecrire une insertion en SQL admet une infinite de
    // formes ; ce test attrape celles qu un developpeur de ce depot ecrirait
    // reellement, pas l evasion deliberee. Et il ne lit QU UN fichier : le
    // jour ou Q24 sera tranchee en « retrofiter », le retrofit ira dans une
    // migration NEUVE, que cette garde ne verra pas -- la protection sera
    // humaine, et la revue de cette migration-la devra etre demandee.
    const normalized = migration
      .toLowerCase()
      .replace(/--[^\n]*/g, ' ')
      .replace(/\s+/g, ' ');
    const table = String.raw`(only\s+)?(public\s*\.\s*)?"?commercial_settings"?`;
    expect(normalized).not.toMatch(new RegExp(String.raw`update\s+${table}`));
    expect(normalized).not.toMatch(new RegExp(String.raw`merge\s+into\s+${table}`));
    expect(normalized).not.toMatch(new RegExp(String.raw`on\s+conflict\b[^;]*\bdo\s+update`));
    expect(normalized).not.toMatch(new RegExp(String.raw`execute\b[^;]*\bupdate\s+${table}`));
  });

  it('ne prive pas NULL de sa signification -- le commentaire de colonne reste honnete sur Q24', () => {
    expect(migration).toContain('Q24');
    expect(migration.toLowerCase()).toContain('ne sont pas retrofites');
  });
});
