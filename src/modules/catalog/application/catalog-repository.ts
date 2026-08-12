import type { UserId } from '../../../kernel/ids/index.ts';
import type { GeneratePimDefinitionCommand, GammeSubscription, PimCatalog, PimDefinition, PimGamme, PimIngestReport, RunPimIngestCommand, SetGammeSubscriptionsCommand, UpsertPimDefinitionCommand, UpsertPimGammeCommand } from '../api/contracts.ts';

export class CatalogRejectedError extends Error {
  constructor(public readonly code: 'permission_denied' | 'invalid_request' | 'not_found' | 'conflict' | 'upstream_error', message: string) {
    super(message); this.name = 'CatalogRejectedError';
  }
}

export interface CatalogRepository {
  gammeSubscriptions(actor: UserId, tenantId: string): Promise<GammeSubscription[]>;
  setGammeSubscriptions(actor: UserId, tenantId: string, command: SetGammeSubscriptionsCommand): Promise<GammeSubscription[]>;
  pimCatalog(actor: UserId): Promise<PimCatalog>;
  upsertPimGamme(actor: UserId, command: UpsertPimGammeCommand): Promise<PimGamme>;
  deletePimGamme(actor: UserId, slug: string): Promise<void>;
  upsertPimDefinition(actor: UserId, command: UpsertPimDefinitionCommand): Promise<PimDefinition>;
  deletePimDefinition(actor: UserId, id: string): Promise<void>;
  assertPimAdmin(actor: UserId): Promise<void>;
}

export interface CatalogAutomationGateway {
  pendingCandidates(): Promise<number>;
  runIngest(command: RunPimIngestCommand): Promise<PimIngestReport>;
  generateDefinition(command: GeneratePimDefinitionCommand): Promise<Record<string, unknown>>;
}
