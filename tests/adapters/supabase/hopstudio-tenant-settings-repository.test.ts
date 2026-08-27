import { describe, expect, it, vi } from 'vitest';
import { SupabaseHopeStudioTenantSettingsRepository } from '@/adapters/supabase/hopstudio-tenant-settings-repository';

describe('SupabaseHopeStudioTenantSettingsRepository.resolve', () => {
  it('résout une connexion HopeStudio même sans identifiants Clariprint', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        tenant_id: 'tenant-1',
        enabled: true,
        hope_studio_url: 'https://hopstudio.test/json.wcl',
        clariprint_user: null,
        clariprint_password_encrypted: null,
        clariprint_url: null,
        created_at: '2026-08-26T00:00:00Z',
        updated_at: '2026-08-26T00:00:00Z',
      },
      error: null,
    }));
    const client = {
      from() {
        return {
          select() {
            return { eq() { return { maybeSingle }; } };
          },
        };
      },
    };
    const decrypt = vi.fn();
    const repository = new SupabaseHopeStudioTenantSettingsRepository(
      client as never,
      { async encrypt() { return 'encrypted'; }, decrypt },
    );

    await expect(repository.resolve('tenant-1')).resolves.toEqual({
      tenantId: 'tenant-1',
      hopeStudioUrl: 'https://hopstudio.test/json.wcl',
    });
    expect(decrypt).not.toHaveBeenCalled();
  });
});
