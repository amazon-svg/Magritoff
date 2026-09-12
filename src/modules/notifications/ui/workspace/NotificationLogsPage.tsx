/**
 * DashboardNotificationLogs — ecran du journal des notifications (E10.15d-1,
 * `GET /notification-logs`, table posee par E10.15c). Meme patron que
 * `NotificationTemplatesPage` (E10.15b) : page/hook/testids, aucun composant
 * n interroge Supabase directement.
 *
 * PERIMETRE STRICT DE CE LOT : liste paginee par curseur, filtrable par
 * evenement/canal/statut, colonnes evenement/canal/destinataire/statut/date.
 * AUCUN RENDU DE BALISE ICI — consigne opposable du contrat (§8.23 §11.5) :
 * sur une entree `pending` d un evenement a fenetre de regroupement (`order.
 * files_submitted`, PAS ENCORE BRANCHE par ce lot, E10.15d-2), `body`/
 * `subject` peuvent encore contenir `{{files.count}}` EN CLAIR. Cet ecran
 * l affiche TEL QUEL, en signalant que le message n est pas parti — une
 * substitution cote navigateur serait un second moteur de rendu, donc une
 * seconde verite sur le texte envoye.
 */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/modules/account/ui/runtime';
import { useTenant } from '@/modules/tenants/ui/runtime';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { NotificationsApiClient } from '@/modules/notifications/api/client';
import type {
  NotificationChannel,
  NotificationEventDescriptorDto,
  NotificationEventName,
  NotificationLogDto,
  NotificationStatus,
} from '@/modules/notifications/api/contracts';
import { useNotificationLogsManagement } from '../hooks';
import { notificationTemplateApiProblemMessage } from './notification-templates.helpers';

const inputCls =
  'w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';
const btnGhost =
  'px-3 py-1.5 border border-line-2 rounded-lg text-sm text-ink-2 hover:bg-bg hover:text-ink disabled:opacity-50 flex items-center gap-2';

const STATUS_LABELS: Readonly<Record<NotificationStatus, string>> = {
  pending: 'En attente',
  sent: 'Envoyé',
  failed: 'Échec',
  dropped: 'Abandonné',
};

const STATUS_DOT: Readonly<Record<NotificationStatus, string>> = {
  pending: 'bg-amber-500',
  sent: 'bg-green-600',
  failed: 'bg-err-fg',
  dropped: 'bg-ink-muted',
};

/**
 * `true` si le texte contient encore un jeton `{{...}}` non substitue —
 * DETECTION SEULE (une simple recherche de sous-chaine), AUCUN RENDU : c est
 * exactement la difference entre « signaler » et « resoudre » que le
 * contrat interdit de franchir ici (§8.23 §11.5).
 */
function containsUnsubstitutedTag(text: string | null): boolean {
  return text !== null && text.includes('{{');
}

function formatLogDate(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DashboardNotificationLogs() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const api = useWorkspaceApi(NotificationsApiClient);
  const enabled = Boolean(user && currentTenant);

  const {
    items,
    loading,
    error,
    eventFilter,
    setEventFilter,
    channelFilter,
    setChannelFilter,
    statusFilter,
    setStatusFilter,
    hasMore,
    loadingMore,
    loadMore,
  } = useNotificationLogsManagement(enabled);

  const [events, setEvents] = useState<readonly NotificationEventDescriptorDto[]>([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);

  // Catalogue des evenements (libelles francais de la colonne « Événement »)
  // — meme source unique que `NotificationTemplatesPage` (`listNotification
  // Events`), CHARGEE INDEPENDAMMENT de la liste : un echec ici degrade
  // l affichage (nom technique brut) sans empecher la lecture du journal.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    api
      .listEvents()
      .then((descriptors) => {
        if (!cancelled) setEvents(descriptors);
      })
      .catch((cause) => {
        if (!cancelled) {
          setReferenceError(notificationTemplateApiProblemMessage(cause, 'Chargement du catalogue des événements impossible.'));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, api]);

  const eventLabel = (name: NotificationEventName): string =>
    events.find((descriptor) => descriptor.event_name === name)?.label ?? name;

  return (
    <div className="space-y-5" data-testid={TEST_IDS.notificationLog.page}>
      <div>
        <h1 className="text-xl font-bold text-ink">Journal des notifications</h1>
        <p className="text-sm text-ink-muted mt-1">
          Ce que Magrit a envoyé, tenté ou abandonné pour ce tenant — un message, un destinataire, un canal.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={eventFilter ?? ''}
          onChange={(event) => setEventFilter(event.target.value ? (event.target.value as NotificationEventName) : null)}
          className={inputCls}
          style={{ maxWidth: 260 }}
          data-testid={TEST_IDS.notificationLog.eventFilterSelect}
        >
          <option value="">Tous les événements</option>
          {events.map((descriptor) => (
            <option key={descriptor.event_name} value={descriptor.event_name}>
              {descriptor.label}
            </option>
          ))}
        </select>
        <select
          value={channelFilter ?? ''}
          onChange={(event) => setChannelFilter(event.target.value ? (event.target.value as NotificationChannel) : null)}
          className={inputCls}
          style={{ maxWidth: 160 }}
          data-testid={TEST_IDS.notificationLog.channelFilterSelect}
        >
          <option value="">Tous les canaux</option>
          <option value="email">Courriel</option>
          <option value="sms">SMS</option>
        </select>
        <select
          value={statusFilter ?? ''}
          onChange={(event) => setStatusFilter(event.target.value ? (event.target.value as NotificationStatus) : null)}
          className={inputCls}
          style={{ maxWidth: 160 }}
          data-testid={TEST_IDS.notificationLog.statusFilterSelect}
        >
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="sent">Envoyé</option>
          <option value="failed">Échec</option>
          <option value="dropped">Abandonné</option>
        </select>
      </div>

      {referenceError && <p className="text-sm text-err-fg">{referenceError}</p>}
      {error && (
        <p className="text-sm text-err-fg" data-testid={TEST_IDS.notificationLog.errorBanner}>
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-muted py-8 text-center">Aucune notification pour l’instant.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-muted border-b border-line">
              <th className="py-2 pr-3 font-medium">Événement</th>
              <th className="py-2 pr-3 font-medium">Canal</th>
              <th className="py-2 pr-3 font-medium">Destinataire</th>
              <th className="py-2 pr-3 font-medium">Statut</th>
              <th className="py-2 pr-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {items.map((log: NotificationLogDto) => {
              // §8.23 §11.5 : une entree `pending` peut encore porter
              // `{{files.count}}` EN CLAIR (rendu differe, E10.15d-2) —
              // DETECTION SEULE, jamais une substitution.
              const deferred = log.status === 'pending' && (containsUnsubstitutedTag(log.body) || containsUnsubstitutedTag(log.subject));
              return (
                <tr
                  key={log.id}
                  data-testid={TEST_IDS.notificationLog.row}
                  data-log-id={log.id}
                  data-event={log.event_name}
                  data-channel={log.channel}
                  data-status={log.status}
                  className="border-b border-line/60 align-top"
                >
                  <td className="py-2 pr-3">
                    <div className="text-ink">{eventLabel(log.event_name)}</div>
                    {log.occurrence_count > 1 && (
                      <div className="text-xs text-ink-muted">{log.occurrence_count} occurrences regroupées</div>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-ink-muted">{log.channel === 'email' ? 'Courriel' : 'SMS'}</td>
                  <td className="py-2 pr-3 text-ink-muted">{log.recipient ?? '—'}</td>
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT[log.status]}`} />
                      {STATUS_LABELS[log.status]}
                    </span>
                    {log.status === 'dropped' && log.last_error && (
                      <div className="text-xs text-ink-muted mt-0.5">{log.last_error}</div>
                    )}
                    {log.status === 'failed' && log.last_error && (
                      <div className="text-xs text-err-fg mt-0.5">{log.last_error}</div>
                    )}
                    {deferred && (
                      <div
                        className="text-xs text-warn-fg mt-0.5"
                        data-testid={TEST_IDS.notificationLog.deferredBodyNotice}
                      >
                        Message pas encore parti — le compte de fichiers sera fixé à l’envoi.
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-ink-muted whitespace-nowrap">{formatLogDate(log.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className={btnGhost} data-testid={TEST_IDS.notificationLog.loadMoreBtn}>
            {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
            Charger la suite
          </button>
        </div>
      )}
    </div>
  );
}
