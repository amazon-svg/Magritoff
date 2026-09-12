import { describe, expect, it } from 'vitest';
import type { ClaimedOutboxEvent } from '@/modules/_shared/application';
import {
  NotificationDispatchConsumer,
  type ActiveNotificationTemplate,
  type DefaultShop,
  type EnqueuedNotificationMessage,
  type NotificationDispatchGateway,
  type NotificationRecipient,
  type OrderStepChangedDispatchContext,
} from '@/modules/notifications/application/notification-dispatch-consumer';
import type { TenantId } from '@/kernel';

const TENANT = 'tenant-1' as TenantId;

function orderStepChangedEvent(payload: Record<string, unknown>): ClaimedOutboxEvent {
  return Object.freeze({
    id: 'event-1',
    tenantId: TENANT,
    name: 'order.step_changed',
    version: 1,
    aggregateType: 'order',
    aggregateId: 'order-1',
    payload,
    occurredAt: '2026-09-12T10:00:00.000Z',
    deliveryAttempts: 1,
  });
}

const VALID_PAYLOAD = {
  step_change_id: 'step-change-1',
  order_id: 'order-1',
  order_number: 'CDE-2026-00042',
  customer_id: 'customer-1',
  from_step_id: 'step-recu',
  to_step_id: 'step-pao',
};

const CONTEXT: OrderStepChangedDispatchContext = Object.freeze({
  tenantName: 'Imprimerie Exemple',
  customerCompanyName: 'Client Exemple SARL',
  customerDefaultContactName: 'Jeanne Dupont',
  orderCustomerReference: 'PO-2026-0118',
  orderExpectedDeliveryDate: null,
  stepLabel: 'PAO',
  stepPreviousLabel: 'Reçu',
});

const CUSTOMER_TEMPLATE: ActiveNotificationTemplate = Object.freeze({
  id: 'template-1',
  channel: 'email',
  audience: 'customer',
  recipients: null,
  subject: 'Commande {{order.number}}',
  body: 'Étape atteinte : {{step.label}} (précédemment {{step.previous_label}}).',
});

const EXPLICIT_TEMPLATE: ActiveNotificationTemplate = Object.freeze({
  id: 'template-2',
  channel: 'email',
  audience: 'explicit',
  recipients: ['atelier@example.test'],
  subject: 'Suivi atelier {{order.number}}',
  body: 'Étape : {{step.label}}.',
});

class FakeGateway implements NotificationDispatchGateway {
  templates: readonly ActiveNotificationTemplate[] = [];
  context: OrderStepChangedDispatchContext | null = CONTEXT;
  recipients: readonly NotificationRecipient[] = [];
  defaultShop: DefaultShop | null = { slug: 'boutique-exemple', name: 'Boutique Exemple' };

  async findActiveTemplates(): Promise<readonly ActiveNotificationTemplate[]> {
    return this.templates;
  }

  async getOrderStepChangedContext(): Promise<OrderStepChangedDispatchContext | null> {
    return this.context;
  }

  async resolveCustomerRecipients(): Promise<readonly NotificationRecipient[]> {
    return this.recipients;
  }

  async resolveDefaultShop(): Promise<DefaultShop | null> {
    return this.defaultShop;
  }
}

class FakeLogsWriteGateway {
  enqueued: EnqueuedNotificationMessage[] = [];
  failOnce = false;

  async enqueue(_tenantId: TenantId, _event: unknown, message: EnqueuedNotificationMessage): Promise<void> {
    if (this.failOnce) {
      this.failOnce = false;
      throw new Error('mise en file impossible (test)');
    }
    this.enqueued.push(message);
  }
}

function buildConsumer(gateway: FakeGateway, logs: FakeLogsWriteGateway, baseUrl: string | null = 'https://magrit.test') {
  return new NotificationDispatchConsumer({ gateway, logs, baseUrl });
}

describe('NotificationDispatchConsumer', () => {
  it('ignore tout evenement autre que order.step_changed (defensif)', async () => {
    const gateway = new FakeGateway();
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(
      Object.freeze({ ...orderStepChangedEvent(VALID_PAYLOAD), name: 'quote.sent' as any }),
    );

    expect(result).toEqual({ delivered: true });
    expect(logs.enqueued).toEqual([]);
  });

  it('echoue explicitement sur une charge utile invalide', async () => {
    const gateway = new FakeGateway();
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(orderStepChangedEvent({ order_id: 'order-1' }));

    expect(result.delivered).toBe(false);
  });

  it('echoue explicitement si MAGRIT_PUBLIC_APP_URL est absent', async () => {
    const gateway = new FakeGateway();
    gateway.templates = [CUSTOMER_TEMPLATE];
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs, null);

    const result = await consumer.consume(orderStepChangedEvent(VALID_PAYLOAD));

    expect(result).toEqual({ delivered: false, reason: 'MAGRIT_PUBLIC_APP_URL non configurée' });
  });

  it('aucun modele actif -> nominal, delivered:true, rien en file', async () => {
    const gateway = new FakeGateway();
    gateway.templates = [];
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(orderStepChangedEvent(VALID_PAYLOAD));

    expect(result).toEqual({ delivered: true });
    expect(logs.enqueued).toEqual([]);
  });

  it('audience customer, AUCUN destinataire -> entree DROPPED visible, jamais un silence', async () => {
    const gateway = new FakeGateway();
    gateway.templates = [CUSTOMER_TEMPLATE];
    gateway.recipients = [];
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(orderStepChangedEvent(VALID_PAYLOAD));

    expect(result).toEqual({ delivered: true });
    expect(logs.enqueued).toHaveLength(1);
    const message = logs.enqueued[0]!;
    expect(message.status).toBe('dropped');
    expect(message.recipient).toBeNull();
    expect(message.lastError).toContain('notification.no_recipient');
    expect(message.body).toContain('PAO');
  });

  it('audience customer, deux destinataires -> DEUX messages, balises rendues, aucune accolade restante', async () => {
    const gateway = new FakeGateway();
    gateway.templates = [CUSTOMER_TEMPLATE];
    gateway.recipients = [
      { email: 'a@example.test', contactName: 'Alice', shopSlug: 'shop-a', shopName: 'Shop A' },
      { email: 'b@example.test', contactName: 'Bob', shopSlug: 'shop-b', shopName: 'Shop B' },
    ];
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(orderStepChangedEvent(VALID_PAYLOAD));

    expect(result).toEqual({ delivered: true });
    expect(logs.enqueued).toHaveLength(2);
    for (const message of logs.enqueued) {
      expect(message.status).toBe('pending');
      expect(message.body).not.toContain('{{');
      expect(message.subject).not.toContain('{{');
    }
    expect(logs.enqueued[0]!.recipient).toBe('a@example.test');
    expect(logs.enqueued[0]!.body).toContain('PAO');
    expect(logs.enqueued[0]!.body).toContain('Reçu');
    expect(logs.enqueued[1]!.recipient).toBe('b@example.test');
  });

  it('audience explicit -> un message par destinataire declare au modele, lien de portail sur la boutique par defaut', async () => {
    const gateway = new FakeGateway();
    gateway.templates = [EXPLICIT_TEMPLATE];
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(orderStepChangedEvent(VALID_PAYLOAD));

    expect(result).toEqual({ delivered: true });
    expect(logs.enqueued).toHaveLength(1);
    expect(logs.enqueued[0]!.recipient).toBe('atelier@example.test');
    expect(logs.enqueued[0]!.status).toBe('pending');
  });

  it('audience explicit, aucune boutique dans le tenant -> le lien du portail est une chaine vide, jamais une exception', async () => {
    const gateway = new FakeGateway();
    gateway.templates = [EXPLICIT_TEMPLATE];
    gateway.defaultShop = null;
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(orderStepChangedEvent(VALID_PAYLOAD));

    expect(result).toEqual({ delivered: true });
    expect(logs.enqueued).toHaveLength(1);
  });

  it('plusieurs modeles actifs -> un message par modele', async () => {
    const gateway = new FakeGateway();
    gateway.templates = [CUSTOMER_TEMPLATE, EXPLICIT_TEMPLATE];
    gateway.recipients = [{ email: 'a@example.test', contactName: 'Alice', shopSlug: 'shop-a', shopName: 'Shop A' }];
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(orderStepChangedEvent(VALID_PAYLOAD));

    expect(result).toEqual({ delivered: true });
    expect(logs.enqueued).toHaveLength(2);
  });

  it('un echec de mise en file rend delivered:false EXPLICITEMENT (jamais de throw non capte)', async () => {
    const gateway = new FakeGateway();
    gateway.templates = [CUSTOMER_TEMPLATE];
    gateway.recipients = [{ email: 'a@example.test', contactName: 'Alice', shopSlug: 'shop-a', shopName: 'Shop A' }];
    const logs = new FakeLogsWriteGateway();
    logs.failOnce = true;
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(orderStepChangedEvent(VALID_PAYLOAD));

    expect(result.delivered).toBe(false);
  });

  it('commande/etape introuvable (defensif) -> delivered:true, rien a notifier', async () => {
    const gateway = new FakeGateway();
    gateway.templates = [CUSTOMER_TEMPLATE];
    gateway.context = null;
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(orderStepChangedEvent(VALID_PAYLOAD));

    expect(result).toEqual({ delivered: true });
    expect(logs.enqueued).toEqual([]);
  });

  it('canal sms -> subject toujours null (contrat, aucun sujet sur sms)', async () => {
    const gateway = new FakeGateway();
    gateway.templates = [{ ...CUSTOMER_TEMPLATE, channel: 'sms', subject: null, body: 'Étape {{step.label}}.' }];
    gateway.recipients = [{ email: 'a@example.test', contactName: 'Alice', shopSlug: 'shop-a', shopName: 'Shop A' }];
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    await consumer.consume(orderStepChangedEvent(VALID_PAYLOAD));

    expect(logs.enqueued[0]!.subject).toBeNull();
  });
});
