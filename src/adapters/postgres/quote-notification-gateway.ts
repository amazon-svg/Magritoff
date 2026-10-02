import type { TenantId } from '../../kernel/ids/index.ts';
import type {
  QuoteNotificationGateway,
  QuoteNotificationQuoteContext,
  QuoteNotificationRecipient,
} from '../../modules/commercial-quotes/application/quote-sent-notification-consumer.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type RecipientRow = Readonly<{
  email: string;
  customer_name: string;
  shop_slug: string;
  shop_name: string;
}>;

export class PostgresQuoteNotificationGateway implements QuoteNotificationGateway {
  constructor(private readonly transactions: PostgresTransactionRunner) {}

  async getQuoteContext(
    tenantId: TenantId,
    quoteId: string,
  ): Promise<QuoteNotificationQuoteContext | null> {
    return this.transactions.run({}, async (client) => {
      const result = await client.query<{ valid_until: string | null }>(
        'select valid_until::text as valid_until from magrit.outbox_quote_context($1,$2)',
        [tenantId, quoteId],
      );
      const row = result.rows[0];
      if (!row) return null;
      return { validUntil: row.valid_until };
    });
  }

  async resolveRecipients(
    tenantId: TenantId,
    customerId: string,
  ): Promise<readonly QuoteNotificationRecipient[]> {
    return this.transactions.run({}, async (client) => {
      const result = await client.query<RecipientRow>(
        'select * from magrit.outbox_quote_recipients($1,$2)',
        [tenantId, customerId],
      );
      return Object.freeze(result.rows.map((row) => Object.freeze({
        email: row.email,
        customerName: row.customer_name,
        shopSlug: row.shop_slug,
        shopName: row.shop_name,
      })));
    });
  }
}
