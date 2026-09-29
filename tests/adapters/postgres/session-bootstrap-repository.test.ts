import { describe, expect, it, vi } from 'vitest';
import { PostgresSessionBootstrapRepository } from '../../../src/adapters/postgres/session-bootstrap-repository.ts';

describe('PostgresSessionBootstrapRepository', () => {
  it('traduit les roles PostgreSQL sans exposer les variantes internes', async () => {
    const run = vi.fn(async (_context, operation) => operation({
      query: vi.fn().mockResolvedValue({ rows: [{
        id: 'tenant-1',
        slug: 'atelier',
        name: 'Atelier',
        parent_tenant_id: null,
        plan: 'standard',
        is_system_tenant: false,
        settings: {},
        created_at: new Date('2026-09-29T00:00:00.000Z'),
        role: 'owner',
      }] }),
    }));
    const repository = new PostgresSessionBootstrapRepository({ run } as never);

    await expect(repository.listDirectMemberships('user-1' as never)).resolves.toEqual([{
      tenant: {
        id: 'tenant-1',
        slug: 'atelier',
        name: 'Atelier',
        parent_tenant_id: null,
        plan: 'freemium',
        is_system_tenant: false,
        settings: {},
        created_at: '2026-09-29T00:00:00.000Z',
      },
      role: 'admin',
      accessScope: 'magrit_full',
      allowedShopIds: [],
      permissions: { can_quote: true, can_order: true, can_invite: true },
    }]);
  });

  it('met a jour uniquement les preferences fournies', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{
      theme: 'dark',
      language: 'fr',
      default_delivery_zone: 'FR-75',
      notifications_email: true,
      plan: 'freemium',
      is_admin: false,
      last_tenant_id: null,
    }] });
    const run = vi.fn(async (_context, operation) => operation({ query }));
    const repository = new PostgresSessionBootstrapRepository({ run } as never);

    await expect(repository.updatePreferences('user-1' as never, { theme: 'dark' }))
      .resolves.toMatchObject({ theme: 'dark', language: 'fr' });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('on conflict (user_id)'), [
      'user-1', 'dark', null, null, null,
    ]);
  });

  it('memorise le tenant courant', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{
      theme: 'light',
      language: 'fr',
      default_delivery_zone: 'FR-75',
      notifications_email: true,
      plan: 'freemium',
      is_admin: false,
      last_tenant_id: 'tenant-1',
    }] });
    const run = vi.fn(async (_context, operation) => operation({ query }));
    const repository = new PostgresSessionBootstrapRepository({ run } as never);

    await expect(repository.updateLastTenant('user-1' as never, 'tenant-1'))
      .resolves.toMatchObject({ last_tenant_id: 'tenant-1' });
    expect(run).toHaveBeenCalledWith({ userId: 'user-1' }, expect.any(Function));
  });
});
