import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import type { UserId } from '../../src/kernel/ids/index.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import { PostgresConversationsRepository } from '../../src/adapters/postgres/conversations-repository.ts';
import { ConversationRejectedError } from '../../src/modules/conversations/application/conversations-repository.ts';

const integrationEnabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('PostgresConversationsRepository — PostgreSQL reel', () => {
  let pool: Pool;
  let repository: PostgresConversationsRepository;
  const actorA = randomUUID() as UserId;
  const actorB = randomUUID() as UserId;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const conversationId = `integration-${randomUUID()}`;

  beforeAll(async () => {
    pool = createPostgresPool();
    repository = new PostgresConversationsRepository(new PostgresTransactionRunner(pool, 'magrit_api'));
    await pool.query(`
      insert into public.app_users (id, email_normalized, display_name)
      values ($1, $2, 'Integration A'), ($3, $4, 'Integration B')
    `, [
      actorA, `integration-${actorA}@example.invalid`,
      actorB, `integration-${actorB}@example.invalid`,
    ]);
    await pool.query(`
      insert into public.tenants (id, slug, name)
      values ($1, $2, 'Integration A'), ($3, $4, 'Integration B')
    `, [tenantA, `integration-${tenantA}`, tenantB, `integration-${tenantB}`]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('delete from public.conversations where id = $1', [conversationId]);
    await pool.query('delete from public.tenants where id = any($1::uuid[])', [[tenantA, tenantB]]);
    await pool.query('delete from public.app_users where id = any($1::uuid[])', [[actorA, actorB]]);
    await pool.end();
  });

  it('respecte le contrat save/list/remove et l isolation acteur/tenant', async () => {
    const initial = {
      title: 'Premier echange',
      timestamp: Date.parse('2026-09-29T12:00:00.000Z'),
      messages: [{ role: 'user', content: 'Bonjour' }],
      products: [{ id: 'flyer' }],
    };
    await repository.save(actorA, tenantA, conversationId, initial);

    await expect(repository.list(actorA, tenantA)).resolves.toContainEqual({
      id: conversationId,
      ...initial,
    });
    await expect(repository.list(actorA, tenantB)).resolves.not.toContainEqual(expect.objectContaining({ id: conversationId }));

    await expect(repository.save(actorB, tenantA, conversationId, {
      ...initial,
      title: 'Tentative concurrente',
    })).rejects.toMatchObject<Partial<ConversationRejectedError>>({ code: 'permission_denied' });

    await expect(repository.remove(actorB, tenantA, conversationId)).rejects.toMatchObject<Partial<ConversationRejectedError>>({ code: 'not_found' });
    await expect(repository.remove(actorA, tenantA, conversationId)).resolves.toBeUndefined();
    await expect(repository.list(actorA, tenantA)).resolves.not.toContainEqual(expect.objectContaining({ id: conversationId }));
  });
});
