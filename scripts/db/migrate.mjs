import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const migrationsDirectory = resolve(projectRoot, 'infra/postgres/migrations');
const migrationNamePattern = /^\d{4}_[a-z0-9_]+\.sql$/;
const advisoryLockName = 'magrit:schema-migrations';

export async function discoverMigrations(directory = migrationsDirectory) {
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && migrationNamePattern.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name));

  return Promise.all(entries.map(async (entry) => {
    const sql = await readFile(resolve(directory, entry.name), 'utf8');
    return Object.freeze({
      version: entry.name.replace(/\.sql$/, ''),
      checksum: createHash('sha256').update(sql).digest('hex'),
      sql,
    });
  }));
}

export async function applyMigrations(client, directory = migrationsDirectory) {
  await client.query('select pg_advisory_lock(hashtext($1))', [advisoryLockName]);
  try {
    await client.query(`
      create table if not exists public.magrit_schema_migrations (
        version text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `);

    const appliedRows = await client.query(
      'select version, checksum from public.magrit_schema_migrations order by version',
    );
    const applied = new Map(appliedRows.rows.map((row) => [row.version, row.checksum]));
    const migrations = await discoverMigrations(directory);
    const newlyApplied = [];

    for (const migration of migrations) {
      const previousChecksum = applied.get(migration.version);
      if (previousChecksum !== undefined) {
        if (previousChecksum !== migration.checksum) {
          throw new Error(`Migration deja appliquee puis modifiee : ${migration.version}`);
        }
        continue;
      }

      await client.query('begin');
      try {
        await client.query(migration.sql);
        await client.query(
          'insert into public.magrit_schema_migrations (version, checksum) values ($1, $2)',
          [migration.version, migration.checksum],
        );
        await client.query('commit');
        newlyApplied.push(migration.version);
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    }

    return Object.freeze({
      applied: Object.freeze(newlyApplied),
      total: migrations.length,
    });
  } finally {
    await client.query('select pg_advisory_unlock(hashtext($1))', [advisoryLockName]);
  }
}

export function databaseConfiguration(environment = process.env) {
  const connectionString = environment['MAGRIT_DATABASE_MIGRATION_URL'] ?? environment['DATABASE_URL'];
  if (connectionString) return { connectionString };

  const port = Number(environment['MAGRIT_DEV_POSTGRES_PORT'] ?? '55432');
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('MAGRIT_DEV_POSTGRES_PORT invalide.');
  }

  return {
    host: environment['MAGRIT_DEV_POSTGRES_HOST'] ?? '127.0.0.1',
    port,
    database: environment['MAGRIT_DEV_POSTGRES_DB'] ?? 'magrit',
    user: environment['MAGRIT_DEV_POSTGRES_USER'] ?? 'magrit',
    password: environment['MAGRIT_DEV_POSTGRES_PASSWORD'] ?? 'magrit-local-only',
  };
}

async function main() {
  const client = new Client(databaseConfiguration());
  await client.connect();
  try {
    const result = await applyMigrations(client);
    for (const version of result.applied) process.stdout.write(`Migration appliquee : ${version}\n`);
    process.stdout.write(`PostgreSQL pret : ${result.total} migration(s), ${result.applied.length} nouvelle(s).\n`);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
