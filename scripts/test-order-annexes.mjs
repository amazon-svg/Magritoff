// Recette réelle dans une base locale temporaire ; aucune donnée de développement modifiée.
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import pg from 'pg';
import { applyMigrations, databaseConfiguration } from './db/migrate.mjs';
const configuration = databaseConfiguration();
const host = configuration.connectionString ? new URL(configuration.connectionString).hostname : configuration.host;
if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) throw new Error('Recette réservée à PostgreSQL local.');
const database = `magrit_annexes_test_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Client(configuration);
let created = false;
await admin.connect();
try {
  await admin.query(`create database "${database}"`); created = true;
  const temporaryConfiguration = configuration.connectionString
    ? { connectionString: (() => { const url = new URL(configuration.connectionString); url.pathname = `/${database}`; return url.href; })() }
    : { ...configuration, database };
  const connection = new pg.Client(temporaryConfiguration);
  await connection.connect();
  try { await applyMigrations(connection); } finally { await connection.end(); }
  const environment = { ...process.env, MAGRIT_POSTGRES_INTEGRATION: '1' };
  if (temporaryConfiguration.connectionString) environment.DATABASE_URL = temporaryConfiguration.connectionString;
  else {
    const url = new URL('postgresql://localhost');
    url.hostname = temporaryConfiguration.host;
    url.port = String(temporaryConfiguration.port);
    url.username = temporaryConfiguration.user;
    url.password = temporaryConfiguration.password;
    url.pathname = `/${database}`;
    // Explicit URL prevents dotenv or inherited configuration from selecting another database.
    environment.DATABASE_URL = url.href;
  }
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tests/integration/postgres-order-annexes-context.test.ts', '--maxWorkers=1'], { env: environment, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Recette en échec (${code}).`)));
  });
} finally {
  try { if (created) await admin.query(`drop database "${database}" with (force)`); }
  finally { await admin.end(); }
}
