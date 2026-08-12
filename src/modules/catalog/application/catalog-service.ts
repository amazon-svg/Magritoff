import type { UserId } from '../../../kernel/ids/index.ts';
import type { SetGammeSubscriptionsCommand } from '../api/contracts.ts';
import type { CatalogRepository } from './catalog-repository.ts';

export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}
  gammeSubscriptions(actor: UserId, tenantId: string) { return this.repository.gammeSubscriptions(actor, tenantId); }
  setGammeSubscriptions(actor: UserId, tenantId: string, command: SetGammeSubscriptionsCommand) { return this.repository.setGammeSubscriptions(actor, tenantId, command); }
}
