import { describe, expect, it, vi } from 'vitest';
import {
  PostgresHopeStudioSettingsAccessGateway,
  PostgresHopeStudioTenantSettingsRepository,
} from '../../../src/adapters/postgres/hopstudio-tenant-settings-repository.ts';
import type { HopeStudioSecretCipher } from '../../../src/adapters/hopstudio/web-crypto-secret-cipher.ts';
import { HopeStudioSettingsRejectedError } from '../../../src/modules/hopstudio/application/hopstudio-tenant-settings-service.ts';

const STORED_SETTINGS = Object.freeze({
  tenant_id: 'tenant-1',
  enabled: true,
  hope_studio_url: 'https://hopstudio.test/json.wcl',
  clariprint_user: 'atelier',
  clariprint_password_encrypted: 'encrypted-password',
  clariprint_url: 'https://clariprint.test',
});

function cipher(): HopeStudioSecretCipher {
  return {
    encrypt: vi.fn().mockResolvedValue('new-encrypted-password'),
    decrypt: vi.fn().mockResolvedValue('clear-password'),
  };
}

describe('adaptateur PostgreSQL HopeStudio', () => {
  it('evalue la capacite de gestion dans le contexte RLS de l acteur', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ allowed: true }] });
    const run = vi.fn(async (_context, operation) => operation({ query }));
    const access = new PostgresHopeStudioSettingsAccessGateway({ run } as never);

    await expect(access.canManage('user-1' as never, 'tenant-1')).resolves.toBe(true);
    expect(run).toHaveBeenCalledWith(
      { userId: 'user-1', tenantId: 'tenant-1' },
      expect.any(Function),
    );
    expect(query).toHaveBeenCalledWith(expect.stringContaining('can_manage_integrations'), ['tenant-1']);
  });

  it('retourne une vue publique sans exposer le mot de passe chiffre', async () => {
    const run = vi.fn(async (_context, operation) => operation({
      query: vi.fn().mockResolvedValue({ rows: [STORED_SETTINGS] }),
    }));
    const repository = new PostgresHopeStudioTenantSettingsRepository({ run } as never, cipher());

    await expect(repository.get('tenant-1')).resolves.toEqual({
      enabled: true,
      hopeStudioUrl: 'https://hopstudio.test/json.wcl',
      clariprintUser: 'atelier',
      clariprintPasswordConfigured: true,
      clariprintUrl: 'https://clariprint.test',
    });
  });

  it('chiffre un nouveau mot de passe avant l upsert', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [STORED_SETTINGS] })
      .mockResolvedValueOnce({ rows: [] });
    const run = vi.fn(async (_context, operation) => operation({ query }));
    const secretCipher = cipher();
    const repository = new PostgresHopeStudioTenantSettingsRepository({ run } as never, secretCipher);

    await repository.update('tenant-1', {
      enabled: false,
      clariprintPassword: 'new-password',
    });

    expect(secretCipher.encrypt).toHaveBeenCalledWith('new-password', 'tenant-1');
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('on conflict(tenant_id)'), [
      'tenant-1',
      false,
      'https://hopstudio.test/json.wcl',
      'atelier',
      'new-encrypted-password',
      'https://clariprint.test',
    ]);
  });

  it('dechiffre le secret uniquement pour la connexion serveur', async () => {
    const run = vi.fn(async (_context, operation) => operation({
      query: vi.fn().mockResolvedValue({ rows: [STORED_SETTINGS] }),
    }));
    const secretCipher = cipher();
    const repository = new PostgresHopeStudioTenantSettingsRepository({ run } as never, secretCipher);

    await expect(repository.resolve('tenant-1')).resolves.toEqual({
      tenantId: 'tenant-1',
      hopeStudioUrl: 'https://hopstudio.test/json.wcl',
      clariprint: {
        user: 'atelier',
        password: 'clear-password',
        url: 'https://clariprint.test',
      },
    });
    expect(secretCipher.decrypt).toHaveBeenCalledWith('encrypted-password', 'tenant-1');
  });

  it('traduit les erreurs PostgreSQL dans le contrat applicatif', async () => {
    const run = vi.fn().mockRejectedValue(new Error('database unavailable'));
    const repository = new PostgresHopeStudioTenantSettingsRepository({ run } as never, cipher());

    await expect(repository.get('tenant-1')).rejects.toMatchObject<Partial<HopeStudioSettingsRejectedError>>({
      code: 'storage_failed',
    });
  });
});
