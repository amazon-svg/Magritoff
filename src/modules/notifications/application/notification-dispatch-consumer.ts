/**
 * Consommateur outbox `order.step_changed` (story E10.15c, contrat §8.23
 * §3, seul evenement branche par ce lot — §8.23 §8).
 *
 * MET EN FILE, NE FAIT AUCUN APPEL RESEAU (§8.23 §3(b)) : resout les modeles
 * ACTIFS pour cet evenement (filtre d etape compris), rend le texte via le
 * moteur de rendu deja livre (E10.15a), insere dans `notification_logs` et
 * rend `delivered: true`. Tout le travail incertain (joindre un prestataire,
 * reessayer, abandonner) est de l autre cote de la file (`NotificationSender`).
 *
 * IDEMPOTENT : la mise en file passe par `NotificationLogsWriteGateway.enqueue()`,
 * garantie unique par `(event_id, template_id, destinataire)` EN BASE — un
 * rejeu de ce consommateur (le composite qui l englobe echoue plus loin) ne
 * met donc jamais deux fois le meme message en file. C est cette propriete
 * qui justifie qu il passe TOUJOURS EN PREMIER dans un `CompositeOutboxConsumer`
 * (§8.23 §3(a)).
 *
 * Parse la charge utile LUI-MEME (pas d import du module `commercial-orders`,
 * meme discipline que `PurgeNoticeNotificationConsumer` : chaque consommateur
 * porte sa PROPRE attente de forme, defensive, sans dependance croisee entre
 * modules metier).
 */
import type { ClaimedOutboxEvent, OutboxConsumeResult, OutboxEventConsumer } from '../../_shared/application/index.ts';
import type { TenantId } from '../../../kernel/ids/index.ts';
import { renderNotificationTags } from './notification-tag-renderer.ts';
import { coalescingWindowMinutesForEvent } from './notification-event-catalog.ts';
import type { NotificationChannel } from '../api/contracts.ts';

// ---------------------------------------------------------------------------
// Ports — colocalises avec ce consommateur (meme parti que
// `QuoteNotificationGateway`/`QuoteDocumentAttachmentGateway` dans
// `quote-sent-notification-consumer.ts`) : c est CE consommateur qui a besoin
// de CETTE forme de lecture, pas une reutilisation d un port d ecran.
// ---------------------------------------------------------------------------

/** Modele ACTIF candidat, deja filtre par `event_name` + etape d arrivee. */
export type ActiveNotificationTemplate = Readonly<{
  id: string;
  channel: NotificationChannel;
  audience: 'customer' | 'explicit';
  /** Non vide ssi `audience = 'explicit'` (garanti par le contrat a l ecriture du modele). */
  recipients: readonly string[] | null;
  /** `null` sur un modele `sms` (contrat). */
  subject: string | null;
  body: string;
}>;

/**
 * Contexte COMMUN a l evenement, INDEPENDANT du destinataire — resolu A LA
 * REMISE, a partir de l AGREGAT (jamais deduit de la seule charge utile du
 * bus, contrat §8.23 §3(b) et notes du catalogue d evenements).
 */
export type OrderStepChangedDispatchContext = Readonly<{
  tenantName: string;
  /** `null` pour un client `individual` (pas de raison sociale). */
  customerCompanyName: string | null;
  /**
   * Nom de l interlocuteur PAR DEFAUT : l interlocuteur principal du client,
   * ou son nom/prenom s il est une personne physique. Utilise pour
   * l audience `explicit` (qui ne designe personne en particulier) et pour
   * le cas « aucun destinataire » d une audience `customer` — un destinataire
   * REEL (compte boutique) porte son propre nom, voir `NotificationRecipient.contactName`.
   */
  customerDefaultContactName: string;
  /** `commercial_orders.customer_reference` (E10.19a) — `null` tant qu aucune source amont ne l alimente (dette de donnees documentee, pas de ce lot). */
  orderCustomerReference: string | null;
  /** `commercial_orders.expected_delivery_date` (E10.16), forme `YYYY-MM-DD` — `null` tant qu aucun ecrivain n existe (E10.16, reserve (h)). */
  orderExpectedDeliveryDate: string | null;
  stepLabel: string;
  /** `null` si la commande n avait encore aucune etape avant cette transition. */
  stepPreviousLabel: string | null;
}>;

/** Destinataire « customer » resolu A LA REMISE — meme doctrine que `QuoteNotificationRecipient` (commercial-quotes) : comptes boutique ACTIFS ou INVITES, rattaches via `customer_contacts` au client de l evenement. */
export type NotificationRecipient = Readonly<{
  email: string;
  contactName: string;
  shopSlug: string;
  shopName: string;
}>;

export type DefaultShop = Readonly<{ slug: string; name: string }>;

export interface NotificationDispatchGateway {
  /** `null` si la commande/l etape est introuvable dans ce tenant — defensif, ne devrait jamais arriver pour un evenement reellement emis par ce tenant (evenement livre sans mise en file, meme doctrine que `quote.sent`). */
  getOrderStepChangedContext(
    tenantId: TenantId,
    orderId: string,
    customerId: string,
    toStepId: string,
    fromStepId: string | null,
  ): Promise<OrderStepChangedDispatchContext | null>;

  /** Modeles ACTIFS de cet evenement dont le filtre d etape (s il existe) matche `toStepId` — liste vide = cas NOMINAL (aucun modele configure, §8.23 point (h)). */
  findActiveTemplates(
    tenantId: TenantId,
    eventName: 'order.step_changed',
    toStepId: string,
  ): Promise<readonly ActiveNotificationTemplate[]>;

  /** Comptes boutique ACTIFS/INVITES rattaches au client, DANS LE TENANT de l evenement. Liste vide = cas NOMINAL. */
  resolveCustomerRecipients(tenantId: TenantId, customerId: string): Promise<readonly NotificationRecipient[]>;

  /** Premiere boutique ACTIVE du tenant (pour le lien du portail sur une audience `explicit`, qui ne designe aucun compte boutique precis). `null` si le tenant n a aucune boutique. */
  resolveDefaultShop(tenantId: TenantId): Promise<DefaultShop | null>;
}

export type NotificationMessageStatus = 'pending' | 'dropped';

export type EnqueuedNotificationMessage = Readonly<{
  templateId: string;
  channel: NotificationChannel;
  status: NotificationMessageStatus;
  /** `null` ssi `status = 'dropped'` faute de destinataire. */
  recipient: string | null;
  subject: string | null;
  body: string;
  /** Motif d abandon, ssi `status = 'dropped'` — sinon `null`. */
  lastError: string | null;
}>;

export interface NotificationLogsWriteGateway {
  /**
   * Idempotent : `(event_id, template_id, coalesce(destinataire, ''))`
   * unique EN BASE — un rejeu de ce consommateur ne met jamais deux fois le
   * meme message en file.
   *
   * REGROUPE aussi, mais SEULEMENT si `event.coalescingWindowMinutes > 0` :
   * un message `pending` DEJA en file pour le MEME `(template_id,
   * aggregate_id, destinataire)` accueille l occurrence (`occurrence_count +
   * 1`) plutot que d en ouvrir un second. CORRIGE 2026-09-12 (§8.23 point 4,
   * RECTIFICATIF D ARBITRAGE) : la cle d origine `(template_id,
   * aggregate_id)`, SANS le destinataire, absorbait silencieusement un
   * second destinataire du meme modele dans le compteur du premier —
   * contradiction frontale avec `NotificationLog` (« UN message, UN
   * destinataire, UN canal »). `coalescingWindowMinutes` est lu depuis le
   * catalogue d evenements (`coalescingWindowMinutesForEvent`), JAMAIS en
   * dur : `0` pour tout evenement branche par ce lot (E10.15c), donc cette
   * branche ne s execute jamais ici — voir `api_enqueue_notification_message`
   * (migration).
   */
  enqueue(
    tenantId: TenantId,
    event: Readonly<{
      id: string;
      name: string;
      aggregateType: string;
      aggregateId: string;
      /** Lue depuis le catalogue (`coalescingWindowMinutesForEvent`), jamais en dur. `0` = jamais regroupable. */
      coalescingWindowMinutes: number;
    }>,
    message: EnqueuedNotificationMessage,
  ): Promise<void>;
}

/** Chemin SERVEUR du portail client — DUPLIQUE depuis `commercial-quotes/application/quote-sent-notification-consumer.ts` (meme discipline que `formatFrenchDate`/`order-files` : eviter une dependance inter-module pour une fonction pure). Meme avertissement sur `portalRuntimePaths` (registre COTE NAVIGATEUR, inutilisable depuis un consommateur de drain). */
export function buildPortalQuotesLink(baseUrl: string, shopSlug: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/shop/${encodeURIComponent(shopSlug)}/account/quotes`;
}

/** Forme validee de `OrderStepChangedPayload` (contrat, `event_version: 1`), PARSEE ICI plutot qu importee du module `commercial-orders` (aucune dependance croisee entre modules metier). */
type OrderStepChangedEventPayload = Readonly<{
  order_id: string;
  order_number: string;
  customer_id: string;
  from_step_id: string | null;
  to_step_id: string;
}>;

function parseOrderStepChangedPayload(payload: ClaimedOutboxEvent['payload']): OrderStepChangedEventPayload | null {
  const orderId = payload['order_id'];
  const orderNumber = payload['order_number'];
  const customerId = payload['customer_id'];
  const toStepId = payload['to_step_id'];
  const fromStepId = payload['from_step_id'];
  if (
    typeof orderId !== 'string' ||
    typeof orderNumber !== 'string' ||
    typeof customerId !== 'string' ||
    typeof toStepId !== 'string' ||
    (fromStepId !== null && typeof fromStepId !== 'string')
  ) {
    return null;
  }
  return {
    order_id: orderId,
    order_number: orderNumber,
    customer_id: customerId,
    from_step_id: (fromStepId as string | null) ?? null,
    to_step_id: toStepId,
  };
}

export type NotificationDispatchConsumerDependencies = Readonly<{
  gateway: NotificationDispatchGateway;
  logs: NotificationLogsWriteGateway;
  /** `MAGRIT_PUBLIC_APP_URL`. `null` -> aucun rendu de lien possible, echec EXPLICITE (meme discipline que `quote.sent`, §8.13sexies point 5). */
  baseUrl: string | null;
}>;

export class NotificationDispatchConsumer implements OutboxEventConsumer {
  constructor(private readonly dependencies: NotificationDispatchConsumerDependencies) {}

  async consume(event: ClaimedOutboxEvent): Promise<OutboxConsumeResult> {
    if (event.name !== 'order.step_changed') {
      // Defensif : ce consommateur n est cable QUE sur order.step_changed
      // (perimetre E10.15c, §8.23 §8) — ne devrait jamais arriver.
      return { delivered: true };
    }

    const payload = parseOrderStepChangedPayload(event.payload);
    if (!payload) {
      return {
        delivered: false,
        reason: 'order.step_changed: charge utile invalide (order_id/order_number/customer_id/to_step_id attendus)',
      };
    }

    if (!this.dependencies.baseUrl) {
      return { delivered: false, reason: 'MAGRIT_PUBLIC_APP_URL non configurée' };
    }
    const baseUrl = this.dependencies.baseUrl;

    const templates = await this.dependencies.gateway.findActiveTemplates(
      event.tenantId,
      'order.step_changed',
      payload.to_step_id,
    );
    if (templates.length === 0) {
      // Aucun modele actif pour cette etape : NOMINAL (§8.23 point (h),
      // « Magrit ne fournit aucun modele par defaut »).
      return { delivered: true };
    }

    const context = await this.dependencies.gateway.getOrderStepChangedContext(
      event.tenantId,
      payload.order_id,
      payload.customer_id,
      payload.to_step_id,
      payload.from_step_id,
    );
    if (!context) {
      // Defensif : la commande vient de committer sur ce meme evenement — ne
      // devrait jamais arriver. Rien a notifier != echec.
      return { delivered: true };
    }

    for (const template of templates) {
      const outcome = await this.dispatchTemplate(event, payload, context, template, baseUrl);
      if (!outcome.delivered) return outcome;
    }

    return { delivered: true };
  }

  private async dispatchTemplate(
    event: ClaimedOutboxEvent,
    payload: OrderStepChangedEventPayload,
    context: OrderStepChangedDispatchContext,
    template: ActiveNotificationTemplate,
    baseUrl: string,
  ): Promise<OutboxConsumeResult> {
    // Aucune revalidation des balises ici : le texte enregistre a deja
    // passe `assertKnownNotificationTags` a l ecriture du modele (CA5) — ce
    // rendu se contente de substituer ce qu il trouve dans le contexte.
    const commonContext: Record<string, string> = {
      'tenant.name': context.tenantName,
      'customer.company_name': context.customerCompanyName ?? '',
      'order.number': payload.order_number,
      'order.customer_reference': context.orderCustomerReference ?? '',
      'order.expected_delivery_date': context.orderExpectedDeliveryDate ?? '',
      'step.label': context.stepLabel,
      'step.previous_label': context.stepPreviousLabel ?? '',
    };

    if (template.audience === 'customer') {
      const recipients = await this.dependencies.gateway.resolveCustomerRecipients(event.tenantId, payload.customer_id);

      if (recipients.length === 0) {
        // §8.23 (description NotificationLog) : « un modele actif qui ne
        // previent personne, faute d interlocuteur renseigne, est exactement
        // le cas qu il faut voir » — entree DROPPED, jamais un silence.
        return this.enqueueOne(event, template, {
          status: 'dropped',
          recipient: null,
          lastError: 'notification.no_recipient: aucun compte boutique actif ou invité rattaché à ce client.',
          context: {
            ...commonContext,
            'customer.contact_name': context.customerDefaultContactName,
            'link.portal_quotes': '',
          },
        });
      }

      for (const recipient of recipients) {
        const outcome = await this.enqueueOne(event, template, {
          status: 'pending',
          recipient: recipient.email,
          lastError: null,
          context: {
            ...commonContext,
            'customer.contact_name': recipient.contactName,
            'link.portal_quotes': buildPortalQuotesLink(baseUrl, recipient.shopSlug),
          },
        });
        if (!outcome.delivered) return outcome;
      }
      return { delivered: true };
    }

    // Audience `explicit` — `recipients` toujours >= 1 (garanti par le
    // contrat a l ecriture du modele). Ces destinataires ne designent aucun
    // compte boutique precis : le lien du portail retombe sur la PREMIERE
    // boutique active du tenant (best effort, tag rendu vide si le tenant
    // n a aucune boutique — decision de ce lot, a confirmer si elle s avere
    // insuffisante en usage reel).
    const defaultShop = await this.dependencies.gateway.resolveDefaultShop(event.tenantId);
    const explicitContext: Record<string, string> = {
      ...commonContext,
      'customer.contact_name': context.customerDefaultContactName,
      'link.portal_quotes': defaultShop ? buildPortalQuotesLink(baseUrl, defaultShop.slug) : '',
    };

    for (const recipient of template.recipients ?? []) {
      const outcome = await this.enqueueOne(event, template, {
        status: 'pending',
        recipient,
        lastError: null,
        context: explicitContext,
      });
      if (!outcome.delivered) return outcome;
    }
    return { delivered: true };
  }

  private async enqueueOne(
    event: ClaimedOutboxEvent,
    template: ActiveNotificationTemplate,
    input: Readonly<{
      status: NotificationMessageStatus;
      recipient: string | null;
      lastError: string | null;
      context: Record<string, string>;
    }>,
  ): Promise<OutboxConsumeResult> {
    const subject =
      template.channel === 'email' && template.subject !== null
        ? renderNotificationTags(template.subject, input.context)
        : null;
    const body = renderNotificationTags(template.body, input.context);

    try {
      await this.dependencies.logs.enqueue(
        event.tenantId,
        {
          id: event.id,
          name: event.name,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          // Litteral, pas `event.name` : `consume()` a deja ecarte tout
          // evenement distinct de `order.step_changed` (perimetre E10.15c,
          // §8.23 §8) — `event.name` reste type `EventNameDto` (le
          // vocabulaire GENERAL du bus), plus large que
          // `NotificationEventName` (le sous-ensemble NOTIFIABLE).
          coalescingWindowMinutes: coalescingWindowMinutesForEvent('order.step_changed'),
        },
        {
          templateId: template.id,
          channel: template.channel,
          status: input.status,
          recipient: input.recipient,
          subject,
          body,
          lastError: input.lastError,
        },
      );
    } catch (error) {
      return {
        delivered: false,
        reason: error instanceof Error ? error.message : 'mise en file de la notification impossible',
      };
    }
    return { delivered: true };
  }
}
