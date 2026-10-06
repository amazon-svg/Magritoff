import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import pg from 'pg';
import { applyMigrations, databaseConfiguration } from './migrate.mjs';

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
  const migrationClient = new pg.Client(databaseConfiguration(environment));
  await migrationClient.connect();
  try {
    await applyMigrations(migrationClient, undefined, { through: '0085_public_account_registration' });
    await seedOrderUnificationFixture(migrationClient, environment);
  } finally {
    await migrationClient.end();
  }
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

async function seedOrderUnificationFixture(client, targetEnvironment) {
  const ids = Object.fromEntries([
    'USER', 'TENANT', 'SHOP', 'STOREFRONT_ORDER', 'CUSTOMER', 'PROJECT', 'QUOTE', 'QUOTE_LINE', 'ORDER', 'ORDER_LINE',
    'STEP_CHANGE', 'FILE', 'TEMPLATE', 'DOCUMENT', 'UPLOAD_LINK', 'NOTIFICATION_TEMPLATE', 'NOTIFICATION',
  ].map((name) => [name, randomUUID()]));
  for (const [name, value] of Object.entries(ids)) targetEnvironment[`MAGRIT_E44B_${name}_ID`] = value;

  await client.query("insert into public.app_users(id,email_normalized,display_name) values($1,$2,'Auteur historique')",
    [ids.USER, `migration-${ids.USER}@example.invalid`]);
  await client.query("insert into public.tenants(id,slug,name) values($1,$2,'Reprise E4.4b')",
    [ids.TENANT, `migration-${ids.TENANT}`]);
  await client.query("insert into public.tenant_members(tenant_id,user_id,role) values($1,$2,'owner')", [ids.TENANT, ids.USER]);
  await client.query("insert into public.shops(id,tenant_id,owner_user_id,slug,name) values($1,$2,$3,$4,'Boutique reprise')",
    [ids.SHOP, ids.TENANT, ids.USER, `migration-shop-${ids.SHOP}`]);
  await client.query("insert into public.tenant_orders(id,tenant_id,shop_id,created_by,status,total_ht) values($1,$2,$3,$4,'validated',25)",
    [ids.STOREFRONT_ORDER, ids.TENANT, ids.SHOP, ids.USER]);
  const step = (await client.query('select id from public.production_steps where tenant_id=$1 order by position limit 1', [ids.TENANT])).rows[0].id;
  targetEnvironment.MAGRIT_E44B_STEP_ID = step;
  await client.query("insert into public.customers(id,tenant_id,type,civility,first_name,last_name,created_by) values($1,$2,'individual','mr','Client','Historique',$3)",
    [ids.CUSTOMER, ids.TENANT, ids.USER]);
  await client.query("insert into public.projects(id,tenant_id,customer_id,name,created_by) values($1,$2,$3,'Projet historique',$4)",
    [ids.PROJECT, ids.TENANT, ids.CUSTOMER, ids.USER]);
  await client.query("insert into public.commercial_quotes(id,tenant_id,customer_id,project_id,number,status,created_by) values($1,$2,$3,$4,'DEV-2026-00444','draft',$5)",
    [ids.QUOTE, ids.TENANT, ids.CUSTOMER, ids.PROJECT, ids.USER]);
  await client.query(`insert into public.commercial_quote_lines(id,quote_id,origin,label,product_config,quantity,position,
    production_price,public_price,customer_price,applied_margin_rate,sale_price,breakdown)
    values($1,$2,'free','Ligne source','{"papier":"mat"}',2,0,40,90,75,.4000,75,
    '[{"post":"printing","cost":"40.00","margin_rate":"0.4000","price":"75.00","source":"prix_marche"}]')`,
    [ids.QUOTE_LINE, ids.QUOTE]);
  await client.query("update public.commercial_quotes set status='sent',sent_at='2026-08-31T10:00:00Z' where id=$1", [ids.QUOTE]);
  await client.query(`insert into public.commercial_orders(id,tenant_id,customer_id,quote_id,number,status,
    source_quote_status,current_production_step_id,customer_reference,lines_subtotal,global_discount,
    effective_discount_rate,net_total,vat_rate,vat_regime,vat_amount,total_incl_tax,created_by,created_at,updated_at)
    values($1,$2,$3,$4,'CDE-2026-00444','validated','sent',$5,'REF-EXTERNE-44',75,5,.0667,70,.2,
      'metropole_fr',14,84,$6,'2026-09-01T08:15:30.123456Z','2026-09-02T09:16:31.654321Z')`,
    [ids.ORDER, ids.TENANT, ids.CUSTOMER, ids.QUOTE, step, ids.USER]);
  await client.query(`insert into public.commercial_order_lines(id,order_id,source_quote_line_id,origin,label,
    description_html,product_config,quantity,position,production_price,public_price,customer_price,
    applied_margin_rate,sale_price,sale_margin_rate,discount_rate,margin_variation,breakdown,created_at)
    values($1,$2,$3,'free','Ligne reprise','<p>Conservée</p>','{"papier":"mat"}',2,0,40,90,75,.4,75,.4667,.1667,.0667,
      '[{"post":"printing","cost":"40.00","margin_rate":"0.4000","price":"75.00","source":"prix_marche"}]',
      '2026-09-01T08:16:00.111222Z')`, [ids.ORDER_LINE, ids.ORDER, ids.QUOTE_LINE]);
  await client.query(`insert into public.commercial_order_step_changes(id,order_id,to_step_id,note,actor_id,actor_label,occurred_at)
    values($1,$2,$3,'Étape conservée',$4,'Auteur historique','2026-09-03T10:00:00.333444Z')`,
    [ids.STEP_CHANGE, ids.ORDER, step, ids.USER]);
  await client.query(`insert into public.commercial_order_files(id,order_id,order_line_id,filename,content_type,byte_size,
    visibility,storage_path,deposited_by,deposited_by_label,deposited_at,purge_at,updated_at)
    values($1,$2,$3,'preuve.pdf','application/pdf',321,'customer',$4,$5,'Auteur historique',
      '2026-09-04T11:00:00.444555Z','2027-09-04T11:00:00Z','2026-09-04T11:00:00.444555Z')`,
    [ids.FILE, ids.ORDER, ids.ORDER_LINE, `${ids.TENANT}/${ids.ORDER}/${ids.FILE}`, ids.USER]);
  await client.query("insert into public.document_pdf_templates(id,tenant_id,document_type,name,created_by) values($1,$2,'order','Modèle reprise',$3)",
    [ids.TEMPLATE, ids.TENANT, ids.USER]);
  await client.query(`insert into public.order_documents(id,tenant_id,order_id,template_id,storage_path,byte_size,sha256,
    page_count,generated_at,generated_by,generated_by_label,created_at)
    values($1,$2,$3,$4,$5,456,$6,1,'2026-09-05T12:00:00.555666Z',$7,'Auteur historique','2026-09-05T12:00:00.555666Z')`,
    [ids.DOCUMENT, ids.TENANT, ids.ORDER, ids.TEMPLATE, `${ids.TENANT}/${ids.ORDER}.pdf`, 'a'.repeat(64), ids.USER]);
  await client.query(`insert into public.commercial_order_upload_links(id,order_id,token_hash,expires_at,label,created_by,
    created_by_label,created_at) values($1,$2,$3,'2027-09-06T13:00:00Z','Lien historique',$4,'Auteur historique','2026-09-06T13:00:00Z')`,
    [ids.UPLOAD_LINK, ids.ORDER, 'b'.repeat(64), ids.USER]);
  await client.query(`insert into public.notification_templates(id,tenant_id,event_name,channel,audience,recipients,name,
    subject,body,created_by) values($1,$2,'order.step_changed','email','explicit',array['archive@example.invalid'],
      'Historique','Commande','Corps',$3)`, [ids.NOTIFICATION_TEMPLATE, ids.TENANT, ids.USER]);
  await client.query(`insert into public.notification_logs(id,tenant_id,event_id,event_name,aggregate_type,aggregate_id,
    template_id,channel,status,recipient,subject,body,created_at)
    values($1,$2,$3,'order.step_changed','order',$4,$5,'email','sent','archive@example.invalid','Commande','Corps',
      '2026-09-07T14:00:00.666777Z')`,
    [ids.NOTIFICATION, ids.TENANT, randomUUID(), ids.ORDER, ids.NOTIFICATION_TEMPLATE]);
}
