/**
 * OrderAuditTrailModal — S3.5 Audit Trail UI (Sprint 6, 2026-06-01).
 *
 * Affiche une timeline UNION des events :
 *   - status transitions (tenant_order_status_events)
 *   - role events (tenant_order_role_events) : assigned/revoked/capability_updated
 *
 * Pattern : Dialog Radix (modal centré). Lecture seule. La modale est
 * ouverte depuis la liste des commandes (lien "Historique" ou clic sur
 * le statut) — wire-up dans PortalOrders/DashboardOrders en S-ORDER-ROLES-3-UI.
 */

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import {
  fetchOrderAuditTrail,
  formatAuditEventDescription,
  formatAuditEventTitle,
  formatAuditTimestamp,
  type OrderAuditEvent,
} from './orderAuditTrail.helpers';

interface Props {
  /** UUID de la commande, ou null = modale fermée */
  orderId: string | null;
  /** Short id (8 premiers chars uppercase) pour le titre de la modale */
  orderShortId?: string;
  onClose: () => void;
}

export function OrderAuditTrailModal({ orderId, orderShortId, onClose }: Props) {
  const [events, setEvents] = useState<OrderAuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setEvents([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    void fetchOrderAuditTrail(orderId).then((result) => {
      setLoading(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEvents(result.data ?? []);
    });
  }, [orderId]);

  return (
    <Dialog
      open={orderId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Historique commande{orderShortId ? ` #${orderShortId}` : ''}
          </DialogTitle>
          <DialogDescription>
            Tous les événements de statut + assignations de rôles sur cette commande,
            triés du plus récent au plus ancien.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-gray-500 py-8 text-center">Chargement…</p>
        ) : error ? (
          <p className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            Aucun événement enregistré pour cette commande.
          </p>
        ) : (
          <ol className="space-y-3 mt-4">
            {events.map((event) => (
              <li
                key={event.event_id}
                className="border-l-2 border-gray-200 pl-4 py-1"
                data-testid="audit-trail-event"
                data-event-kind={event.kind}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-sm text-gray-900">
                    {formatAuditEventTitle(event)}
                  </span>
                  <time className="text-xs text-gray-500 whitespace-nowrap">
                    {formatAuditTimestamp(event.occurred_at)}
                  </time>
                </div>
                <p className="text-xs text-gray-600 mt-0.5">
                  {formatAuditEventDescription(event)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
