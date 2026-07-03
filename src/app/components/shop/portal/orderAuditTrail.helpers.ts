/**
 * Helpers S3.5 Audit Trail UI (Sprint 6, 2026-06-01).
 *
 * Côté front : appel RPC get_order_audit_trail + formatage timeline.
 */

import { supabase } from '/utils/supabase/client';

export interface OrderAuditEvent {
  event_id: string;
  order_id: string;
  /** 'status' = transition statut commande, 'role' = assignation/révocation/edit capability */
  kind: 'status' | 'role';
  /** 'status_transition' | 'assigned' | 'revoked' | 'capability_updated' */
  event_type: string;
  actor_id: string | null;
  actor_email: string | null;
  /** Pour kind='role' : nom du rôle. Pour kind='status' : null. */
  role_name: string | null;
  payload: Record<string, unknown>;
  occurred_at: string;
}

export interface FetchOrderAuditTrailResult {
  data: OrderAuditEvent[] | null;
  error: string | null;
}

export async function fetchOrderAuditTrail(orderId: string): Promise<FetchOrderAuditTrailResult> {
  const { data, error } = await supabase.rpc('get_order_audit_trail', { p_order_id: orderId });
  if (error) {
    return { data: null, error: error.message };
  }
  return { data: (data ?? []) as OrderAuditEvent[], error: null };
}

const STATUS_LABELS_FR: Record<string, string> = {
  draft: 'Brouillon',
  validated: 'Validée',
  in_production: 'En production',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  invoiced: 'Facturée',
  cancelled: 'Annulée',
};

/**
 * Construit le titre humain d'un event (affiché en gras dans la timeline).
 * Pas de JSX : helper pur testable.
 */
export function formatAuditEventTitle(event: OrderAuditEvent): string {
  if (event.kind === 'status') {
    const from = String(event.payload.from_status ?? '?');
    const to = String(event.payload.to_status ?? '?');
    return `Statut : ${STATUS_LABELS_FR[from] ?? from} → ${STATUS_LABELS_FR[to] ?? to}`;
  }
  // kind === 'role'
  switch (event.event_type) {
    case 'assigned':
      return `Rôle assigné : ${event.role_name ?? '?'}`;
    case 'revoked':
      return `Rôle révoqué : ${event.role_name ?? '?'}`;
    case 'capability_updated':
      return `Capabilities mises à jour : ${event.role_name ?? '?'}`;
    default:
      return `Événement ${event.event_type}`;
  }
}

/**
 * Description secondaire affichée sous le titre (acteur + détails).
 */
export function formatAuditEventDescription(event: OrderAuditEvent): string {
  const actor = event.actor_email ?? '(acteur inconnu)';
  if (event.kind === 'status') {
    const reason = event.payload.reason ? ` — ${event.payload.reason}` : '';
    return `Par ${actor}${reason}`;
  }
  // role events
  if (event.event_type === 'capability_updated') {
    return `Modifié par ${actor}`;
  }
  return `Par ${actor}`;
}

/**
 * Formatage date FR pour timeline (ex : "2026-06-01 14:32").
 */
export function formatAuditTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
