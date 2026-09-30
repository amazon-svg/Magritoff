import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import type {
  CommercialSettingsDto,
  UpdateCommercialSettingsCommand,
} from '../../modules/commercial-settings/api/contracts.ts';
import type { CommercialSettingsRepository } from '../../modules/commercial-settings/application/commercial-settings-repository.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

const ORDER_FILE_PURGE_ACTIVATION_FLOOR_DAYS = 30;

type SettingsRow = Readonly<{
  tenant_id: string;
  default_validity_days: number | null;
  order_file_purge_enabled: boolean;
  order_file_purge_enabled_at: Date | null;
  notification_retention_days: number;
  notification_sms_enabled: boolean;
  notification_sms_daily_cap: number;
  updated_at: Date;
}>;

export class PostgresCommercialSettingsRepository implements CommercialSettingsRepository {
  constructor(private readonly transactions: PostgresTransactionRunner) {}

  get(tenantId: TenantId, actorId: UserId): Promise<CommercialSettingsDto> {
    return this.transactions.run({ tenantId, userId: actorId }, async (client) => {
      const result = await client.query<SettingsRow>(
        'select * from magrit.get_commercial_settings($1)',
        [tenantId],
      );
      const row = result.rows[0];
      if (row === undefined) throw new Error('Reglages commerciaux inaccessibles.');
      return toDto(row);
    });
  }

  update(
    tenantId: TenantId,
    actorId: UserId,
    command: UpdateCommercialSettingsCommand,
  ): Promise<CommercialSettingsDto> {
    return this.transactions.run({ tenantId, userId: actorId }, async (client) => {
      const columns: string[] = [];
      const values: unknown[] = [tenantId];
      for (const [field, value] of Object.entries(command)) {
        columns.push(`${field} = $${values.length + 1}`);
        values.push(value);
      }
      const result = await client.query<SettingsRow>(`
        update public.commercial_settings
           set ${columns.join(', ')}
         where tenant_id = $1
         returning *
      `, values);
      const row = result.rows[0];
      if (row === undefined) throw new Error('Reglages commerciaux inaccessibles ou modification interdite.');
      return toDto(row);
    });
  }

  actorHasCapability(
    tenantId: TenantId,
    actorId: UserId,
    capability: string,
  ): Promise<boolean> {
    return this.transactions.run({ tenantId, userId: actorId }, async (client) => {
      const result = await client.query<{ allowed: boolean }>(
        'select magrit.actor_has_capability($1, $2) as allowed',
        [tenantId, capability],
      );
      return result.rows[0]?.allowed === true;
    });
  }
}

function toDto(row: SettingsRow): CommercialSettingsDto {
  const enabledAt = row.order_file_purge_enabled_at;
  return {
    tenant_id: row.tenant_id,
    default_validity_days: row.default_validity_days,
    order_file_purge_enabled: row.order_file_purge_enabled,
    notification_retention_days: row.notification_retention_days,
    notification_sms_enabled: row.notification_sms_enabled,
    notification_sms_daily_cap: row.notification_sms_daily_cap,
    order_file_purge_effective_from: enabledAt === null
      ? null
      : toIsoTimestamp(new Date(
          enabledAt.getTime() + ORDER_FILE_PURGE_ACTIVATION_FLOOR_DAYS * 24 * 60 * 60 * 1000,
        )),
    updated_at: toIsoTimestamp(row.updated_at),
  };
}
