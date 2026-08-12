import type { UserId } from '../../../kernel/ids/index.ts';
import type { SetGammeSubscriptionsCommand, UpsertPimDefinitionCommand, UpsertPimGammeCommand } from '../api/contracts.ts';
import type { CatalogRepository } from './catalog-repository.ts';

export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}
  gammeSubscriptions(actor: UserId, tenantId: string) { return this.repository.gammeSubscriptions(actor, tenantId); }
  setGammeSubscriptions(actor: UserId, tenantId: string, command: SetGammeSubscriptionsCommand) { return this.repository.setGammeSubscriptions(actor, tenantId, command); }
  pimCatalog(actor: UserId) { return this.repository.pimCatalog(actor); }
  upsertPimGamme(actor: UserId, command: UpsertPimGammeCommand) { return this.repository.upsertPimGamme(actor, command); }
  deletePimGamme(actor: UserId, slug: string) { return this.repository.deletePimGamme(actor, slug); }
  upsertPimDefinition(actor: UserId, command: UpsertPimDefinitionCommand) { return this.repository.upsertPimDefinition(actor, command); }
  deletePimDefinition(actor: UserId, id: string) { return this.repository.deletePimDefinition(actor, id); }
}
