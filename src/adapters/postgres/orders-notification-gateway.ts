import type { UserId } from '../../kernel/ids/index.ts';
import type { NotificationChannelAdapter } from '../../modules/notifications/application/notification-channel-adapter.ts';
import type { CreateOrderResult, TransitionOrderResult } from '../../modules/orders/api/contracts.ts';
import type { OrdersNotificationGateway } from './orders-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type CreatedRecipient = Readonly<{
  tenant_name: string;
  tenant_slug: string;
  shop_name: string;
  buyer_email: string | null;
  recipient_email: string;
}>;

type TransitionRecipient = Readonly<{
  tenant_name: string;
  tenant_slug: string;
  notify_policy: string;
  recipient_email: string;
}>;

const STATUS_LABELS: Readonly<Record<string, string>> = {
  draft: 'Brouillon',
  validated: 'Validée',
  in_production: 'En production',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  invoiced: 'Facturée',
  cancelled: 'Annulée',
};

export class PostgresOrdersNotificationGateway implements OrdersNotificationGateway {
  constructor(
    private readonly tx: PostgresTransactionRunner,
    private readonly email: NotificationChannelAdapter,
  ) {
    if (email.channel !== 'email') throw new Error('Le canal de notification Orders doit être email.');
  }

  async created(result: CreateOrderResult, baseUrl: string): Promise<void> {
    const recipients = await this.tx.run({}, async (client) => (
      await client.query<CreatedRecipient>(
        'select * from magrit.order_created_notification_recipients($1::uuid)',
        [result.orderId],
      )
    ).rows);
    if (recipients.length === 0) return;
    const first = recipients[0]!;
    const shortId = shortOrderId(result.orderId);
    const link = `${cleanBaseUrl(baseUrl)}/dashboard?tab=orders`;
    const buyer = first.buyer_email === null ? '' : ` par ${first.buyer_email}`;
    const body = [
      'Bonjour,',
      '',
      `Une nouvelle commande #${shortId} a été créée${buyer} sur la boutique « ${first.shop_name} ».`,
      `Montant : ${result.totalHt} ${result.currency}.`,
      '',
      `Voir les commandes : ${link}`,
      '',
      '— Magrit',
    ].join('\n');
    await this.sendAll(
      recipients.map((recipient) => recipient.recipient_email),
      `Nouvelle commande #${shortId} — ${first.shop_name}`,
      body,
    );
  }

  async transition(
    result: TransitionOrderResult,
    actorUserId: UserId | null,
    baseUrl: string,
  ): Promise<void> {
    const recipients = await this.tx.run({}, async (client) => (
      await client.query<TransitionRecipient>(`
        select * from magrit.order_transition_notification_recipients(
          $1::uuid,$2::uuid,$3::text,$4::text
        )
      `, [result.orderId, actorUserId, result.fromStatus, result.toStatus])
    ).rows);
    if (recipients.length === 0) return;
    const first = recipients[0]!;
    const shortId = shortOrderId(result.orderId);
    const from = STATUS_LABELS[result.fromStatus] ?? result.fromStatus;
    const to = STATUS_LABELS[result.toStatus] ?? result.toStatus;
    const link = `${cleanBaseUrl(baseUrl)}/t/${encodeURIComponent(first.tenant_slug)}/orders?id=${encodeURIComponent(result.orderId)}`;
    const body = [
      'Bonjour,',
      '',
      `La commande #${shortId} de l’espace « ${first.tenant_name} » vient de passer de « ${from} » à « ${to} ».`,
      '',
      'Vous recevez ce message parce qu’un rôle vous a été assigné sur cette commande.',
      '',
      `Voir la commande : ${link}`,
      '',
      '— Magrit',
    ].join('\n');
    const subject = result.toStatus === 'validated'
      ? `Commande #${shortId} validée — action possible (${first.tenant_name})`
      : `Commande #${shortId} ${to.toLowerCase()} — ${first.tenant_name}`;
    await this.sendAll(recipients.map((recipient) => recipient.recipient_email), subject, body);
  }

  private async sendAll(recipients: readonly string[], subject: string, body: string): Promise<void> {
    const deliveries = await Promise.all(recipients.map((to) => this.email.send({
      channel: 'email',
      to,
      subject,
      body,
    })));
    const failures = deliveries.filter((delivery) => !delivery.sent);
    if (failures.length > 0) {
      throw new Error(`Notification Orders non remise à ${failures.length}/${deliveries.length} destinataire(s).`);
    }
  }
}

function shortOrderId(orderId: string): string {
  return orderId.replaceAll('-', '').slice(0, 8).toUpperCase();
}

function cleanBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}
