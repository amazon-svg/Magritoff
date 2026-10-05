import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { databaseConfiguration } from './migrate.mjs';

const referenceUrl = new URL('../../infra/pim/gammes.json', import.meta.url);

export function validatePimReference(reference) {
  if (reference?.schema_version !== 1 || !Array.isArray(reference.gammes) || !reference.gammes.length) {
    throw new Error('Referentiel PIM invalide : schema_version=1 et gammes non vides requis.');
  }
  const bySlug = new Map();
  for (const gamme of reference.gammes) {
    if (!gamme || typeof gamme.slug !== 'string' || !/^[a-z0-9_-]{1,160}$/.test(gamme.slug)
      || typeof gamme.name !== 'string' || !gamme.name.trim() || gamme.name.length > 160
      || !Number.isInteger(gamme.display_order)
      || !(gamme.parent_slug === null || typeof gamme.parent_slug === 'string')
      || !gamme.matching_rules || typeof gamme.matching_rules !== 'object' || Array.isArray(gamme.matching_rules)) {
      throw new Error('Gamme PIM invalide.');
    }
    if (bySlug.has(gamme.slug)) throw new Error(`Slug PIM duplique : ${gamme.slug}`);
    bySlug.set(gamme.slug, gamme);
  }
  for (const gamme of reference.gammes) {
    const seen = new Set([gamme.slug]);
    let parent = gamme.parent_slug;
    while (parent !== null) {
      if (!bySlug.has(parent)) throw new Error(`Parent PIM absent : ${parent}`);
      if (seen.has(parent)) throw new Error(`Cycle PIM : ${gamme.slug}`);
      seen.add(parent);
      parent = bySlug.get(parent).parent_slug;
    }
  }
  return reference.gammes;
}

export async function readPimReference() {
  const reference = JSON.parse(await readFile(referenceUrl, 'utf8'));
  validatePimReference(reference);
  return reference;
}

export async function seedPimReference(client, reference) {
  const gammes = validatePimReference(reference);
  await client.query('begin');
  try {
    await client.query("select pg_advisory_xact_lock(hashtext('magrit:pim-reference-seed'))");
    // Tous les slugs doivent exister avant de poser les parents, quel que soit
    // l'ordre du JSON. Les images et identifiants existants sont conserves.
    for (const gamme of gammes) {
      await client.query(`
        insert into public.product_gammes (slug, name, display_order, matching_rules)
        values ($1, $2, $3, $4::jsonb)
        on conflict (slug) do update set
          name = excluded.name, display_order = excluded.display_order,
          matching_rules = excluded.matching_rules
      `, [gamme.slug, gamme.name, gamme.display_order, JSON.stringify(gamme.matching_rules)]);
    }
    for (const gamme of gammes) {
      await client.query('update public.product_gammes set parent_slug = $2 where slug = $1',
        [gamme.slug, gamme.parent_slug]);
    }
    await client.query('commit');
    return { gammes: gammes.length };
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

async function main() {
  const reference = await readPimReference();
  const client = new pg.Client(databaseConfiguration());
  await client.connect();
  try {
    const result = await seedPimReference(client, reference);
    process.stdout.write(`Referentiel PIM synchronise : ${result.gammes} gammes.\n`);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
