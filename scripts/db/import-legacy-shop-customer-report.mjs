import pg from 'pg';
import { databaseConfiguration } from './migrate.mjs';
import { importMode } from './import-legacy-shop-orders.mjs';

const { Client } = pg;
const SOURCE_ENV = 'MAGRIT_LEGACY_SOURCE_DATABASE_URL';

export async function importLegacyShopCustomerReport({ source, target, mode, write = process.stdout.write.bind(process.stdout) }) {
  const rows = (await source.query(`
    select plan.legacy_tenant_id,plan.legacy_user_id,plan.shop_id,plan.normalized_email,
           plan.proposed_action,audit.target_account_id,audit.outcome migration_outcome,
           coalesce(audit.orders_linked_count,0) orders_linked_count,audit.last_attempt_at
      from private.legacy_shop_customer_migration_plan plan
      left join private.legacy_shop_customer_migrations audit
        on audit.legacy_tenant_id=plan.legacy_tenant_id
       and audit.legacy_user_id=plan.legacy_user_id
       and audit.shop_id is not distinct from plan.shop_id
     order by plan.legacy_tenant_id,plan.normalized_email nulls last,plan.shop_id nulls last
  `)).rows;
  await target.query('begin');
  try {
    await target.query("select pg_advisory_xact_lock(hashtext('magrit:legacy-shop-customer-report-cutover'))");
    for (const row of rows) {
      await target.query(`
        select magrit.import_legacy_shop_customer_migration_report(
          $1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::uuid,$7::text,$8::integer,$9::timestamptz
        )
      `, [
        row.legacy_tenant_id,row.legacy_user_id,row.shop_id,row.normalized_email,
        row.proposed_action,row.target_account_id,row.migration_outcome,
        row.orders_linked_count,row.last_attempt_at,
      ]);
    }
    if (mode === 'apply') await target.query('commit');
    else await target.query('rollback');
    const summary = Object.freeze({ mode, source: rows.length, upserted: rows.length });
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
  const source = new Client({ connectionString: sourceConnectionString, application_name: 'magrit-legacy-customer-report-source' });
  const target = new Client({ ...databaseConfiguration(), application_name: 'magrit-legacy-customer-report-target' });
  await source.connect();
  await target.connect();
  try {
    await importLegacyShopCustomerReport({ source, target, mode });
  } finally {
    await Promise.allSettled([source.end(), target.end()]);
  }
}

if (process.argv[1]?.endsWith('import-legacy-shop-customer-report.mjs')) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
