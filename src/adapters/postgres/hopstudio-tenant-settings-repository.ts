import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import type { HopeStudioTenantSettings, UpdateHopeStudioTenantSettings } from '../../modules/hopstudio/api/tenant-settings.ts';
import type { HopeStudioTenantConnectionResolver } from '../../modules/hopstudio/application/hopstudio-tenant-connection.ts';
import {
  HopeStudioSettingsRejectedError,
  type HopeStudioTenantSettingsAccessGateway,
  type HopeStudioTenantSettingsRepository,
} from '../../modules/hopstudio/application/hopstudio-tenant-settings-service.ts';
import type { HopeStudioSecretCipher } from '../hopstudio/web-crypto-secret-cipher.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type Row = Readonly<{
  tenant_id: string;
  enabled: boolean;
  hope_studio_url: string | null;
  clariprint_user: string | null;
  clariprint_password_encrypted: string | null;
  clariprint_url: string | null;
}>;

const EMPTY_SETTINGS: HopeStudioTenantSettings = Object.freeze({
  enabled: false,
  hopeStudioUrl: null,
  clariprintUser: null,
  clariprintPasswordConfigured: false,
  clariprintUrl: null,
});

export class PostgresHopeStudioSettingsAccessGateway implements HopeStudioTenantSettingsAccessGateway {
  constructor(private readonly tx: PostgresTransactionRunner) {}

  async canManage(actor: UserId, tenantId: string): Promise<boolean> {
    try {
      return await this.tx.run({ userId: actor, tenantId: tenantId as TenantId }, async (client) => {
        const result = await client.query<{ allowed: boolean }>(`
          select
            exists(
              select 1 from public.user_preferences
               where user_id=magrit.current_user_id() and is_admin
            )
            or exists(
              select 1 from public.tenant_members
               where tenant_id=$1::uuid
                 and user_id=magrit.current_user_id()
                 and role in ('owner','admin')
            )
            or magrit.actor_has_capability($1::uuid,'can_manage_integrations') allowed
        `, [tenantId]);
        return result.rows[0]?.allowed === true;
      });
    } catch (error) {
      throw storageError(error);
    }
  }
}

export class PostgresHopeStudioTenantSettingsRepository
implements HopeStudioTenantSettingsRepository, HopeStudioTenantConnectionResolver {
  constructor(
    private readonly tx: PostgresTransactionRunner,
    private readonly cipher: HopeStudioSecretCipher,
  ) {}

  async get(tenantId: string): Promise<HopeStudioTenantSettings> {
    const row = await this.find(tenantId);
    return row === null ? EMPTY_SETTINGS : publicView(row);
  }

  async update(tenantId: string, command: UpdateHopeStudioTenantSettings): Promise<void> {
    const current = await this.find(tenantId);
    let password = current?.clariprint_password_encrypted ?? null;
    if (command.clariprintPassword === null) password = null;
    else if (command.clariprintPassword !== undefined) {
      password = await this.cipher.encrypt(command.clariprintPassword, tenantId);
    }
    try {
      await this.tx.run({ tenantId: tenantId as TenantId }, async (client) => {
        await client.query(`
          insert into public.tenant_hopstudio_settings(
            tenant_id,enabled,hope_studio_url,clariprint_user,
            clariprint_password_encrypted,clariprint_url,updated_at
          ) values($1,$2,$3,$4,$5,$6,clock_timestamp())
          on conflict(tenant_id) do update set
            enabled=excluded.enabled,
            hope_studio_url=excluded.hope_studio_url,
            clariprint_user=excluded.clariprint_user,
            clariprint_password_encrypted=excluded.clariprint_password_encrypted,
            clariprint_url=excluded.clariprint_url,
            updated_at=clock_timestamp()
        `, [
          tenantId,
          command.enabled ?? current?.enabled ?? false,
          command.hopeStudioUrl === undefined ? current?.hope_studio_url ?? null : command.hopeStudioUrl,
          command.clariprintUser === undefined ? current?.clariprint_user ?? null : command.clariprintUser,
          password,
          command.clariprintUrl === undefined ? current?.clariprint_url ?? null : command.clariprintUrl,
        ]);
      });
    } catch (error) {
      throw storageError(error);
    }
  }

  async resolve(tenantId: string) {
    const row = await this.find(tenantId);
    if (!row?.enabled || !row.hope_studio_url) return null;
    const clariprint = row.clariprint_user && row.clariprint_password_encrypted
      ? {
          user: row.clariprint_user,
          password: await this.cipher.decrypt(row.clariprint_password_encrypted, tenantId),
          url: row.clariprint_url,
        }
      : null;
    return Object.freeze({
      tenantId,
      hopeStudioUrl: row.hope_studio_url,
      ...(clariprint === null ? {} : { clariprint: Object.freeze(clariprint) }),
    });
  }

  private async find(tenantId: string): Promise<Row | null> {
    try {
      return await this.tx.run({ tenantId: tenantId as TenantId }, async (client) => {
        const result = await client.query<Row>(`
          select tenant_id,enabled,hope_studio_url,clariprint_user,
                 clariprint_password_encrypted,clariprint_url
            from public.tenant_hopstudio_settings where tenant_id=$1
        `, [tenantId]);
        return result.rows[0] ?? null;
      });
    } catch (error) {
      throw storageError(error);
    }
  }
}

function publicView(row: Row): HopeStudioTenantSettings {
  return Object.freeze({
    enabled: row.enabled,
    hopeStudioUrl: row.hope_studio_url,
    clariprintUser: row.clariprint_user,
    clariprintPasswordConfigured: row.clariprint_password_encrypted !== null,
    clariprintUrl: row.clariprint_url,
  });
}

function storageError(error: unknown): HopeStudioSettingsRejectedError {
  const detail = error instanceof Error ? error.message : String(error);
  return new HopeStudioSettingsRejectedError('storage_failed', `Accès à la configuration HopeStudio impossible : ${detail}`);
}
