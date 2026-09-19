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
    // Recherche insensible a la casse/aux espaces d un UPDATE qui ecrirait
    // dans la table -- au-dela du seul motif exact du premier correctif, au
    // cas ou une reecriture future reintroduirait un backfill sous une
    // autre forme (majuscules, retour a la ligne different).
    const normalized = migration.toLowerCase().replace(/\s+/g, ' ');
    expect(normalized).not.toMatch(/update\s+public\.commercial_settings/);
    expect(normalized).not.toContain('update commercial_settings');
  });

  it('ne prive pas NULL de sa signification -- le commentaire de colonne reste honnete sur Q24', () => {
    expect(migration).toContain('Q24');
    expect(migration.toLowerCase()).toContain('ne sont pas retrofites');
  });
});
