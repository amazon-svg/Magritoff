import { randomUUID, scryptSync } from 'node:crypto';
import { spawn } from 'node:child_process';
import pg from 'pg';
import { applyMigrations, databaseConfiguration } from './db/migrate.mjs';
import { developmentSeedConfiguration, seedDevelopmentIdentity } from './db/seed-development.mjs';

// Cette recette ne touche qu'une base aléatoire créée et supprimée ici.
const config = databaseConfiguration();
const hostname = config.connectionString ? new URL(config.connectionString).hostname : config.host;
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)) throw new Error('Instance PostgreSQL locale requise.');
const database = `magrit_purchase_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Client(config);
const url = config.connectionString ? new URL(config.connectionString) : new URL(`postgresql://${config.host}:${config.port}`);
if (!config.connectionString) { url.username = config.user; url.password = config.password; }
url.pathname = `/${database}`;
const apiPort = process.env.MAGRIT_RECIPE_API_PORT ?? '8788';
const webPort = process.env.MAGRIT_RECIPE_WEB_PORT ?? '5180';
const env = { ...process.env, DATABASE_URL: url.href, MAGRIT_DATABASE_MIGRATION_URL: url.href,
  APP_BASE_URL: `http://localhost:${webPort}`, E2E_BASE_URL: `http://localhost:${webPort}`,
  VITE_API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`, MAGRIT_API_HOST: '127.0.0.1', MAGRIT_API_PORT: apiPort,
  MAGRIT_AUTH_SECRET: 'magrit-isolated-recipe-auth-secret-32chars',
  S3_ENDPOINT: 'http://127.0.0.1:58333', S3_REGION: 'us-east-1', S3_ACCESS_KEY_ID: 'magrit-local',
  S3_SECRET_ACCESS_KEY: 'magrit-local-secret', S3_FORCE_PATH_STYLE: 'true',
  MAIL_HOST: '127.0.0.1', MAIL_PORT: '51025', MAIL_SECURE: 'false',
  MAGRIT_POSTGRES_INTEGRATION: '1', MAGRIT_FIXED_RECIPE: '1', MAGRIT_RECIPE_LIBRARY_ID: randomUUID(), MAGRIT_RECIPE_SHOP_ID: randomUUID() };
const children = [];
function start(args) {
  const child = spawn(process.execPath, args, { env, stdio: 'inherit' });
  children.push(child); return child;
}
function completion(child) { return new Promise((resolve, reject) => {
  child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Recette échouée (${code}).`)));
}); }
async function ready(address) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { const response = await fetch(address); if (response.status < 500) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`Serveur indisponible : ${address}`);
}
let created = false;
await admin.connect();
try {
  await admin.query(`create database "${database}"`); created = true;
  const client = new pg.Client({ connectionString: url.href }); await client.connect();
  try {
    await applyMigrations(client);
    const seed = developmentSeedConfiguration(env); await seedDevelopmentIdentity(client, seed);
    await client.query("update public.tenants set plan='pro' where id=$1", [seed.tenantId]);
    await client.query("insert into public.libraries(id,tenant_id,user_id,name) values($1,$2,$3,'Articles fixes recette')", [env.MAGRIT_RECIPE_LIBRARY_ID, seed.tenantId, seed.userId]);
    await client.query("insert into public.shops(id,tenant_id,owner_user_id,slug,name,access_mode) values($1,$2,$3,'recette-prix-fixe','Boutique prix fixe','self_signup')", [env.MAGRIT_RECIPE_SHOP_ID, seed.tenantId, seed.userId]);
    await client.query("insert into public.price_rules(tenant_id,name,scope,value_type,value,valid_from,created_by) values($1,'Marge recette','global','margin_rate',.25,'2026-01-01',$2)", [seed.tenantId, seed.userId]);
    const account = randomUUID();
    await client.query("insert into public.shop_customer_accounts(id,shop_id,tenant_id,email,normalized_email,full_name,status,activated_at) values($1,$2,$3,'acheteur@example.invalid','acheteur@example.invalid','Acheteur recette','active',clock_timestamp())", [account, env.MAGRIT_RECIPE_SHOP_ID, seed.tenantId]);
    const salt = Buffer.from('magrit-fixture-salt');
    const hash = `scrypt-v1$${salt.toString('base64')}$${scryptSync('recette-fixed-only', salt, 64).toString('base64')}`;
    await client.query('insert into private.shop_customer_credentials(shop_customer_account_id,password_hash) values($1,$2)', [account, hash]);
  } finally { await client.end(); }
  await completion(start(['node_modules/vitest/vitest.mjs', 'run', 'tests/integration/postgres-fixed-price-storefront.test.ts', '--maxWorkers=1']));
  start(['node_modules/tsx/dist/cli.mjs', 'src/server/node/main.ts']);
  await ready(`http://127.0.0.1:${apiPort}/api/v1/health`);
  start(['node_modules/vite/bin/vite.js', '--port', webPort, '--strictPort']);
  await ready(env.E2E_BASE_URL);
  await completion(start(['node_modules/@playwright/test/cli.js', 'test', 'tests/e2e/fixed-price-purchase.spec.ts', '--project=chromium']));
} finally {
  await Promise.all(children.filter(child => child.exitCode === null).map(child => new Promise(resolve => {
    child.once('exit', resolve); child.kill('SIGTERM'); setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 2000).unref();
  })));
  if (created) await admin.query(`drop database "${database}" with (force)`);
  await admin.end();
}
