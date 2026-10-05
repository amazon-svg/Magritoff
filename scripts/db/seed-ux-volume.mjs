import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { databaseConfiguration } from './migrate.mjs';
import { seedUxPdfTemplates } from './seed-ux-pdf-templates.mjs';
import {
  developmentSeedConfiguration,
  seedDevelopmentIdentity,
} from './seed-development.mjs';

const { Client } = pg;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));

export function uxVolumeSeedConfiguration(argumentsList = process.argv.slice(2)) {
  const allTenants = argumentsList.length === 0 || argumentsList[0] === '--all';
  const offset = allTenants && argumentsList[0] === '--all' ? 1 : 0;
  const tenantSlug = allTenants ? null : argumentsList[0];
  const customerCount = integerArgument(argumentsList[offset + (allTenants ? 0 : 1)], 100, 1, 5_000, 'clients');
  const orderCount = integerArgument(argumentsList[offset + (allTenants ? 1 : 2)], 200, 1, 10_000, 'commandes');
  const quoteCount = integerArgument(argumentsList[offset + (allTenants ? 2 : 3)], 150, 1, 10_000, 'devis');

  if (tenantSlug !== null && !/^[a-z0-9][a-z0-9-]{0,62}$/.test(tenantSlug)) {
    throw new Error(`Slug tenant invalide : ${tenantSlug}`);
  }
  return Object.freeze({ allTenants, tenantSlug, customerCount, orderCount, quoteCount });
}

export async function seedUxVolume(client, configuration, identityConfiguration = developmentSeedConfiguration()) {
  await seedDevelopmentIdentity(client, identityConfiguration);
  const sql = await readFile(resolve(scriptDirectory, 'seed-ux-volume.sql'), 'utf8');

  await client.query('begin');
  try {
    await client.query("select pg_advisory_xact_lock(hashtext('magrit:ux-volume-seed'))");
    await setLocal(client, 'ux.seed.all', String(configuration.allTenants));
    await setLocal(client, 'ux.seed.tenant_slug', configuration.tenantSlug ?? '');
    await setLocal(client, 'ux.seed.customer_count', String(configuration.customerCount));
    await setLocal(client, 'ux.seed.order_count', String(configuration.orderCount));
    await setLocal(client, 'ux.seed.quote_count', String(configuration.quoteCount));
    await setLocal(client, 'ux.seed.actor_email', identityConfiguration.email);
    await client.query(await readFile(resolve(scriptDirectory, 'repair-ux-order-breakdown.sql'), 'utf8'));
    const queryResult = await client.query(sql);
    await client.query('commit');
    const results = Array.isArray(queryResult) ? queryResult : [queryResult];
    return Object.freeze(results.at(-1)?.rows ?? []);
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

async function main() {
  const configuration = uxVolumeSeedConfiguration();
  const database = databaseConfiguration();
  assertLocalDatabase(database);
  const client = new Client(database);
  await client.connect();
  try {
    const summaries = await seedUxVolume(client, configuration);
    await seedUxPdfTemplates(client, summaries.map((summary) => summary.tenant_slug));
    for (const summary of summaries) {
      process.stdout.write(
        `Fixtures UX pretes : ${summary.tenant_slug}, ${summary.ux_customers} clients, `
        + `${summary.ux_orders} commandes boutique, ${summary.ux_quotes} devis, `
        + `${summary.ux_quote_orders} commandes issues de devis.\n`,
      );
    }
  } finally {
    await client.end();
  }
}

function integerArgument(rawValue, fallback, minimum, maximum, label) {
  if (rawValue === undefined) return fallback;
  if (!/^[0-9]+$/.test(rawValue)) throw new Error(`Le nombre de ${label} est invalide.`);
  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`Le nombre de ${label} doit etre compris entre ${minimum} et ${maximum}.`);
  }
  return value;
}

async function setLocal(client, name, value) {
  await client.query('select set_config($1, $2, true)', [name, value]);
}

function assertLocalDatabase(configuration) {
  if (process.env['MAGRIT_ALLOW_REMOTE_UX_SEED'] === 'true') return;
  const hostname = configuration.connectionString
    ? new URL(configuration.connectionString).hostname
    : configuration.host;
  if (!['127.0.0.1', 'localhost', '::1'].includes(hostname)) {
    throw new Error('Le seed UX volumique est reserve a PostgreSQL local. Utilisez MAGRIT_ALLOW_REMOTE_UX_SEED=true pour une base de recette explicite.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
