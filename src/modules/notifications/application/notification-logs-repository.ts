/**
 * Port de LECTURE du journal des notifications (story E10.15c, `GET
 * /notification-logs`, contrat §8.23 §2/§4).
 *
 * Lecture seule, ouverte a tout membre du tenant (aucune capability) : la
 * table `notification_logs` est AUSSI la file d envoi, mais ce port n en
 * expose que la LECTURE paginee — l ecriture (mise en file par le
 * consommateur, verdicts du drain d envoi) passe par des chemins distincts
 * (`NotificationLogsWriteGateway`, `NotificationSendRepository`), tous deux
 * reserves au `service_role` (voir `notification-dispatch-consumer.ts` /
 * `notification-sender.ts`).
 */
import type { TenantId } from '../../../kernel/ids/index.ts';
import type { CursorPosition } from '../../_shared/application/index.ts';
import type {
  NotificationChannel,
  NotificationEventName,
  NotificationLogDto,
  NotificationStatus,
} from '../api/contracts.ts';

export type NotificationLogsListFilter = Readonly<{
  eventName: NotificationEventName | null;
  channel: NotificationChannel | null;
  status: NotificationStatus | null;
  templateId: string | null;
  aggregateId: string | null;
  size: number;
  cursor: CursorPosition | null;
}>;

export interface NotificationLogsRepository {
  /**
   * Rend `size + 1` lignes au plus (convention `buildPage()`), du plus
   * recent au plus ancien. La RETENTION (`CommercialSettings.
   * notification_retention_days`) n est PAS appliquee ici : les lignes
   * purgees n existent simplement plus en base au moment de la lecture.
   */
  list(tenantId: TenantId, filter: NotificationLogsListFilter): Promise<readonly NotificationLogDto[]>;
}
