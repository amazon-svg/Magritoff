import pg from 'pg';
import { databaseConfiguration } from './migrate.mjs';

const { Client } = pg;
const SOURCE_ENV = 'MAGRIT_LEGACY_SOURCE_DATABASE_URL';

export function importMode(argumentsList) {
  const unknown = argumentsList.filter((argument) => argument !== '--apply' && argument !== '--dry-run');
  if (unknown.length > 0) throw new Error(`Argument inconnu : ${unknown.join(', ')}`);
  if (argumentsList.includes('--apply') && argumentsList.includes('--dry-run')) {
    throw new Error('Choisir --apply ou --dry-run, pas les deux.');
  }
  return argumentsList.includes('--apply') ? 'apply' : 'dry-run';
}

export async function importLegacyShopOrders({ source, target, mode, write = process.stdout.write.bind(process.stdout) }) {
  const sourceRows = (await source.query(`
    select id,shop_id,customer_name,customer_email,customer_phone,items,
           total_ht,total_ttc,notes,status,created_at
      from public.shop_orders order by created_at,id
  `)).rows;
  let imported = 0;
  let replayed = 0;
  await target.query('begin');
  try {
    await target.query("select pg_advisory_xact_lock(hashtext('magrit:legacy-shop-orders-cutover'))");
    for (const row of sourceRows) {
      const result = (await target.query(`
        select * from magrit.import_legacy_shop_order(
          $1::uuid,$2::uuid,$3::text,$4::text,$5::text,$6::jsonb,
          $7::numeric,$8::numeric,$9::text,$10::text,$11::timestamptz
        )
      `, [
        row.id,
        row.shop_id,
        row.customer_name,
        row.customer_email,
        row.customer_phone ?? '',
        JSON.stringify(row.items),
        row.total_ht,
        row.total_ttc,
        row.notes ?? '',
        row.status,
        row.created_at,
      ])).rows[0];
      if (result?.replayed === true) replayed += 1;
      else imported += 1;
    }
    const verified = Number((await target.query(
      'select count(*) count from public.legacy_shop_order_imports where source_order_id=any($1::uuid[])',
      [sourceRows.map((row) => row.id)],
    )).rows[0]?.count ?? 0);
    if (verified !== sourceRows.length) {
      throw new Error(`Vérification incomplète : ${verified}/${sourceRows.length} commandes tracées.`);
    }
    if (mode === 'apply') await target.query('commit');
    else await target.query('rollback');
    const summary = Object.freeze({ mode, source: sourceRows.length, imported, replayed, verified });
    write(`${JSON.stringify(summary)}\n`);
    return summary;
  } catch (error) {
    await target.query('rollback').catch(() => undefined);
    throw error;
  }
}

async function main() {
  const mode = importMode(process.argv.slice(2));
  const sourceConnectionString = process.env[SOURCE_ENV];
  if (!sourceConnectionString) throw new Error(`${SOURCE_ENV} est obligatoire.`);
  const source = new Client({ connectionString: sourceConnectionString, application_name: 'magrit-legacy-orders-source' });
  const target = new Client({ ...databaseConfiguration(), application_name: 'magrit-legacy-orders-target' });
  await source.connect();
  await target.connect();
  try {
    await importLegacyShopOrders({ source, target, mode });
  } finally {
    await Promise.allSettled([source.end(), target.end()]);
  }
}

if (process.argv[1]?.endsWith('import-legacy-shop-orders.mjs')) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
