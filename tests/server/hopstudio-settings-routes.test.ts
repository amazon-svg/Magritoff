import { describe, expect, it, vi } from 'vitest';
import { createApiV1Application } from '@/server/api/composition';
import { createHopeStudioSettingsRoutes } from '@/server/api/hopstudio-settings-routes';
import { HopeStudioTenantSettingsService } from '@/modules/hopstudio/application/hopstudio-tenant-settings-service';

const settings = {
  enabled: true,
  hopeStudioUrl: 'https://hopstudio.test/json.wcl',
  clariprintUser: 'compte',
  clariprintPasswordConfigured: true,
  clariprintUrl: 'https://clariprint.test/json.wcl',
};

function application(canManage = true) {
  const update = vi.fn(async () => undefined);
  const service = new HopeStudioTenantSettingsService(
    { async canManage() { return canManage; } },
    { async get() { return settings; }, update },
  );
  const handle = createApiV1Application({
    routes: createHopeStudioSettingsRoutes(service),
    requestIdFactory: () => 'request-1',
    actorResolver: {
      async resolve() { return { kind: 'user', userId: 'user-1' as never }; },
    },
  });
  return { handle, update };
}

describe('routes de configuration HopeStudio', () => {
  it('retourne uniquement la vue expurgée', async () => {
    const { handle } = application();
    const response = await handle(new Request(
      'https://api.test/api/v1/tenants/tenant-1/integrations/hopstudio',
    ));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(settings);
    expect(JSON.stringify(body)).not.toContain('mot-de-passe');
  });

  it('valide et transmet la commande PUT', async () => {
    const { handle, update } = application();
    const response = await handle(new Request(
      'https://api.test/api/v1/tenants/tenant-1/integrations/hopstudio',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true, clariprintPassword: 'secret' }),
      },
    ));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ updated: true });
    expect(update).toHaveBeenCalledWith('tenant-1', {
      enabled: true,
      clariprintPassword: 'secret',
    });
  });

  it('renvoie 403 à un non-administrateur', async () => {
    const { handle } = application(false);
    const response = await handle(new Request(
      'https://api.test/api/v1/tenants/tenant-1/integrations/hopstudio',
    ));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'hopstudio.permission_denied' });
  });
});
