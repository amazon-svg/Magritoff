import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { seedPimReference } from '../../scripts/db/seed-pim.mjs';

const enabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
(enabled ? describe : describe.skip)('seed du referentiel PIM', () => {
  let pool: Pool;
  let client: PoolClient;
  const prefix = `seed_${randomUUID().replaceAll('-', '')}`;
  const root = `${prefix}_root`, child = `${prefix}_child`, extra = `${prefix}_extra`;
  const reference = {
    schema_version: 1,
    gammes: [
      { slug: child, name: 'Enfant', parent_slug: root, display_order: 2, matching_rules: {} },
      { slug: root, name: 'Racine', parent_slug: null, display_order: 1, matching_rules: { kind: 'leaflet' } },
    ],
  };
  beforeAll(async () => {
    pool = createPostgresPool();
    client = await pool.connect();
  });
  afterAll(async () => {
    if (client) {
      await client.query('delete from public.product_gammes where slug = $1', [child]);
      await client.query('delete from public.product_gammes where slug = any($1::text[])', [[root, extra]]);
      client.release();
    }
    await pool?.end();
  });
  it('importe enfant avant parent, rejoue sans doublon et preserve les donnees associees', async () => {
    await seedPimReference(client, reference);
    const original = await client.query('select id from public.product_gammes where slug=$1', [child]);
    await client.query("update public.product_gammes set image_url='https://example.invalid/image.png' where slug=$1", [child]);
    await client.query("insert into public.product_definitions(gamme_slug,locale,name) values($1,'fr','Fiche conservee')", [child]);
    await client.query("insert into public.product_gammes(slug,name) values($1,'Gamme supplementaire')", [extra]);
    await seedPimReference(client, reference);
    await seedPimReference(client, { ...reference, gammes: reference.gammes.map(g => g.slug === child
      ? { ...g, name: 'Enfant actualise', display_order: 5, matching_rules: { kind: 'book' } } : g) });
    const updated = await client.query('select id,name,parent_slug,display_order,matching_rules,image_url from public.product_gammes where slug=$1', [child]);
    expect(updated.rows[0]).toEqual({ id: original.rows[0].id, name: 'Enfant actualise', parent_slug: root,
      display_order: 5, matching_rules: { kind: 'book' }, image_url: 'https://example.invalid/image.png' });
    expect((await client.query('select count(*)::int n from public.product_gammes where slug=any($1::text[])', [[root,child,extra]])).rows[0].n).toBe(3);
    expect((await client.query('select name from public.product_definitions where gamme_slug=$1', [child])).rows[0].name).toBe('Fiche conservee');
  });
  it('rejette un cycle avant toute modification des gammes', async () => {
    await expect(seedPimReference(client, { ...reference, gammes: reference.gammes.map(g => ({ ...g, name: 'Ne pas ecrire', parent_slug: g.slug === root ? child : root })) })).rejects.toThrow('Cycle PIM');
    expect((await client.query('select name from public.product_gammes where slug=$1', [root])).rows[0].name).toBe('Racine');
  });
});
