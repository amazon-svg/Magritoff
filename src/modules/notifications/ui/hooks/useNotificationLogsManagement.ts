/**
 * Liste + filtres (evenement, canal, statut) du journal des notifications
 * du tenant courant (E10.15d-1, `GET /notification-logs`). Pagination par
 * curseur EXPLICITE (`loadMore`), meme discipline que `usePriceRulesManagement`
 * (E10.6/E10.7) : au-dela de la premiere page, les entrees suivantes
 * n apparaissent qu au clic — jamais silencieusement absentes sans que
 * `hasMore` en informe l ecran.
 *
 * Le tenant est resolu par la facade depuis le jeton : ce hook ne le
 * transmet jamais dans un chemin ni une query.
 *
 * AUCUN RENDU DE BALISE ICI : ce hook rend `body`/`subject` tels que servis
 * par le serveur — sur une entree `pending` d un evenement a fenetre de
 * regroupement, `{{files.count}}` peut y rester en clair (mecanisme livre
 * par E10.15d-2). Y substituer quoi que ce soit serait un second moteur de
 * rendu, donc une seconde verite sur le texte envoye (§8.23 §11.5).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { NotificationsApiClient, type ListNotificationLogsQuery } from '@/modules/notifications/api/client';
import type { NotificationChannel, NotificationEventName, NotificationLogDto, NotificationStatus } from '@/modules/notifications/api/contracts';
import { notificationTemplateApiProblemMessage } from '../workspace/notification-templates.helpers';

const PAGE_SIZE = 25;

export function useNotificationLogsManagement(enabled: boolean) {
  const api = useWorkspaceApi(NotificationsApiClient);
  const requestVersion = useRef(0);
  const [items, setItems] = useState<readonly NotificationLogDto[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<NotificationEventName | null>(null);
  const [channelFilter, setChannelFilter] = useState<NotificationChannel | null>(null);
  const [statusFilter, setStatusFilter] = useState<NotificationStatus | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const baseQuery = useCallback(
    (): ListNotificationLogsQuery => ({
      ...(eventFilter ? { event_name: eventFilter } : {}),
      ...(channelFilter ? { channel: channelFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      pageSize: PAGE_SIZE,
    }),
    [eventFilter, channelFilter, statusFilter],
  );

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!enabled) {
      setItems([]);
      setNextCursor(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await api.listLogs(baseQuery());
      if (version === requestVersion.current) {
        setItems(response.items);
        setNextCursor(response.nextCursor);
      }
    } catch (cause) {
      if (version === requestVersion.current) {
        setError(notificationTemplateApiProblemMessage(cause, 'Chargement du journal des notifications impossible.'));
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [api, enabled, baseQuery]);

  useEffect(() => {
    void load();
    return () => {
      requestVersion.current += 1;
    };
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const version = requestVersion.current;
    setLoadingMore(true);
    setError(null);
    try {
      const response = await api.listLogs({ ...baseQuery(), pageCursor: nextCursor });
      if (version === requestVersion.current) {
        setItems((previous) => [...previous, ...response.items]);
        setNextCursor(response.nextCursor);
      }
    } catch (cause) {
      if (version === requestVersion.current) {
        setError(notificationTemplateApiProblemMessage(cause, 'Chargement de la page suivante impossible.'));
      }
    } finally {
      if (version === requestVersion.current) setLoadingMore(false);
    }
  }, [api, baseQuery, nextCursor, loadingMore]);

  return {
    items,
    loading,
    error,
    eventFilter,
    setEventFilter,
    channelFilter,
    setChannelFilter,
    statusFilter,
    setStatusFilter,
    hasMore: nextCursor !== null,
    loadingMore,
    loadMore,
    refresh: load,
  } as const;
}
