import { describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import type { TenantId, UserId } from '../../../src/kernel/ids/index.ts';
import { PostgresTransactionRunner } from '../../../src/adapters/postgres/transaction-runner.ts';

describe('PostgresTransactionRunner', () => {
  it('pose le contexte dans la transaction puis commit et libere la connexion', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const release = vi.fn();
    const client = { query, release } as unknown as PoolClient;
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
    const runner = new PostgresTransactionRunner(pool);
    const operation = vi.fn().mockResolvedValue('resultat');

    await expect(runner.run({
      userId: '00000000-0000-4000-8000-000000000001' as UserId,
      tenantId: '00000000-0000-4000-8000-000000000002' as TenantId,
    }, operation)).resolves.toBe('resultat');

    expect(query.mock.calls.map(([sql]) => sql.trim().replace(/\s+/g, ' '))).toEqual([
      'begin',
      "select set_config('magrit.user_id', $1, true), set_config('magrit.tenant_id', $2, true), set_config('magrit.actor_kind', $3, true)",
      'commit',
    ]);
    expect(query.mock.calls[1]?.[1]).toEqual([
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      '',
    ]);
    expect(operation).toHaveBeenCalledWith(client);
    expect(release).toHaveBeenCalledOnce();
  });

  it('rollback et libere la connexion quand l operation echoue', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const release = vi.fn();
    const client = { query, release } as unknown as PoolClient;
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
    const runner = new PostgresTransactionRunner(pool);
    const failure = new Error('echec metier');

    await expect(runner.run({}, async () => { throw failure; })).rejects.toBe(failure);

    expect(query.mock.calls.map(([sql]) => sql.trim().replace(/\s+/g, ' '))).toEqual([
      'begin',
      "select set_config('magrit.user_id', $1, true), set_config('magrit.tenant_id', $2, true), set_config('magrit.actor_kind', $3, true)",
      'rollback',
    ]);
    expect(query.mock.calls[1]?.[1]).toEqual(['', '', '']);
    expect(release).toHaveBeenCalledOnce();
  });

  it('peut imposer un role runtime non privilegie dans la transaction', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const client = { query, release: vi.fn() } as unknown as PoolClient;
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
    const runner = new PostgresTransactionRunner(pool, 'magrit_api');

    await runner.run({}, async () => undefined);

    expect(query.mock.calls.map(([sql]) => sql.trim().replace(/\s+/g, ' '))).toEqual([
      'begin',
      'set local role "magrit_api"',
      "select set_config('magrit.user_id', $1, true), set_config('magrit.tenant_id', $2, true), set_config('magrit.actor_kind', $3, true)",
      'commit',
    ]);
    expect(() => new PostgresTransactionRunner(pool, 'role; reset role')).toThrow(/Role PostgreSQL invalide/);
  });
});

// Concurrent requests must never exchange identities, and workers retain explicit contexts.
describe('contexte authentifié de requête PostgreSQL', () => {
  it('hérite seulement pour le même tenant et conserve les identités explicites', async () => {
    const { withAuthenticatedPostgresRequest } = await import('../../../src/adapters/postgres/authenticated-request-context.ts');
    const tenant = '10000000-0000-4000-8000-000000000001' as TenantId;
    const user = '20000000-0000-4000-8000-000000000001' as UserId;
    const explicit = '20000000-0000-4000-8000-000000000002' as UserId;
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const runner = new PostgresTransactionRunner({ connect: async () => ({ query, release: vi.fn() }) } as unknown as Pool);
    await withAuthenticatedPostgresRequest({ tenantId: tenant, userId: user }, async () => {
      await runner.run({ tenantId: tenant }, async () => undefined);
      await runner.run({ tenantId: tenant, userId: explicit }, async () => undefined);
      await runner.run({ tenantId: '10000000-0000-4000-8000-000000000002' as TenantId }, async () => undefined);
      await runner.run({ tenantId: tenant, actorKind: 'service' }, async () => undefined);
      await runner.run({}, async () => undefined);
    });
    await runner.run({ tenantId: tenant }, async () => undefined);
    const contexts = query.mock.calls.filter(([sql]) => sql.includes('set_config')).map(([, values]) => values);
    expect(contexts).toEqual([[user, tenant, ''], [explicit, tenant, ''], ['', '10000000-0000-4000-8000-000000000002', ''], ['', tenant, 'service'], ['', '', ''], ['', tenant, '']]);
  });

  it('isole les utilisateurs concurrents sur le même tenant et nettoie aussi après erreur', async () => {
    const { withAuthenticatedPostgresRequest, authenticatedPostgresRequest } = await import('../../../src/adapters/postgres/authenticated-request-context.ts');
    const tenant = '10000000-0000-4000-8000-000000000001' as TenantId;
    const users = ['20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'] as UserId[];
    let ready!: () => void;
    const barrier = new Promise<void>(resolve => { ready = resolve; });
    const results = await Promise.all(users.map((userId, index) => withAuthenticatedPostgresRequest({ tenantId: tenant, userId }, async () => {
      if (index === 1) ready();
      await barrier;
      return authenticatedPostgresRequest()?.userId;
    })));
    expect(results).toEqual(users);
    expect(authenticatedPostgresRequest()).toBeUndefined();
    await expect(withAuthenticatedPostgresRequest({ tenantId: tenant, userId: users[0]! }, async () => { throw new Error('Erreur'); })).rejects.toThrow('Erreur');
    expect(authenticatedPostgresRequest()).toBeUndefined();
  });
});
