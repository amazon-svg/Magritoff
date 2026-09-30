import { describe, expect, it, vi } from 'vitest';
import { PostgresSessionBootstrapRepository } from '../../../src/adapters/postgres/session-bootstrap-repository.ts';
import { SessionInvitationAcceptanceError, SessionTenantMutationError } from '../../../src/modules/session/application/session-repository.ts';

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
        siren: null,
        siren_data: null,
        verified: false,
        verified_at: null,
        tax_regime: 'metropole_fr',
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

  it('resout un slug courant ou historique', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ slug: 'nouvel-atelier' }] });
    const run = vi.fn(async (_context, operation) => operation({ query }));
    const repository = new PostgresSessionBootstrapRepository({ run } as never);

    await expect(repository.resolveTenantSlug('user-1' as never, 'ancien-atelier'))
      .resolves.toBe('nouvel-atelier');
    expect(run).toHaveBeenCalledWith({ userId: 'user-1' }, expect.any(Function));
  });

  it('traduit un conflit de slug PostgreSQL', async () => {
    const run = vi.fn(async (_context, operation) => operation({
      query: vi.fn().mockRejectedValue(Object.assign(new Error('duplicate'), { code: '23505' })),
    }));
    const repository = new PostgresSessionBootstrapRepository({ run } as never);

    await expect(repository.updateTenantSettings(
      'user-1' as never,
      'tenant-1',
      { slug: 'slug-utilise' },
    )).rejects.toMatchObject<Partial<SessionTenantMutationError>>({ code: 'conflict' });
  });

  it('cree un tenant racine et transmet les donnees d onboarding', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ tenant_id: 'tenant-created' }] });
    const run = vi.fn(async (_context, operation) => operation({ query }));
    const repository = new PostgresSessionBootstrapRepository({ run } as never);

    await expect(repository.createRootTenant('user-1' as never, {
      slug: 'nouvel-atelier',
      name: 'Nouvel atelier',
      siren: '123456789',
      sirenData: { denomination: 'Nouvel atelier SAS' },
      gammeSlugs: ['flyers', 'brochures'],
    })).resolves.toBe('tenant-created');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('magrit.create_root_tenant'), [
      'nouvel-atelier',
      'Nouvel atelier',
      '123456789',
      JSON.stringify({ denomination: 'Nouvel atelier SAS' }),
      ['flyers', 'brochures'],
    ]);
  });

  it('cree et supprime un sous-espace via les fonctions bornees', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ tenant_id: 'subtenant-created' }] })
      .mockResolvedValueOnce({ rows: [{ result: 'removed' }] });
    const run = vi.fn(async (_context, operation) => operation({ query }));
    const repository = new PostgresSessionBootstrapRepository({ run } as never);

    await expect(repository.createSubTenant('user-1' as never, 'tenant-parent', {
      slug: 'filiale-lyon',
      name: 'Filiale Lyon',
    })).resolves.toBe('subtenant-created');
    await expect(repository.removeSubTenant(
      'user-1' as never,
      'tenant-parent',
      'subtenant-created',
    )).resolves.toBeUndefined();
  });

  it('distingue un sous-espace absent pendant la suppression', async () => {
    const run = vi.fn(async (_context, operation) => operation({
      query: vi.fn().mockResolvedValue({ rows: [{ result: 'not_found' }] }),
    }));
    const repository = new PostgresSessionBootstrapRepository({ run } as never);

    await expect(repository.removeSubTenant(
      'user-1' as never,
      'tenant-parent',
      'subtenant-absent',
    )).rejects.toMatchObject<Partial<SessionTenantMutationError>>({ code: 'not_found' });
  });

  it('accepte une invitation avec le condensat du jeton', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ tenant_id: 'tenant-invite' }] });
    const run = vi.fn(async (_context, operation) => operation({ query }));
    const repository = new PostgresSessionBootstrapRepository({ run } as never);

    await expect(repository.acceptInvitation('user-1' as never, 'jeton-secret'))
      .resolves.toBe('tenant-invite');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('magrit.accept_tenant_invitation'),
      ['3645d6a4ce16f52d2d53ff39a7a864f7461af48e8a666121fd40dda5a945b235'],
    );
  });

  it('distingue une invitation destinee a un autre compte', async () => {
    const run = vi.fn().mockRejectedValue(new Error('invitation_email_mismatch'));
    const repository = new PostgresSessionBootstrapRepository({ run } as never);

    await expect(repository.acceptInvitation('user-1' as never, 'jeton-secret'))
      .rejects.toMatchObject<Partial<SessionInvitationAcceptanceError>>({ code: 'email_mismatch' });
  });
});
