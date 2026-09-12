import { describe, expect, it } from 'vitest';
import type { ClaimedOutboxEvent } from '@/modules/_shared/application';
import {
  NotificationDispatchConsumer,
  type ActiveNotificationTemplate,
  type CustomerNotificationContext,
  type DefaultShop,
  type EnqueuedNotificationMessage,
  type NotificationDispatchGateway,
  type NotificationRecipient,
  type OrderStepChangedDispatchContext,
  type QuoteSentDispatchContext,
} from '@/modules/notifications/application/notification-dispatch-consumer';
import type { NotificationEventName } from '@/modules/notifications/api/contracts';
import type { TenantId } from '@/kernel';

const TENANT = 'tenant-1' as TenantId;

function outboxEvent(
  name: string,
  aggregateType: string,
  aggregateId: string,
  payload: Record<string, unknown>,
): ClaimedOutboxEvent {
  return Object.freeze({
    id: 'event-1',
    tenantId: TENANT,
    name,
    version: 1,
    aggregateType,
    aggregateId,
    payload,
    occurredAt: '2026-09-12T10:00:00.000Z',
    deliveryAttempts: 1,
  }) as unknown as ClaimedOutboxEvent;
}

function orderStepChangedEvent(payload: Record<string, unknown>): ClaimedOutboxEvent {
  return outboxEvent('order.step_changed', 'order', 'order-1', payload);
}

const ORDER_STEP_CHANGED_PAYLOAD = {
  step_change_id: 'step-change-1',
  order_id: 'order-1',
  order_number: 'CDE-2026-00042',
  customer_id: 'customer-1',
  from_step_id: 'step-recu',
  to_step_id: 'step-pao',
};

const ORDER_STEP_CHANGED_CONTEXT: OrderStepChangedDispatchContext = Object.freeze({
  tenantName: 'Imprimerie Exemple',
  customerCompanyName: 'Client Exemple SARL',
  customerDefaultContactName: 'Jeanne Dupont',
  orderCustomerReference: 'PO-2026-0118',
  orderExpectedDeliveryDate: null,
  stepLabel: 'PAO',
  stepPreviousLabel: 'Reçu',
});

const CUSTOMER_NOTIFICATION_CONTEXT: CustomerNotificationContext = Object.freeze({
  tenantName: 'Imprimerie Exemple',
  customerCompanyName: 'Client Exemple SARL',
  customerDefaultContactName: 'Jeanne Dupont',
});

const QUOTE_SENT_CONTEXT: QuoteSentDispatchContext = Object.freeze({
  tenantName: 'Imprimerie Exemple',
  customerCompanyName: 'Client Exemple SARL',
  customerDefaultContactName: 'Jeanne Dupont',
  quoteValidUntil: '2026-12-31',
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

const QUOTE_SENT_TEMPLATE: ActiveNotificationTemplate = Object.freeze({
  id: 'template-quote-sent',
  channel: 'email',
  audience: 'customer',
  recipients: null,
  subject: 'Votre devis {{quote.number}}',
  body: 'Valable jusqu’au {{quote.valid_until}}, réf. client {{quote.customer_reference}}.',
});

const QUOTE_CONVERTED_TEMPLATE: ActiveNotificationTemplate = Object.freeze({
  id: 'template-quote-converted',
  channel: 'email',
  audience: 'customer',
  recipients: null,
  subject: 'Votre commande {{order.number}}',
  body: 'Le devis {{quote.number}} est devenu la commande {{order.number}}.',
});

const CUSTOMER_CREATED_TEMPLATE: ActiveNotificationTemplate = Object.freeze({
  id: 'template-customer-created',
  channel: 'email',
  audience: 'customer',
  recipients: null,
  subject: 'Bienvenue {{customer.contact_name}}',
  body: 'Bienvenue chez {{tenant.name}}.',
});

class FakeGateway implements NotificationDispatchGateway {
  templatesByEvent: Partial<Record<NotificationEventName, readonly ActiveNotificationTemplate[]>> = {};
  orderStepChangedContext: OrderStepChangedDispatchContext | null = ORDER_STEP_CHANGED_CONTEXT;
  customerNotificationContext: CustomerNotificationContext | null = CUSTOMER_NOTIFICATION_CONTEXT;
  quoteSentContext: QuoteSentDispatchContext | null = QUOTE_SENT_CONTEXT;
  recipients: readonly NotificationRecipient[] = [];
  defaultShop: DefaultShop | null = { slug: 'boutique-exemple', name: 'Boutique Exemple' };

  async findActiveTemplates(
    _tenantId: TenantId,
    eventName: NotificationEventName,
  ): Promise<readonly ActiveNotificationTemplate[]> {
    return this.templatesByEvent[eventName] ?? [];
  }

  async getOrderStepChangedContext(): Promise<OrderStepChangedDispatchContext | null> {
    return this.orderStepChangedContext;
  }

  async getCustomerNotificationContext(): Promise<CustomerNotificationContext | null> {
    return this.customerNotificationContext;
  }

  async getQuoteSentDispatchContext(): Promise<QuoteSentDispatchContext | null> {
    return this.quoteSentContext;
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

describe('NotificationDispatchConsumer — order.step_changed (E10.15c, inchange)', () => {
  it('ignore un evenement hors perimetre (order.files_submitted, E10.15d-2)', async () => {
    const gateway = new FakeGateway();
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(outboxEvent('order.files_submitted', 'order', 'order-1', {}));

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
    gateway.templatesByEvent['order.step_changed'] = [CUSTOMER_TEMPLATE];
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs, null);

    const result = await consumer.consume(orderStepChangedEvent(ORDER_STEP_CHANGED_PAYLOAD));

    expect(result).toEqual({ delivered: false, reason: 'MAGRIT_PUBLIC_APP_URL non configurée' });
  });

  it('aucun modele actif -> nominal, delivered:true, rien en file', async () => {
    const gateway = new FakeGateway();
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(orderStepChangedEvent(ORDER_STEP_CHANGED_PAYLOAD));

    expect(result).toEqual({ delivered: true });
    expect(logs.enqueued).toEqual([]);
  });

  it('audience customer, AUCUN destinataire -> entree DROPPED visible, jamais un silence', async () => {
    const gateway = new FakeGateway();
    gateway.templatesByEvent['order.step_changed'] = [CUSTOMER_TEMPLATE];
    gateway.recipients = [];
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(orderStepChangedEvent(ORDER_STEP_CHANGED_PAYLOAD));

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
    gateway.templatesByEvent['order.step_changed'] = [CUSTOMER_TEMPLATE];
    gateway.recipients = [
      { email: 'a@example.test', contactName: 'Alice', shopSlug: 'shop-a', shopName: 'Shop A' },
      { email: 'b@example.test', contactName: 'Bob', shopSlug: 'shop-b', shopName: 'Shop B' },
    ];
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(orderStepChangedEvent(ORDER_STEP_CHANGED_PAYLOAD));

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
    gateway.templatesByEvent['order.step_changed'] = [EXPLICIT_TEMPLATE];
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(orderStepChangedEvent(ORDER_STEP_CHANGED_PAYLOAD));

    expect(result).toEqual({ delivered: true });
    expect(logs.enqueued).toHaveLength(1);
    expect(logs.enqueued[0]!.recipient).toBe('atelier@example.test');
    expect(logs.enqueued[0]!.status).toBe('pending');
  });

  it('audience explicit, aucune boutique dans le tenant -> le lien du portail est une chaine vide, jamais une exception', async () => {
    const gateway = new FakeGateway();
    gateway.templatesByEvent['order.step_changed'] = [EXPLICIT_TEMPLATE];
    gateway.defaultShop = null;
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(orderStepChangedEvent(ORDER_STEP_CHANGED_PAYLOAD));

    expect(result).toEqual({ delivered: true });
    expect(logs.enqueued).toHaveLength(1);
  });

  it('plusieurs modeles actifs -> un message par modele', async () => {
    const gateway = new FakeGateway();
    gateway.templatesByEvent['order.step_changed'] = [CUSTOMER_TEMPLATE, EXPLICIT_TEMPLATE];
    gateway.recipients = [{ email: 'a@example.test', contactName: 'Alice', shopSlug: 'shop-a', shopName: 'Shop A' }];
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(orderStepChangedEvent(ORDER_STEP_CHANGED_PAYLOAD));

    expect(result).toEqual({ delivered: true });
    expect(logs.enqueued).toHaveLength(2);
  });

  it('un echec de mise en file rend delivered:false EXPLICITEMENT (jamais de throw non capte)', async () => {
    const gateway = new FakeGateway();
    gateway.templatesByEvent['order.step_changed'] = [CUSTOMER_TEMPLATE];
    gateway.recipients = [{ email: 'a@example.test', contactName: 'Alice', shopSlug: 'shop-a', shopName: 'Shop A' }];
    const logs = new FakeLogsWriteGateway();
    logs.failOnce = true;
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(orderStepChangedEvent(ORDER_STEP_CHANGED_PAYLOAD));

    expect(result.delivered).toBe(false);
  });

  it('commande/etape introuvable (defensif) -> delivered:true, rien a notifier', async () => {
    const gateway = new FakeGateway();
    gateway.templatesByEvent['order.step_changed'] = [CUSTOMER_TEMPLATE];
    gateway.orderStepChangedContext = null;
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(orderStepChangedEvent(ORDER_STEP_CHANGED_PAYLOAD));

    expect(result).toEqual({ delivered: true });
    expect(logs.enqueued).toEqual([]);
  });

  it('canal sms -> subject toujours null (contrat, aucun sujet sur sms)', async () => {
    const gateway = new FakeGateway();
    gateway.templatesByEvent['order.step_changed'] = [
      { ...CUSTOMER_TEMPLATE, channel: 'sms', subject: null, body: 'Étape {{step.label}}.' },
    ];
    gateway.recipients = [{ email: 'a@example.test', contactName: 'Alice', shopSlug: 'shop-a', shopName: 'Shop A' }];
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    await consumer.consume(orderStepChangedEvent(ORDER_STEP_CHANGED_PAYLOAD));

    expect(logs.enqueued[0]!.subject).toBeNull();
  });
});

describe('NotificationDispatchConsumer — quote.sent (E10.15d-1)', () => {
  const PAYLOAD = { quote_id: 'quote-1', customer_id: 'customer-1', number: 'DEV-2026-00042', is_resend: false };

  it('echoue explicitement sur une charge utile invalide', async () => {
    const gateway = new FakeGateway();
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(outboxEvent('quote.sent', 'quote', 'quote-1', { quote_id: 'quote-1' }));

    expect(result.delivered).toBe(false);
  });

  it('aucun modele actif -> nominal, delivered:true, rien en file (le courriel non configurable reste independant)', async () => {
    const gateway = new FakeGateway();
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(outboxEvent('quote.sent', 'quote', 'quote-1', PAYLOAD));

    expect(result).toEqual({ delivered: true });
    expect(logs.enqueued).toEqual([]);
  });

  it('modele actif, un destinataire -> message en file, balises quote.number/quote.valid_until rendues, quote.customer_reference vide (aucune source)', async () => {
    const gateway = new FakeGateway();
    gateway.templatesByEvent['quote.sent'] = [QUOTE_SENT_TEMPLATE];
    gateway.recipients = [{ email: 'a@example.test', contactName: 'Alice', shopSlug: 'shop-a', shopName: 'Shop A' }];
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(outboxEvent('quote.sent', 'quote', 'quote-1', PAYLOAD));

    expect(result).toEqual({ delivered: true });
    expect(logs.enqueued).toHaveLength(1);
    const message = logs.enqueued[0]!;
    expect(message.subject).toBe('Votre devis DEV-2026-00042');
    expect(message.body).toBe('Valable jusqu’au 2026-12-31, réf. client .');
    expect(message.body).not.toContain('{{');
  });

  it('devis introuvable dans ce tenant (defensif) -> delivered:true, rien a notifier', async () => {
    const gateway = new FakeGateway();
    gateway.templatesByEvent['quote.sent'] = [QUOTE_SENT_TEMPLATE];
    gateway.quoteSentContext = null;
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(outboxEvent('quote.sent', 'quote', 'quote-1', PAYLOAD));

    expect(result).toEqual({ delivered: true });
    expect(logs.enqueued).toEqual([]);
  });
});

describe('NotificationDispatchConsumer — quote.converted (E10.15d-1)', () => {
  const PAYLOAD = {
    quote_id: 'quote-1',
    customer_id: 'customer-1',
    number: 'DEV-2026-00042',
    order_id: 'order-1',
    order_number: 'CDE-2026-00042',
    source_quote_status: 'sent',
  };

  it('echoue explicitement sur une charge utile invalide', async () => {
    const gateway = new FakeGateway();
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(outboxEvent('quote.converted', 'quote', 'quote-1', { quote_id: 'quote-1' }));

    expect(result.delivered).toBe(false);
  });

  it('modele actif -> message en file, balises quote.number/order.number rendues', async () => {
    const gateway = new FakeGateway();
    gateway.templatesByEvent['quote.converted'] = [QUOTE_CONVERTED_TEMPLATE];
    gateway.recipients = [{ email: 'a@example.test', contactName: 'Alice', shopSlug: 'shop-a', shopName: 'Shop A' }];
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(outboxEvent('quote.converted', 'quote', 'quote-1', PAYLOAD));

    expect(result).toEqual({ delivered: true });
    expect(logs.enqueued).toHaveLength(1);
    expect(logs.enqueued[0]!.subject).toBe('Votre commande CDE-2026-00042');
    expect(logs.enqueued[0]!.body).toBe('Le devis DEV-2026-00042 est devenu la commande CDE-2026-00042.');
  });

  it('client introuvable dans ce tenant (defensif) -> delivered:true, rien a notifier', async () => {
    const gateway = new FakeGateway();
    gateway.templatesByEvent['quote.converted'] = [QUOTE_CONVERTED_TEMPLATE];
    gateway.customerNotificationContext = null;
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(outboxEvent('quote.converted', 'quote', 'quote-1', PAYLOAD));

    expect(result).toEqual({ delivered: true });
    expect(logs.enqueued).toEqual([]);
  });
});

describe('NotificationDispatchConsumer — customer.created (E10.15d-1)', () => {
  const PAYLOAD = {
    customer_id: 'customer-1',
    type: 'company',
    company_name: 'Client Exemple SARL',
    first_name: null,
    last_name: null,
  };

  it('echoue explicitement sur une charge utile invalide', async () => {
    const gateway = new FakeGateway();
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(outboxEvent('customer.created', 'customer', 'customer-1', {}));

    expect(result.delivered).toBe(false);
  });

  it('modele actif, audience explicite -> message en file au(x) destinataire(s) declare(s), aucune donnee de commande/devis requise', async () => {
    const gateway = new FakeGateway();
    gateway.templatesByEvent['customer.created'] = [{ ...CUSTOMER_CREATED_TEMPLATE, audience: 'explicit', recipients: ['commercial@example.test'] }];
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(outboxEvent('customer.created', 'customer', 'customer-1', PAYLOAD));

    expect(result).toEqual({ delivered: true });
    expect(logs.enqueued).toHaveLength(1);
    expect(logs.enqueued[0]!.recipient).toBe('commercial@example.test');
    expect(logs.enqueued[0]!.subject).toBe('Bienvenue Jeanne Dupont');
    expect(logs.enqueued[0]!.body).toBe('Bienvenue chez Imprimerie Exemple.');
  });

  it('client introuvable dans ce tenant (defensif) -> delivered:true, rien a notifier', async () => {
    const gateway = new FakeGateway();
    gateway.templatesByEvent['customer.created'] = [CUSTOMER_CREATED_TEMPLATE];
    gateway.customerNotificationContext = null;
    const logs = new FakeLogsWriteGateway();
    const consumer = buildConsumer(gateway, logs);

    const result = await consumer.consume(outboxEvent('customer.created', 'customer', 'customer-1', PAYLOAD));

    expect(result).toEqual({ delivered: true });
    expect(logs.enqueued).toEqual([]);
  });
});
