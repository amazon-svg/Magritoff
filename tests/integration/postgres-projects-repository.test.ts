import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';
import { PostgresCustomersRepository } from '../../src/adapters/postgres/customers-repository.ts';
import { PostgresIdempotencyStore } from '../../src/adapters/postgres/idempotency-store.ts';
import { PostgresOidcIdentityDirectory } from '../../src/adapters/postgres/oidc-identity-directory.ts';
import { PostgresOutboxRepository } from '../../src/adapters/postgres/outbox-repository.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresProjectTagsRepository } from '../../src/adapters/postgres/project-tags-repository.ts';
import { PostgresProjectsRepository } from '../../src/adapters/postgres/projects-repository.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import { OutboxPublisher } from '../../src/modules/_shared/application/index.ts';
import type { ProjectCommercialFileStorage } from '../../src/modules/projects/application/projects-repository.ts';
import { ProjectsService } from '../../src/modules/projects/application/projects-service.ts';
import { createGescomApiHandler } from '../../src/server/api/gescom-middleware.ts';
import { createProjectsRoutes } from '../../src/server/api/projects-routes.ts';
import { LocalApiPrincipalVerifier } from '../../src/server/auth/local-api-principal-verifier.ts';

const integrationEnabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

class MemoryFileStorage implements ProjectCommercialFileStorage {
  readonly objects = new Map<string, Uint8Array>();
  readonly removed: string[] = [];

  async upload(file: Parameters<ProjectCommercialFileStorage['upload']>[0]) {
    const storagePath = `${file.tenantId}/${file.fileId}`;
    this.objects.set(storagePath, file.bytes);
    return { storagePath };
  }

  async remove(storagePath: string): Promise<void> {
    this.removed.push(storagePath);
    this.objects.delete(storagePath);
  }
}

describeIntegration('PostgresProjectsRepository — PostgreSQL reel', () => {
  let pool: Pool;
  let repository: PostgresProjectsRepository;
  let customers: PostgresCustomersRepository;
  let tags: PostgresProjectTagsRepository;
  let storage: MemoryFileStorage;
  const tenantId = randomUUID() as TenantId;
  const foreignTenantId = randomUUID() as TenantId;
  const adminId = randomUUID() as UserId;
  const localSubject = `projects-session-${randomUUID()}`;

  beforeAll(async () => {
    pool = createPostgresPool();
    const transactions = new PostgresTransactionRunner(pool, 'magrit_api');
    storage = new MemoryFileStorage();
    repository = new PostgresProjectsRepository(transactions, storage);
    customers = new PostgresCustomersRepository(transactions);
    tags = new PostgresProjectTagsRepository(transactions);
    await pool.query(`
      insert into public.app_users (id, email_normalized, display_name)
      values ($1, $2, 'Projects Admin')
    `, [adminId, `projects-${adminId}@example.invalid`]);
    await pool.query(`
      insert into public.tenants (id, slug, name)
      values ($1, $2, 'Projects Integration'), ($3, $4, 'Foreign Projects')
    `, [tenantId, `projects-${tenantId}`, foreignTenantId, `projects-${foreignTenantId}`]);
    await pool.query(
      `insert into public.tenant_members (tenant_id, user_id, role) values ($1, $2, 'admin')`,
      [tenantId, adminId],
    );
    await pool.query(`
      insert into public.user_identities (
        app_user_id, provider_type, provider_id, issuer, subject
      ) values ($1, 'local', 'better-auth', 'urn:magrit:local', $2)
    `, [adminId, localSubject]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(
      'update public.outbox_events set published_at = clock_timestamp() where tenant_id = $1',
      [tenantId],
    );
    await pool.query('delete from public.tenants where id = any($1::uuid[])', [[tenantId, foreignTenantId]]);
    await pool.query('delete from public.app_users where id = $1', [adminId]);
    await pool.end();
  });

  it('persiste les projets, recherche le nom client et filtre tous les tags', async () => {
    const customer = await customers.create(tenantId, adminId, {
      type: 'individual', civility: 'mrs', first_name: 'Anne, Marie', last_name: 'Martin',
    });
    const urgent = (await tags.createOrGet(tenantId, { label: 'Urgent', color: 'red' })).tag;
    const vip = (await tags.createOrGet(tenantId, { label: 'VIP', color: 'amber' })).tag;
    const project = await repository.create(tenantId, adminId, {
      name: 'Catalogue automne', customer_id: customer.id,
    });
    const tagged = await repository.replaceTags(tenantId, project.id, [urgent.id, vip.id]);
    expect(tagged.tags.map((tag) => tag.id)).toEqual([urgent.id, vip.id].sort());

    await expect(repository.list(tenantId, {
      q: 'Anne Marie', customerId: null, status: 'active', tagIds: [urgent.id, vip.id],
      size: 10, cursor: null,
    })).resolves.toMatchObject({ rows: [{ id: project.id }] });
    await expect(repository.list(tenantId, {
      q: null, customerId: null, status: null, tagIds: [urgent.id, randomUUID()],
      size: 10, cursor: null,
    })).resolves.toEqual({ rows: [] });
    await expect(repository.findById(foreignTenantId, project.id)).resolves.toBeNull();
    await expect(tags.delete(tenantId, urgent.id)).rejects.toMatchObject({
      code: 'project_tag.in_use',
    });
  });

  it('serialise les positions concurrentes et rattache les metadonnees aux objets S3', async () => {
    const customer = await customers.create(tenantId, adminId, {
      type: 'individual', civility: 'mr', first_name: 'Paul', last_name: 'Projet',
    });
    const project = await repository.create(tenantId, adminId, {
      name: 'Projet fichiers', customer_id: customer.id,
    });
    const [first, second] = await Promise.all([
      repository.addItem(tenantId, project.id, {
        label: 'Premier', quote_payload: { price: 10 },
        files: [{
          kind: 'supplier_quote', visibility: 'internal', filename: 'devis.pdf',
          content_type: 'application/pdf', data_base64: btoa('PDF'),
        }],
      }),
      repository.addItem(tenantId, project.id, {
        label: 'Second', quote_payload: { price: 20 },
      }),
    ]);
    expect([first.position, second.position].sort()).toEqual([0, 1]);
    expect(storage.objects.size).toBeGreaterThan(0);

    const detail = await repository.findDetailById(tenantId, project.id);
    expect(detail?.items.map((item) => item.position)).toEqual([0, 1]);
    const metadata = await pool.query(`
      select file.storage_path, file.byte_size
        from public.commercial_files file
        join public.project_item_files link on link.file_id = file.id
       where link.project_item_id = $1
    `, [first.label === 'Premier' ? first.id : second.id]);
    expect(metadata.rows[0]).toMatchObject({ byte_size: '3' });
    expect(storage.objects.has(metadata.rows[0]?.storage_path)).toBe(true);
  });

  it('nettoie les objets si la transaction de rattachement echoue', async () => {
    const before = storage.removed.length;
    await expect(repository.addItem(tenantId, randomUUID(), {
      label: 'Orphelin', quote_payload: {},
      files: [{
        kind: 'other', visibility: 'internal', filename: 'orphan.pdf',
        content_type: 'application/pdf', data_base64: btoa('orphan'),
      }],
    })).rejects.toMatchObject({ name: 'ProjectNotFoundError' });
    expect(storage.removed).toHaveLength(before + 1);
  });

  it('sert la facade locale et rejoue la creation sans doublonner l outbox', async () => {
    const customer = await customers.create(tenantId, adminId, {
      type: 'individual', civility: 'mrs', first_name: 'API', last_name: 'Projet',
    });
    const transactions = new PostgresTransactionRunner(pool, 'magrit_api');
    const handle = createGescomApiHandler({
      routes: createProjectsRoutes(new ProjectsService({
        repository,
        customers,
        projectTags: tags,
        outbox: new OutboxPublisher({
          repository: new PostgresOutboxRepository(transactions),
          now: () => new Date('2026-09-30T14:00:00.000Z'),
          newEventId: () => randomUUID(),
        }),
      })),
      principalVerifier: new LocalApiPrincipalVerifier({
        identities: new PostgresOidcIdentityDirectory(pool),
        sessions: { async getSession() { return { user: { id: localSubject } }; } },
      }),
      idempotencyStore: new PostgresIdempotencyStore(transactions),
      requestIdFactory: () => 'projects-integration',
    });
    const request = () => new Request('http://api.local/api/v1/projects', {
      method: 'POST',
      headers: {
        cookie: 'better-auth.session_token=opaque',
        'x-magrit-tenant': tenantId,
        'content-type': 'application/json',
        'idempotency-key': 'project-create-001',
      },
      body: JSON.stringify({ name: 'Projet API', customer_id: customer.id }),
    });
    const first = await handle(request());
    expect(first.status).toBe(201);
    const body = await first.json() as { data: { id: string } };
    const replay = await handle(request());
    expect(replay.status).toBe(201);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');

    const counts = await pool.query(`
      select
        (select count(*)::integer from public.projects where id = $2) as projects,
        (select count(*)::integer from public.outbox_events
          where tenant_id = $1 and event_name = 'project.created' and aggregate_id = $2) as events
    `, [tenantId, body.data.id]);
    expect(counts.rows[0]).toEqual({ projects: 1, events: 1 });
  });
});
