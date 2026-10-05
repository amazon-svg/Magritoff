import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import pg from 'pg';
import { databaseConfiguration } from './migrate.mjs';

const configuration = databaseConfiguration();
const host = configuration.connectionString ? new URL(configuration.connectionString).hostname : configuration.host;
if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) throw new Error('Tests PostgreSQL isoles : seule une instance locale est autorisee.');
const database = `magrit_test_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Client(configuration);
const environment = { ...process.env, MAGRIT_POSTGRES_INTEGRATION: '1' };
if (configuration.connectionString) {
  const url = new URL(configuration.connectionString);
  url.pathname = `/${database}`;
  environment.DATABASE_URL = url.href;
  environment.MAGRIT_DATABASE_MIGRATION_URL = url.href;
} else {
  const url = new URL('postgresql://localhost');
  url.hostname = configuration.host;
  url.port = String(configuration.port);
  url.username = configuration.user;
  url.password = configuration.password;
  url.pathname = `/${database}`;
  environment.DATABASE_URL = url.href;
  environment.MAGRIT_DATABASE_MIGRATION_URL = url.href;
}
function run(argumentsList) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, argumentsList, { stdio: 'inherit', env: environment });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`Commande en echec (${signal ?? code}).`)));
  });
}
let created = false;
await admin.connect();
try {
  await admin.query(`create database "${database}"`);
  created = true;
  process.stdout.write(`Tests sur la base temporaire ${database}.\n`);
  await run(['scripts/db/migrate.mjs']);
  const tests = (await readdir('tests/integration')).filter(name => /^postgres-.*\.test\.ts$/.test(name)).sort();
  if (!tests.length) throw new Error('Aucun test PostgreSQL trouve.');
  await run(['node_modules/vitest/vitest.mjs', 'run', ...tests.map(name => `tests/integration/${name}`), '--maxWorkers=1']);
} finally {
  try {
    if (created) await admin.query(`drop database "${database}" with (force)`);
  } finally {
    await admin.end();
  }
}
