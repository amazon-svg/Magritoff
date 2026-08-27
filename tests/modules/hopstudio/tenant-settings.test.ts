import { describe, expect, it } from 'vitest';
import {
  hopeStudioTenantSettingsSchema,
  updateHopeStudioTenantSettingsSchema,
} from '@/modules/hopstudio';

describe('configuration HopeStudio par tenant', () => {
  it('accepte les URLs et credentials administrables', () => {
    expect(updateHopeStudioTenantSettingsSchema.parse({
      enabled: true,
      hopeStudioUrl: 'https://hopstudio.tenant.test/json.wcl',
      clariprintUser: 'tenant-login',
      clariprintPassword: ' secret conservé tel quel ',
      clariprintUrl: 'https://clariprint.tenant.test/json.wcl',
    }).clariprintPassword).toBe(' secret conservé tel quel ');
  });

  it('interdit de renvoyer le mot de passe dans la vue administrateur', () => {
    const result = hopeStudioTenantSettingsSchema.safeParse({
      enabled: true,
      hopeStudioUrl: null,
      clariprintUser: 'tenant-login',
      clariprintPasswordConfigured: true,
      clariprintUrl: null,
      clariprintPassword: 'secret',
    });

    expect(result.success).toBe(false);
  });
});
