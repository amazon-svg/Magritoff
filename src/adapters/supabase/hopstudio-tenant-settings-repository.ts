import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import type { HopeStudioTenantSettings } from '../../modules/hopstudio/api/tenant-settings.ts';
import type { HopeStudioTenantConnectionResolver } from '../../modules/hopstudio/application/hopstudio-tenant-connection.ts';
import {
  HopeStudioSettingsRejectedError,
  type HopeStudioTenantSettingsAccessGateway,
  type HopeStudioTenantSettingsRepository,
} from '../../modules/hopstudio/application/hopstudio-tenant-settings-service.ts';
import type { UpdateHopeStudioTenantSettings } from '../../modules/hopstudio/api/tenant-settings.ts';
import type { Database } from '../../types/database.types.ts';
import type { HopeStudioSecretCipher } from '../hopstudio/web-crypto-secret-cipher.ts';

type SettingsRow = Database['public']['Tables']['tenant_hopstudio_settings']['Row'];
type SettingsInsert = Database['public']['Tables']['tenant_hopstudio_settings']['Insert'];

const EMPTY_SETTINGS: HopeStudioTenantSettings = Object.freeze({
  enabled: false,
  hopeStudioUrl: null,
  clariprintUser: null,
  clariprintPasswordConfigured: false,
  clariprintUrl: null,
});

export class SupabaseHopeStudioSettingsAccessGateway
implements HopeStudioTenantSettingsAccessGateway {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async canManage(_actor: UserId, tenantId: string): Promise<boolean> {
    const { data, error } = await this.client.rpc('user_has_capability', {
      p_tenant_id: tenantId,
      p_capability: 'can_manage_integrations',
    });
    if (error) throw storageError(error.message);
    return Boolean(data);
  }
}

/**
 * Persistance serveur de la connexion tenant. Le mot de passe est chiffré avant
 * l écriture et n est jamais inclus dans la vue retournée à l administration.
 */
export class SupabaseHopeStudioTenantSettingsRepository
implements HopeStudioTenantSettingsRepository, HopeStudioTenantConnectionResolver {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly cipher: HopeStudioSecretCipher,
  ) {}

  async get(tenantId: string): Promise<HopeStudioTenantSettings> {
    const row = await this.find(tenantId);
    return row ? publicView(row) : EMPTY_SETTINGS;
  }

  async update(tenantId: string, command: UpdateHopeStudioTenantSettings): Promise<void> {
    const current = await this.find(tenantId);
    let encryptedPassword = current?.clariprint_password_encrypted ?? null;
    if (command.clariprintPassword === null) encryptedPassword = null;
    else if (command.clariprintPassword !== undefined) {
      encryptedPassword = await this.cipher.encrypt(command.clariprintPassword, tenantId);
    }

    const values: SettingsInsert = {
      tenant_id: tenantId,
      enabled: command.enabled ?? current?.enabled ?? false,
      hope_studio_url: command.hopeStudioUrl === undefined
        ? current?.hope_studio_url ?? null
        : command.hopeStudioUrl,
      clariprint_user: command.clariprintUser === undefined
        ? current?.clariprint_user ?? null
        : command.clariprintUser,
      clariprint_password_encrypted: encryptedPassword,
      clariprint_url: command.clariprintUrl === undefined
        ? current?.clariprint_url ?? null
        : command.clariprintUrl,
      updated_at: new Date().toISOString(),
    };

    const { error } = await this.client
      .from('tenant_hopstudio_settings')
      .upsert(values, { onConflict: 'tenant_id' });
    if (error) throw storageError(error.message);
  }

  async resolve(tenantId: string) {
    const row = await this.find(tenantId);
    if (
      !row?.enabled
      || !row.hope_studio_url
    ) return null;

    const clariprint = row.clariprint_user && row.clariprint_password_encrypted
      ? Object.freeze({
          user: row.clariprint_user,
          password: await this.cipher.decrypt(row.clariprint_password_encrypted, tenantId),
          url: row.clariprint_url,
        })
      : null;

    return Object.freeze({
      tenantId,
      hopeStudioUrl: row.hope_studio_url,
      ...(clariprint ? { clariprint } : {}),
    });
  }

  private async find(tenantId: string): Promise<SettingsRow | null> {
    const { data, error } = await this.client
      .from('tenant_hopstudio_settings')
      .select('tenant_id, enabled, hope_studio_url, clariprint_user, clariprint_password_encrypted, clariprint_url, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw storageError(error.message);
    return data;
  }
}

function publicView(row: SettingsRow): HopeStudioTenantSettings {
  return Object.freeze({
    enabled: row.enabled,
    hopeStudioUrl: row.hope_studio_url,
    clariprintUser: row.clariprint_user,
    clariprintPasswordConfigured: row.clariprint_password_encrypted !== null,
    clariprintUrl: row.clariprint_url,
  });
}

function storageError(detail: string): HopeStudioSettingsRejectedError {
  return new HopeStudioSettingsRejectedError(
    'storage_failed',
    `Accès à la configuration Clariprint Studio impossible : ${detail}`,
  );
}
