import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import type { AssistantAccessGateway } from '../../modules/diagnostics/application/assistant-access-gateway.ts';
import type { PlatformAdminGateway } from '../../modules/diagnostics/application/platform-admin-gateway.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

export class PostgresDiagnosticsAccessGateway implements PlatformAdminGateway, AssistantAccessGateway {
  constructor(private readonly tx: PostgresTransactionRunner) {}

  isPlatformAdmin(actor: UserId): Promise<boolean> {
    return this.tx.run({ userId: actor }, async (client) => {
      const result = await client.query<{ allowed: boolean }>(
        'select exists(select 1 from public.user_preferences where user_id = $1 and is_admin) allowed',
        [actor],
      );
      return result.rows[0]?.allowed === true;
    });
  }

  isTenantMember(actor: UserId, tenantId: string): Promise<boolean> {
    return this.tx.run({ userId: actor, tenantId: tenantId as TenantId }, async (client) => {
      const result = await client.query(
        'select 1 from public.tenant_members where tenant_id = $1 and user_id = $2',
        [tenantId, actor],
      );
      return result.rowCount === 1;
    });
  }
}
