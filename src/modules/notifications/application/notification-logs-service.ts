/**
 * Service applicatif de LECTURE du journal des notifications (story E10.15c).
 *
 * Orchestration triviale — aucune regle metier au-dela du filtrage/pagination
 * deja portes par le repository : contrairement a `NotificationTemplatesService`,
 * cette lecture est ouverte a tout membre du tenant, sans garde de capability
 * (contrat §8.23 §2, `listNotificationLogs` : « membre »).
 */
import type { TenantId } from '../../../kernel/ids/index.ts';
import type { NotificationLogDto } from '../api/contracts.ts';
import type { NotificationLogsListFilter, NotificationLogsRepository } from './notification-logs-repository.ts';

export type NotificationLogsServiceDependencies = Readonly<{
  repository: NotificationLogsRepository;
}>;

export class NotificationLogsService {
  private readonly repository: NotificationLogsRepository;

  constructor(dependencies: NotificationLogsServiceDependencies) {
    this.repository = dependencies.repository;
  }

  list(tenantId: TenantId, filter: NotificationLogsListFilter): Promise<readonly NotificationLogDto[]> {
    return this.repository.list(tenantId, filter);
  }
}
