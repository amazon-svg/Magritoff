import { describe, expect, it, vi } from 'vitest';
import { PostgresCommercialRepository } from '../../../src/adapters/postgres/commercial-repository.ts';

describe('PostgresCommercialRepository', () => {
  it('compose l aperçu commercial depuis PostgreSQL', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{
        id: 'rule-1', tenant_id: 'tenant-1', name: 'Remise groupe',
        scope_type: 'group', group_id: 'group-1', user_id: null,
        target_type: 'gamme', gamme_slug: 'flyers', product_definition_id: null,
        adjust_mode: 'discount_pct', value: '12.5000', priority: 100, active: true,
        valid_from: null, valid_until: null, created_at: new Date('2026-10-01T08:00:00Z'),
      }] })
      .mockResolvedValueOnce({ rows: [{
        id: 'group-1', tenant_id: 'tenant-1', name: 'Revendeurs',
        created_at: new Date('2026-10-01T08:00:00Z'), member_count: '2',
      }] })
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-1', email: 'user@example.test' }] })
      .mockResolvedValueOnce({ rows: [{ slug: 'flyers', name: 'Flyers' }] });
    const run = vi.fn(async (_context, operation) => operation({ query }));
    const repository = new PostgresCommercialRepository({ run } as never);

    await expect(repository.overview('user-1' as never, 'tenant-1')).resolves.toEqual({
      available: true,
      rules: [expect.objectContaining({ id: 'rule-1', value: 12.5 })],
      groups: [expect.objectContaining({ id: 'group-1', member_count: 2 })],
      members: [{ user_id: 'user-1', email: 'user@example.test' }],
      gammes: [{ slug: 'flyers', name: 'Flyers' }],
    });
    expect(run).toHaveBeenCalledWith(
      { userId: 'user-1', tenantId: 'tenant-1' },
      expect.any(Function),
    );
  });

  it('verifie la capacite avant de creer un groupe', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ allowed: true }] })
      .mockResolvedValueOnce({ rows: [{
        id: 'group-1', tenant_id: 'tenant-1', name: 'Revendeurs',
        created_at: new Date('2026-10-01T08:00:00Z'), member_count: 0,
      }] });
    const run = vi.fn(async (_context, operation) => operation({ query }));
    const repository = new PostgresCommercialRepository({ run } as never);

    await expect(repository.createGroup('user-1' as never, 'tenant-1', 'Revendeurs'))
      .resolves.toMatchObject({ id: 'group-1', member_count: 0 });
    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('actor_has_capability'), [
      'tenant-1', 'can_manage_pricing',
    ]);
  });

  it('refuse une mutation sans capacite de gestion tarifaire', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ allowed: false }] });
    const run = vi.fn(async (_context, operation) => operation({ query }));
    const repository = new PostgresCommercialRepository({ run } as never);

    await expect(repository.removeRule('user-1' as never, 'tenant-1', 'rule-1'))
      .rejects.toThrow('Gestion commerciale interdite');
  });
});
