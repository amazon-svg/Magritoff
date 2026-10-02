import type { TenantId } from '../../kernel/ids/index.ts';
import type {
  ActiveNotificationTemplate,
  CustomerNotificationContext,
  DefaultShop,
  EnqueuedNotificationMessage,
  NotificationDispatchGateway,
  NotificationLogsWriteGateway,
  NotificationRecipient,
  OrderFilesSubmittedDispatchContext,
  OrderStepChangedDispatchContext,
  QuoteSentDispatchContext,
} from '../../modules/notifications/application/notification-dispatch-consumer.ts';
import type { NotificationChannel, NotificationEventName } from '../../modules/notifications/api/contracts.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type Row = Record<string, unknown>;

export class PostgresNotificationDispatchGateway
implements NotificationDispatchGateway, NotificationLogsWriteGateway {
  constructor(private readonly transactions: PostgresTransactionRunner) {}

  findActiveTemplates(
    tenantId: TenantId,
    eventName: NotificationEventName,
    toStepId: string | null,
  ): Promise<readonly ActiveNotificationTemplate[]> {
    return this.transactions.run({}, async (client) => {
      const result = await client.query<Row>(
        'select * from magrit.notification_active_templates($1,$2,$3)',
        [tenantId, eventName, toStepId],
      );
      return Object.freeze(result.rows.map((row) => Object.freeze({
        id: String(row['id']),
        channel: notificationChannel(row['channel']),
        audience: row['audience'] === 'explicit' ? 'explicit' as const : 'customer' as const,
        recipients: Array.isArray(row['recipients']) ? row['recipients'].map(String) : null,
        subject: row['subject'] === null ? null : String(row['subject']),
        body: String(row['body']),
      })));
    });
  }

  getOrderStepChangedContext(
    tenantId: TenantId,
    orderId: string,
    customerId: string,
    toStepId: string,
    fromStepId: string | null,
  ): Promise<OrderStepChangedDispatchContext | null> {
    return this.oneQuery(`select tenant_name,customer_company_name,customer_default_contact_name,
        order_customer_reference,order_expected_delivery_date::text as order_expected_delivery_date,
        step_label,step_previous_label
      from magrit.notification_order_step_context($1,$2,$3,$4,$5)`,
      [tenantId, orderId, customerId, toStepId, fromStepId],
      (row) => ({
        ...customerContext(row),
        orderCustomerReference: nullableString(row['order_customer_reference']),
        orderExpectedDeliveryDate: dateString(row['order_expected_delivery_date']),
        stepLabel: String(row['step_label']),
        stepPreviousLabel: nullableString(row['step_previous_label']),
      }));
  }

  getCustomerNotificationContext(
    tenantId: TenantId,
    customerId: string,
  ): Promise<CustomerNotificationContext | null> {
    return this.one('magrit.notification_customer_context($1,$2)', [tenantId, customerId], customerContext);
  }

  getQuoteSentDispatchContext(
    tenantId: TenantId,
    quoteId: string,
    customerId: string,
  ): Promise<QuoteSentDispatchContext | null> {
    return this.oneQuery(`select tenant_name,customer_company_name,customer_default_contact_name,
        quote_valid_until::text as quote_valid_until
      from magrit.notification_quote_sent_context($1,$2,$3)`,
      [tenantId, quoteId, customerId],
      (row) => ({ ...customerContext(row), quoteValidUntil: dateString(row['quote_valid_until']) }));
  }

  getOrderFilesSubmittedContext(
    tenantId: TenantId,
    orderId: string,
    customerId: string,
  ): Promise<OrderFilesSubmittedDispatchContext | null> {
    return this.one('magrit.notification_order_files_context($1,$2,$3)',
      [tenantId, orderId, customerId],
      (row) => ({
        ...customerContext(row),
        orderCustomerReference: nullableString(row['order_customer_reference']),
      }));
  }

  resolveCustomerRecipients(
    tenantId: TenantId,
    customerId: string,
  ): Promise<readonly NotificationRecipient[]> {
    return this.transactions.run({}, async (client) => {
      const result = await client.query<Row>(
        'select * from magrit.notification_customer_recipients($1,$2)',
        [tenantId, customerId],
      );
      return Object.freeze(result.rows.map((row) => Object.freeze({
        email: String(row['email']),
        contactName: String(row['contact_name']),
        shopSlug: String(row['shop_slug']),
        shopName: String(row['shop_name']),
      })));
    });
  }

  resolveDefaultShop(tenantId: TenantId): Promise<DefaultShop | null> {
    return this.one('magrit.notification_default_shop($1)', [tenantId], (row) => ({
      slug: String(row['slug']),
      name: String(row['name']),
    }));
  }

  async enqueue(
    tenantId: TenantId,
    event: Readonly<{
      id: string;
      name: string;
      aggregateType: string;
      aggregateId: string;
      coalescingWindowMinutes: number;
    }>,
    message: EnqueuedNotificationMessage,
  ): Promise<void> {
    await this.transactions.run({}, async (client) => {
      await client.query(
        `select magrit.enqueue_notification_message(
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
        )`,
        [
          tenantId,
          event.id,
          event.name,
          event.aggregateType,
          event.aggregateId,
          message.templateId,
          message.channel,
          message.status,
          message.recipient,
          message.subject,
          message.body,
          message.lastError,
          event.coalescingWindowMinutes,
          message.deferredRender,
        ],
      );
    });
  }

  private one<T>(
    functionCall: string,
    values: readonly unknown[],
    map: (row: Row) => T,
  ): Promise<T | null> {
    return this.oneQuery(`select * from ${functionCall}`, values, map);
  }

  private oneQuery<T>(
    sql: string,
    values: readonly unknown[],
    map: (row: Row) => T,
  ): Promise<T | null> {
    return this.transactions.run({}, async (client) => {
      const result = await client.query<Row>(sql, [...values]);
      const row = result.rows[0];
      return row ? map(row) : null;
    });
  }
}

function customerContext(row: Row): CustomerNotificationContext {
  return {
    tenantName: String(row['tenant_name']),
    customerCompanyName: nullableString(row['customer_company_name']),
    customerDefaultContactName: String(row['customer_default_contact_name']),
  };
}

function notificationChannel(value: unknown): NotificationChannel {
  return value === 'sms' ? 'sms' : 'email';
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function dateString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
