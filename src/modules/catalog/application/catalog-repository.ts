import type { UserId } from '../../../kernel/ids/index.ts';
import type { GammeSubscription, SetGammeSubscriptionsCommand } from '../api/contracts.ts';

export class CatalogRejectedError extends Error {
  constructor(public readonly code: 'permission_denied' | 'invalid_request', message: string) {
    super(message); this.name = 'CatalogRejectedError';
  }
}

export interface CatalogRepository {
  gammeSubscriptions(actor: UserId, tenantId: string): Promise<GammeSubscription[]>;
  setGammeSubscriptions(actor: UserId, tenantId: string, command: SetGammeSubscriptionsCommand): Promise<GammeSubscription[]>;
}
