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
});
