/**
 * Faux repository de LECTURE du journal des notifications (E10.15c), utilise
 * par `notification-logs.contract.test.ts`. Meme parti que
 * `InMemoryCustomersRepository.list()` : les FILTRES (event_name/channel/
 * status/template_id/aggregate_id) sont reellement appliques, le CURSEUR ne
 * l est pas (suffisant pour verifier la FORME HTTP/JSON contre le contrat,
 * pas la continuite d une pagination multi-pages).
 */
import type { TenantId } from '@/kernel';
import type { NotificationLogDto } from '@/modules/notifications/api/contracts';
import type {
  NotificationLogsListFilter,
  NotificationLogsRepository,
} from '@/modules/notifications/application/notification-logs-repository';

export class InMemoryNotificationLogsRepository implements NotificationLogsRepository {
  private readonly logsByTenant = new Map<string, NotificationLogDto[]>();

  /** TEST UNIQUEMENT. */
  seedForTest(tenantId: TenantId, log: NotificationLogDto): void {
    const existing = this.logsByTenant.get(tenantId) ?? [];
    existing.push(log);
    this.logsByTenant.set(tenantId, existing);
  }

  async list(tenantId: TenantId, filter: NotificationLogsListFilter): Promise<readonly NotificationLogDto[]> {
    const rows = (this.logsByTenant.get(tenantId) ?? [])
      .filter((log) => (filter.eventName ? log.event_name === filter.eventName : true))
      .filter((log) => (filter.channel ? log.channel === filter.channel : true))
      .filter((log) => (filter.status ? log.status === filter.status : true))
      .filter((log) => (filter.templateId ? log.template_id === filter.templateId : true))
      .filter((log) => (filter.aggregateId ? log.aggregate_id === filter.aggregateId : true))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
    return rows;
  }
}
