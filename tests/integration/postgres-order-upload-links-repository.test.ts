import { createHash, randomUUID } from 'node:crypto';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresOrderUploadLinksRepository } from '../../src/adapters/postgres/order-upload-links-repository.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import { createS3Client } from '../../src/adapters/s3/client.ts';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';

const describeIntegration = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1' ? describe : describe.skip;

describeIntegration('PostgresOrderUploadLinksRepository — PostgreSQL et S3 réels', () => {
  let pool: Pool;
  let orderId: string;
  const tenantId = randomUUID() as TenantId;
  const actorId = randomUUID() as UserId;
  const customerId = randomUUID();
  const projectId = randomUUID();
  const quoteId = randomUUID();
  const quoteLineId = randomUUID();
  const objectPaths = new Set<string>();
  const bucket = 'commercial-order-files';
  const storage = createS3Client({
    S3_ENDPOINT: process.env['S3_ENDPOINT'] ?? 'http://127.0.0.1:58333',
    S3_REGION: process.env['S3_REGION'] ?? 'us-east-1',
    S3_ACCESS_KEY_ID: process.env['S3_ACCESS_KEY_ID'] ?? 'magrit-local',
    S3_SECRET_ACCESS_KEY: process.env['S3_SECRET_ACCESS_KEY'] ?? 'magrit-local-secret',
    S3_FORCE_PATH_STYLE: 'true',
  });

  beforeAll(async () => {
    pool = createPostgresPool();
    await pool.query(
      "insert into public.app_users(id, email_normalized, display_name) values ($1, $2, 'Upload Link User')",
      [actorId, `upload-link-${actorId}@example.invalid`],
    );
    await pool.query(
      "insert into public.tenants(id, slug, name) values ($1, $2, 'Imprimerie Liens')",
      [tenantId, `upload-links-${tenantId}`],
    );
    await pool.query("insert into public.tenant_members(tenant_id, user_id, role) values ($1, $2, 'member')", [
      tenantId,
      actorId,
    ]);
    await pool.query(
      "insert into public.customers(id, tenant_id, type, civility, first_name, last_name) values ($1, $2, 'individual', 'mr', 'Jean', 'Lien')",
      [customerId, tenantId],
    );
    await pool.query(
      "insert into public.projects(id, tenant_id, customer_id, name) values ($1, $2, $3, 'Projet lien')",
      [projectId, tenantId, customerId],
    );
    await pool.query(
      `insert into public.commercial_quotes(
         id, tenant_id, customer_id, project_id, number, status, created_by
       ) values ($1, $2, $3, $4, 'DEV-2026-00890', 'draft', $5)`,
      [quoteId, tenantId, customerId, projectId, actorId],
    );
    await pool.query(
      `insert into public.commercial_quote_lines(
         id, quote_id, origin, label, product_config, quantity, position,
         production_price, public_price, customer_price, applied_margin_rate, sale_price, breakdown
       ) values ($1, $2, 'free', 'Lien', '{}', 1, 0, 10, 20, 20, .5, 20, '[{"label":"base","amount":"20.00"}]')`,
      [quoteLineId, quoteId],
    );
    await pool.query(
      "update public.commercial_quotes set status = 'sent', sent_at = clock_timestamp() where id = $1",
      [quoteId],
    );
    orderId = await new PostgresTransactionRunner(pool, 'magrit_api').run(
      { tenantId, userId: actorId },
      async (client) => (
        await client.query('select magrit.convert_commercial_quote($1, $2) as id', [tenantId, quoteId])
      ).rows[0].id,
    );
  });

  afterAll(async () => {
    for (const path of objectPaths) {
      await storage.send(new DeleteObjectCommand({ Bucket: bucket, Key: path })).catch(() => undefined);
    }
    if (pool) {
      await pool.query('delete from public.tenants where id = $1', [tenantId]);
      await pool.query('delete from public.app_users where id = $1', [actorId]);
      await pool.end();
    }
    storage.destroy();
  });

  it('ne persiste que le hash, dépose un fichier puis révoque le lien', async () => {
    const repository = new PostgresOrderUploadLinksRepository(
      new PostgresTransactionRunner(pool, 'magrit_api'),
      storage,
      bucket,
    );
    const created = await repository.create(tenantId, orderId, actorId, {
      label: 'BAT client',
      expires_in_days: 7,
      max_files: 1,
    });
    expect(created).toMatchObject({
      order_id: orderId,
      label: 'BAT client',
      max_files: 1,
      deposited_count: 0,
      created_by: actorId,
      created_by_label: 'Upload Link User',
      token: expect.stringMatching(/^[A-Za-z0-9_-]{32,128}$/),
    });
    const persisted = (
      await pool.query('select token_hash from public.commercial_order_upload_links where id = $1', [created.id])
    ).rows[0];
    expect(persisted.token_hash).toBe(createHash('sha256').update(created.token).digest('hex'));
    expect(JSON.stringify(persisted)).not.toContain(created.token);

    await expect(repository.resolvePrincipal(created.token)).resolves.toEqual({
      linkId: created.id,
      orderId,
      tenantId,
    });
    await expect(repository.resolvePrincipal('invalid-token')).resolves.toBeNull();
    await expect(repository.listByOrder(tenantId, orderId)).resolves.toHaveLength(1);

    const context = await repository.getContext(created.token);
    expect(context).toMatchObject({
      printer_name: 'Imprimerie Liens',
      order_number: expect.stringMatching(/^CDE-/),
      label: 'BAT client',
      max_files: 1,
      deposited_count: 0,
    });
    expect(
      (await pool.query('select use_count from public.commercial_order_upload_links where id = $1', [created.id])).rows[0]
        .use_count,
    ).toBe(1);

    const ticket = await repository.issueFileUploadUrl(created.token);
    objectPaths.add(ticket.path);
    const bytes = new TextEncoder().encode('%PDF-1.7 depot par lien');
    const upload = await fetch(ticket.url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf', 'If-None-Match': '*' },
      body: bytes,
    });
    expect(upload.status, await upload.text()).toBe(200);

    const result = await repository.confirmFileUpload(created.token, {
      file_id: ticket.file_id,
      filename: 'bat-client.pdf',
    });
    expect(result).toMatchObject({
      tenantId,
      uploadLinkId: created.id,
      orderId,
      orderNumber: expect.stringMatching(/^CDE-/),
      customerId,
      deposit: {
        file_id: ticket.file_id,
        filename: 'bat-client.pdf',
        content_type: 'application/pdf',
        byte_size: bytes.length,
        deposited_count: 1,
        max_files: 1,
      },
    });
    expect(
      (
        await pool.query(
          'select deposited_via, deposited_by, deposited_by_label from public.commercial_order_files where id = $1',
          [ticket.file_id],
        )
      ).rows[0],
    ).toEqual({ deposited_via: 'upload_link', deposited_by: null, deposited_by_label: 'Dépôt client — BAT client' });
    await expect(repository.issueFileUploadUrl(created.token)).rejects.toMatchObject({
      name: 'OrderUploadLinkFileLimitReachedError',
    });

    await repository.revoke(tenantId, orderId, created.id, actorId);
    await expect(repository.resolvePrincipal(created.token)).resolves.toBeNull();
    await expect(repository.getContext(created.token)).resolves.toBeNull();
    await expect(repository.listByOrder(tenantId, orderId)).resolves.toEqual([]);
  });
});
