import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';
import { PostgresCommercialLineFilesRepository } from '../../src/adapters/postgres/commercial-line-files-repository.ts';
import { PostgresCustomersRepository } from '../../src/adapters/postgres/customers-repository.ts';
import { PostgresIdempotencyStore } from '../../src/adapters/postgres/idempotency-store.ts';
import { PostgresOidcIdentityDirectory } from '../../src/adapters/postgres/oidc-identity-directory.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresProjectsRepository } from '../../src/adapters/postgres/projects-repository.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import type { CommercialLineFileObjectStorage } from '../../src/modules/commercial-line-files/application/commercial-line-files-repository.ts';
import { CommercialLineFilesService } from '../../src/modules/commercial-line-files/application/commercial-line-files-service.ts';
import type { ProjectCommercialFileStorage } from '../../src/modules/projects/application/projects-repository.ts';
import { createCommercialLineFilesRoutes } from '../../src/server/api/commercial-line-files-routes.ts';
import { createGescomApiHandler } from '../../src/server/api/gescom-middleware.ts';
import { LocalApiPrincipalVerifier } from '../../src/server/auth/local-api-principal-verifier.ts';

const integrationEnabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

class MemoryStorage implements CommercialLineFileObjectStorage, ProjectCommercialFileStorage {
  readonly objects = new Map<string, Uint8Array>();
  uploadCount = 0;

  async upload(params: Parameters<CommercialLineFileObjectStorage['upload']>[0]) {
    const storagePath = `${params.tenantId}/${params.fileId}`;
    this.uploadCount += 1;
    this.objects.set(storagePath, params.bytes);
    return { storagePath };
  }

  async remove(storagePath: string): Promise<void> {
    this.objects.delete(storagePath);
  }

  async createReadUrl(
    params: Parameters<CommercialLineFileObjectStorage['createReadUrl']>[0],
  ): Promise<string> {
    return `https://s3.local/${params.storagePath}?download=${params.download}`;
  }
}

describeIntegration('PostgresCommercialLineFilesRepository — PostgreSQL reel', () => {
  let pool: Pool;
  let repository: PostgresCommercialLineFilesRepository;
  let itemId: string;
  let storage: MemoryStorage;
  const tenantId = randomUUID() as TenantId;
  const foreignTenantId = randomUUID() as TenantId;
  const adminId = randomUUID() as UserId;
  const localSubject = `commercial-files-session-${randomUUID()}`;

  beforeAll(async () => {
    pool = createPostgresPool();
    const transactions = new PostgresTransactionRunner(pool, 'magrit_api');
    storage = new MemoryStorage();
    repository = new PostgresCommercialLineFilesRepository(transactions, storage);
    const customers = new PostgresCustomersRepository(transactions);
    const projects = new PostgresProjectsRepository(transactions, storage);
    await pool.query(`
      insert into public.app_users (id, email_normalized, display_name)
      values ($1, $2, 'Commercial Files Admin')
    `, [adminId, `commercial-files-${adminId}@example.invalid`]);
    await pool.query(`
      insert into public.tenants (id, slug, name)
      values ($1, $2, 'Commercial Files Integration'), ($3, $4, 'Foreign Files')
    `, [tenantId, `commercial-files-${tenantId}`, foreignTenantId, `commercial-files-${foreignTenantId}`]);
    await pool.query(
      `insert into public.tenant_members (tenant_id, user_id, role) values ($1, $2, 'admin')`,
      [tenantId, adminId],
    );
    await pool.query(`
      insert into public.user_identities (
        app_user_id, provider_type, provider_id, issuer, subject
      ) values ($1, 'local', 'better-auth', 'urn:magrit:local', $2)
    `, [adminId, localSubject]);
    const customer = await customers.create(tenantId, adminId, {
      type: 'individual', civility: 'mr', first_name: 'Fichier', last_name: 'Projet',
    });
    const project = await projects.create(tenantId, adminId, {
      name: 'Projet fichiers commerciaux', customer_id: customer.id,
    });
    itemId = (await projects.addItem(tenantId, project.id, {
      label: 'Ligne projet', quote_payload: {},
    })).id;
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('delete from public.tenants where id = any($1::uuid[])', [[tenantId, foreignTenantId]]);
    await pool.query('delete from public.app_users where id = $1', [adminId]);
    await pool.end();
  });

  it('depose, liste et signe un fichier strictement dans le tenant', async () => {
    const file = await repository.upload(tenantId, 'project_item', itemId, {
      kind: 'proof', visibility: 'customer', filename: 'BAT épreuve.pdf',
      content_type: 'application/pdf', data_base64: btoa('PDF-content'),
    });
    expect(file).toMatchObject({ kind: 'proof', visibility: 'customer', byte_size: 11 });
    await expect(repository.list(tenantId, 'project_item', itemId))
      .resolves.toContainEqual(expect.objectContaining({ id: file.id }));
    const detail = await repository.getForRead(tenantId, 'project_item', itemId, file.id);
    expect(detail.preview_url).toContain('download=false');
    expect(detail.download_url).toContain('download=true');
    await expect(repository.list(foreignTenantId, 'project_item', itemId))
      .rejects.toMatchObject({ name: 'CommercialLineFileNotFoundError' });
    await expect(repository.list(tenantId, 'quote_line', itemId))
      .rejects.toMatchObject({ name: 'CommercialLineFileNotFoundError' });
  });

  it('rejoue un depot HTTP idempotent sans reteleverser l objet', async () => {
    const transactions = new PostgresTransactionRunner(pool, 'magrit_api');
    const handle = createGescomApiHandler({
      routes: createCommercialLineFilesRoutes(new CommercialLineFilesService(repository)),
      principalVerifier: new LocalApiPrincipalVerifier({
        identities: new PostgresOidcIdentityDirectory(pool),
        sessions: { async getSession() { return { user: { id: localSubject } }; } },
      }),
      idempotencyStore: new PostgresIdempotencyStore(transactions),
      requestIdFactory: () => 'commercial-files-integration',
    });
    const before = storage.uploadCount;
    const request = () => new Request(`http://api.local/api/v1/commercial-line-files/project_item/${itemId}`, {
      method: 'POST',
      headers: {
        cookie: 'better-auth.session_token=opaque',
        'x-magrit-tenant': tenantId,
        'content-type': 'application/json',
        'idempotency-key': 'commercial-file-upload-001',
      },
      body: JSON.stringify({
        kind: 'artwork', visibility: 'internal', filename: 'source.png',
        content_type: 'image/png', data_base64: btoa('PNG'),
      }),
    });
    const first = await handle(request());
    expect(first.status).toBe(201);
    const firstBody = await first.json() as { data: { id: string } };
    const replay = await handle(request());
    expect(replay.status).toBe(201);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    await expect(replay.json()).resolves.toMatchObject({ data: { id: firstBody.data.id } });
    expect(storage.uploadCount).toBe(before + 1);
  });
});
