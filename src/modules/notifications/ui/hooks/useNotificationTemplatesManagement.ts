/**
 * Liste + filtres (evenement, canal, statut) des modeles de notification du
 * tenant courant (E10.15b). PAS DE PAGINATION (contrat `listNotification
 * Templates`, §8.23 §2 : configuration bornee a 100 modeles par tenant) —
 * a la difference de `usePriceRulesManagement`, il n y a donc ni curseur ni
 * `loadMore` ici.
 *
 * Le tenant est resolu par la facade depuis le jeton : ce hook ne le
 * transmet jamais dans un chemin ni une query.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { NotificationsApiClient } from '@/modules/notifications/api/client';
import type {
  NotificationChannel,
  NotificationEventName,
  NotificationTemplateDto,
  NotificationTemplateStatusFilter,
} from '@/modules/notifications/api/contracts';
import { notificationTemplateApiProblemMessage } from '../workspace/notification-templates.helpers';

export function useNotificationTemplatesManagement(enabled: boolean) {
  const api = useWorkspaceApi(NotificationsApiClient);
  const requestVersion = useRef(0);
  const [items, setItems] = useState<readonly NotificationTemplateDto[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<NotificationEventName | null>(null);
  const [channelFilter, setChannelFilter] = useState<NotificationChannel | null>(null);
  const [statusFilter, setStatusFilter] = useState<NotificationTemplateStatusFilter | null>(null);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!enabled) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await api.listTemplates({
        ...(eventFilter ? { event_name: eventFilter } : {}),
        ...(channelFilter ? { channel: channelFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      if (version === requestVersion.current) setItems(response);
    } catch (cause) {
      if (version === requestVersion.current) {
        setError(notificationTemplateApiProblemMessage(cause, 'Chargement des modeles de notification impossible.'));
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [api, enabled, eventFilter, channelFilter, statusFilter]);

  useEffect(() => {
    void load();
    return () => {
      requestVersion.current += 1;
    };
  }, [load]);

  /**
   * Bascule `is_active`. Relit l `ETag` DU MODELE avant l ecriture — la
   * liste n en rend aucun (contrat, decision #0), seule `getForEdit` fait
   * foi pour le `If-Match` (meme discipline que `usePriceRulesManagement`).
   */
  const toggleActive = useCallback(
    async (template: NotificationTemplateDto): Promise<void> => {
      const current = await api.getForEdit(template.id);
      if (!current.etag) throw new Error('ETag du modele de notification indisponible.');
      await api.update(template.id, { is_active: !template.is_active }, current.etag);
      await load();
    },
    [api, load],
  );

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
    refresh: load,
    toggleActive,
  } as const;
}
