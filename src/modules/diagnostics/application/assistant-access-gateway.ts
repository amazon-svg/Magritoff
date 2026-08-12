import type { UserId } from '../../../kernel/ids/index.ts';

export interface AssistantAccessGateway {
  isTenantMember(actor: UserId, tenantId: string): Promise<boolean>;
}
