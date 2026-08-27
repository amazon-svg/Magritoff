import { describe, expect, it, vi } from 'vitest';
import { parseId } from '@/kernel/ids';
import {
  HopeStudioSettingsRejectedError,
  HopeStudioTenantSettingsService,
} from '@/modules/hopstudio/application/hopstudio-tenant-settings-service';

const actor = parseId<'UserId'>('user-1');
if (!actor.ok) throw new Error('fixture invalide');

const settings = {
  enabled: false,
  hopeStudioUrl: null,
  clariprintUser: null,
  clariprintPasswordConfigured: false,
  clariprintUrl: null,
};

describe('HopeStudioTenantSettingsService', () => {
  it('refuse la lecture à un non-administrateur', async () => {
    const get = vi.fn();
    const service = new HopeStudioTenantSettingsService(
      { async canManage() { return false; } },
      { get, async update() {} },
    );

    await expect(service.get(actor.value, 'tenant-1')).rejects.toMatchObject({
      code: 'permission_denied',
    });
    expect(get).not.toHaveBeenCalled();
  });

  it('autorise un administrateur et délègue au dépôt', async () => {
    const get = vi.fn(async () => settings);
    const update = vi.fn(async () => undefined);
    const service = new HopeStudioTenantSettingsService(
      { async canManage() { return true; } },
      { get, update },
    );

    await expect(service.get(actor.value, 'tenant-1')).resolves.toEqual(settings);
    await service.update(actor.value, 'tenant-1', { enabled: true });
    expect(update).toHaveBeenCalledWith('tenant-1', { enabled: true });
  });

  it('conserve les erreurs techniques typées du dépôt', async () => {
    const service = new HopeStudioTenantSettingsService(
      { async canManage() { return true; } },
      {
        async get() { throw new HopeStudioSettingsRejectedError('storage_failed', 'panne'); },
        async update() {},
      },
    );
    await expect(service.get(actor.value, 'tenant-1')).rejects.toMatchObject({
      code: 'storage_failed',
    });
  });
});
