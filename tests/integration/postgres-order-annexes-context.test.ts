import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import { withAuthenticatedPostgresRequest } from '../../src/adapters/postgres/authenticated-request-context.ts';
import { PostgresOrderFilesRepository } from '../../src/adapters/postgres/order-files-repository.ts';
import { PostgresOrderUploadLinksRepository } from '../../src/adapters/postgres/order-upload-links-repository.ts';
import { PostgresOrderDocumentsRepository } from '../../src/adapters/postgres/order-documents-repository.ts';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';

const integration = process.env.MAGRIT_POSTGRES_INTEGRATION === '1' ? describe : describe.skip;
integration('annexes des commandes — identité HTTP et PostgreSQL réel', () => {
  let pool: Pool;
  let files: PostgresOrderFilesRepository;
  let links: PostgresOrderUploadLinksRepository;
  let documents: PostgresOrderDocumentsRepository;
  const tenantId = randomUUID() as TenantId;
  const foreignTenantId = randomUUID() as TenantId;
  const userId = randomUUID() as UserId;
  const foreignUserId = randomUUID() as UserId;
  const orderId = randomUUID();
  const shopId = randomUUID();
  beforeAll(async () => {
    pool = createPostgresPool();
    const storage = new S3Client({ region: 'us-east-1', credentials: { accessKeyId: 'test', secretAccessKey: 'test' } });
    const tx = new PostgresTransactionRunner(pool, 'magrit_api');
    files = new PostgresOrderFilesRepository(tx, storage);
    links = new PostgresOrderUploadLinksRepository(tx, storage);
    documents = new PostgresOrderDocumentsRepository(tx, storage);
    await pool.query("insert into public.app_users(id,email_normalized) values($1,$2),($3,$4)", [userId, `annex-${userId}@example.invalid`, foreignUserId, `annex-${foreignUserId}@example.invalid`]);
    await pool.query("insert into public.tenants(id,slug,name) values($1,$2,'Annexes'),($3,$4,'Autre espace')", [tenantId, `annex-${tenantId}`, foreignTenantId, `annex-${foreignTenantId}`]);
    await pool.query("insert into public.tenant_members(tenant_id,user_id,role) values($1,$2,'owner'),($3,$4,'owner')", [tenantId, userId, foreignTenantId, foreignUserId]);
    await pool.query("insert into public.shops(id,tenant_id,owner_user_id,slug,name) values($1,$2,$3,$4,'Boutique')", [shopId, tenantId, userId, `annex-${shopId}`]);
    await pool.query("insert into public.tenant_orders(id,tenant_id,shop_id,created_by,status,total_ht) values($1,$2,$3,$4,'validated',100)", [orderId, tenantId, shopId, userId]);
  });
  afterAll(async () => {
    if (!pool) return;
    await pool.query('delete from public.tenants where id=any($1::uuid[])', [[tenantId, foreignTenantId]]);
    await pool.query('delete from public.app_users where id=any($1::uuid[])', [[userId, foreignUserId]]);
    await pool.end();
  });
  it('reproduit la disparition sans acteur puis affiche les états vides avec l’identité authentifiée', async () => {
    expect(await files.listByOrder(tenantId, orderId)).toBeNull();
    await withAuthenticatedPostgresRequest({ tenantId, userId }, async () => {
      expect(await files.listByOrder(tenantId, orderId)).toEqual([]);
      expect(await links.listByOrder(tenantId, orderId)).toEqual([]);
      expect(await documents.findByOrderId(tenantId, orderId)).toBeNull();
      await expect(documents.findByOrderId(tenantId, randomUUID())).rejects.toMatchObject({ name: 'CommercialOrderNotFoundError' });
    });
  });
  it('continue de refuser un autre utilisateur et une commande hors du tenant authentifié', async () => {
    await withAuthenticatedPostgresRequest({ tenantId, userId: foreignUserId }, async () => {
      expect(await files.listByOrder(tenantId, orderId)).toBeNull();
      expect(await links.listByOrder(tenantId, orderId)).toBeNull();
      await expect(documents.findByOrderId(tenantId, orderId)).rejects.toMatchObject({ name: 'CommercialOrderNotFoundError' });
    });
    await withAuthenticatedPostgresRequest({ tenantId: foreignTenantId, userId: foreignUserId }, async () => {
      expect(await files.listByOrder(tenantId, orderId)).toBeNull();
      expect(await links.listByOrder(tenantId, orderId)).toBeNull();
    });
  });
});
