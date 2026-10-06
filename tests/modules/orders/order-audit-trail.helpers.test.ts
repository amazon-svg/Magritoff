import { describe, expect, it } from 'vitest';
import {
  formatAuditEventDescription,
  formatAuditEventTitle,
  type OrderAuditEvent,
} from '@/modules/orders/ui/storefront/orderAuditTrail.helpers';

describe('historique des informations de commande', () => {
  it('nomme les champs modifiés et leur auteur', () => {
    const event: OrderAuditEvent = {
      event_id: 'event-1', order_id: 'order-1', kind: 'metadata', event_type: 'metadata_updated',
      actor_id: 'user-1', actor_email: 'atelier@example.invalid', shop_customer_account_id: null,
      acted_by_magrit_user_id: null, role_name: null,
      payload: { changes: {
        customer_reference: { before: null, after: 'BC-42' },
        notes: { before: '', after: 'Livrer le matin.' },
      } },
      occurred_at: '2026-10-06T10:00:00.000Z',
    };

    expect(formatAuditEventTitle(event)).toBe('Informations modifiées : référence client, notes');
    expect(formatAuditEventDescription(event)).toBe('Modifié par atelier@example.invalid');
  });
});
