/**
 * Consommateur outbox des evenements notifiables SANS rendu differe (story
 * E10.15c pour `order.step_changed`, etendu par E10.15d-1 a `quote.sent`,
 * `quote.converted` et `customer.created` — docs/api/CONVENTIONS.md §8.23
 * §8, §11.5 : « ces trois evenements sont INDEPENDANTS de l arbitrage du
 * point 11 [...] mise en file et remise sont EXACTEMENT celles d E10.15c »).
 * `order.files_submitted` (fenetre de regroupement, balise `delivery`) reste
 * HORS PERIMETRE de ce lot — E10.15d-2.
 *
 * MET EN FILE, NE FAIT AUCUN APPEL RESEAU (§8.23 §3(b)) : resout les modeles
 * ACTIFS pour l evenement (filtre d etape compris sur `order.step_changed`
 * SEUL), rend le texte via le moteur de rendu deja livre (E10.15a), insere
 * dans `notification_logs` et rend `delivered: true`. Tout le travail
 * incertain (joindre un prestataire, reessayer, abandonner) est de l autre
 * cote de la file (`NotificationSender`).
 *
 * IDEMPOTENT : la mise en file passe par `NotificationLogsWriteGateway.enqueue()`,
 * garantie unique par `(event_id, template_id, destinataire)` EN BASE — un
 * rejeu de ce consommateur (le composite qui l englobe echoue plus loin) ne
 * met donc jamais deux fois le meme message en file. C est cette propriete
 * qui justifie qu il passe TOUJOURS EN PREMIER dans un `CompositeOutboxConsumer`
 * (§8.23 §3(a)) — en particulier sur `quote.sent`, ou il est desormais
 * compose AVANT `QuoteSentNotificationConsumer` (non idempotent).
 *
 * Parse chaque charge utile LUI-MEME (pas d import des modules
 * `commercial-quotes`/`commercial-orders`/`customers`, meme discipline que
 * `PurgeNoticeNotificationConsumer`/`QuoteSentNotificationConsumer` : chaque
 * consommateur porte sa PROPRE attente de forme, defensive, sans dependance
 * croisee entre modules metier).
 */
import type { ClaimedOutboxEvent, OutboxConsumeResult, OutboxEventConsumer } from '../../_shared/application/index.ts';
import type { TenantId } from '../../../kernel/ids/index.ts';
import { renderNotificationTags } from './notification-tag-renderer.ts';
import { coalescingWindowMinutesForEvent } from './notification-event-catalog.ts';
import type { NotificationChannel, NotificationEventName } from '../api/contracts.ts';

// ---------------------------------------------------------------------------
// Ports — colocalises avec ce consommateur (meme parti que
// `QuoteNotificationGateway`/`QuoteDocumentAttachmentGateway` dans
// `quote-sent-notification-consumer.ts`) : c est CE consommateur qui a besoin
// de CETTE forme de lecture, pas une reutilisation d un port d ecran.
// ---------------------------------------------------------------------------

/** Modele ACTIF candidat, deja filtre par `event_name` (+ etape d arrivee sur `order.step_changed`). */
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

/**
 * Contexte MINIMAL commun a `quote.converted` et `customer.created`
 * (E10.15d-1, §8.23 §11.5 : les deux ne proposent que `COMMON_TAGS` — aucune
 * balise propre a l un ou l autre). Resolu A LA REMISE, depuis `customers`/
 * `tenants`, JAMAIS depuis la charge utile du bus (meme discipline que
 * `OrderStepChangedDispatchContext`).
 */
export type CustomerNotificationContext = Readonly<{
  tenantName: string;
  /** `null` pour un client `individual`. */
  customerCompanyName: string | null;
  customerDefaultContactName: string;
}>;

/**
 * Contexte de `quote.sent` (E10.15d-1) : `CustomerNotificationContext` +
 * `quoteValidUntil`, LU A LA REMISE (jamais deduit de la charge utile — un
 * renvoi a pu le recalculer, meme discipline que
 * `QuoteNotificationGateway.getQuoteContext`, E10.10b-3). `quote.number` et
 * `order.number`/`quote.customer_reference` ne sont PAS ici : le premier vient
 * deja de la charge utile (`QuoteSentPayload.number`), le second n a
 * aujourd hui AUCUNE source de donnee (`commercial_quotes` ne porte pas de
 * `customer_reference` — meme dette documentee que
 * `order.expected_delivery_date` avant E10.16, rendu en chaine vide).
 */
export type QuoteSentDispatchContext = CustomerNotificationContext &
  Readonly<{
    /** Forme `YYYY-MM-DD`, `null` si le devis n a pas de date de validite (`CommercialSettings.default_validity_days` peut valoir `null`). */
    quoteValidUntil: string | null;
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

  /**
   * Contexte partage de `quote.converted` et `customer.created`
   * (E10.15d-1). `null` si le client/le tenant est introuvable dans ce
   * tenant — defensif, ne devrait jamais arriver pour un evenement
   * reellement emis par ce tenant.
   */
  getCustomerNotificationContext(tenantId: TenantId, customerId: string): Promise<CustomerNotificationContext | null>;

  /** Contexte de `quote.sent` (E10.15d-1). `null` si le devis/le client/le tenant est introuvable dans ce tenant — defensif. */
  getQuoteSentDispatchContext(
    tenantId: TenantId,
    quoteId: string,
    customerId: string,
  ): Promise<QuoteSentDispatchContext | null>;

  /**
   * Modeles ACTIFS de cet evenement, liste vide = cas NOMINAL (aucun modele
   * configure, §8.23 point (h)). `toStepId` ne s applique qu a
   * `order.step_changed` (SEUL evenement `supports_step_filter`, catalogue) :
   * `null` pour tout autre evenement, auquel cas AUCUN filtre d etape n est
   * applique (les modeles des quatre autres evenements ne peuvent de toute
   * facon jamais porter de `production_step_id`, contrainte de base).
   */
  findActiveTemplates(
    tenantId: TenantId,
    eventName: NotificationEventName,
    toStepId: string | null,
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
   * 1`) plutot que d en ouvrir un second. `coalescingWindowMinutes` est lu
   * depuis le catalogue d evenements (`coalescingWindowMinutesForEvent`),
   * JAMAIS en dur : `0` pour les quatre evenements branches par ce lot
   * (order.step_changed, quote.sent, quote.converted, customer.created),
   * donc cette branche ne s execute jamais ici — voir
   * `api_enqueue_notification_message` (migration).
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

/**
 * Forme validee de `QuoteSentPayload` (contrat, inchangee par ce lot),
 * PARSEE ICI plutot qu importee de `commercial-quotes` (aucune dependance
 * croisee entre modules metier — meme motif que `parseOrderStepChangedPayload`).
 * `is_resend` n est PAS lu : aucune balise ni aucune regle de ce lot n en a
 * besoin.
 */
type QuoteSentEventPayload = Readonly<{ quote_id: string; customer_id: string; number: string }>;

function parseQuoteSentPayload(payload: ClaimedOutboxEvent['payload']): QuoteSentEventPayload | null {
  const quoteId = payload['quote_id'];
  const customerId = payload['customer_id'];
  const number = payload['number'];
  if (typeof quoteId !== 'string' || typeof customerId !== 'string' || typeof number !== 'string') {
    return null;
  }
  return { quote_id: quoteId, customer_id: customerId, number };
}

/** Forme validee de `QuoteConversionPayload` (contrat), PARSEE ICI (meme motif). `source_quote_status` n est pas lu. */
type QuoteConvertedEventPayload = Readonly<{
  quote_id: string;
  customer_id: string;
  number: string;
  order_number: string;
}>;

function parseQuoteConvertedPayload(payload: ClaimedOutboxEvent['payload']): QuoteConvertedEventPayload | null {
  const quoteId = payload['quote_id'];
  const customerId = payload['customer_id'];
  const number = payload['number'];
  const orderNumber = payload['order_number'];
  if (
    typeof quoteId !== 'string' ||
    typeof customerId !== 'string' ||
    typeof number !== 'string' ||
    typeof orderNumber !== 'string'
  ) {
    return null;
  }
  return { quote_id: quoteId, customer_id: customerId, number, order_number: orderNumber };
}

/** Forme validee de la charge utile `customer.created` (EventEnvelope generique, contrat), PARSEE ICI (meme motif). Seul `customer_id` est utile : le contexte (raison sociale, interlocuteur) est relu A LA REMISE depuis `customers`, jamais depuis cette copie du bus. */
type CustomerCreatedEventPayload = Readonly<{ customer_id: string }>;

function parseCustomerCreatedPayload(payload: ClaimedOutboxEvent['payload']): CustomerCreatedEventPayload | null {
  const customerId = payload['customer_id'];
  if (typeof customerId !== 'string') return null;
  return { customer_id: customerId };
}

export type NotificationDispatchConsumerDependencies = Readonly<{
  gateway: NotificationDispatchGateway;
  logs: NotificationLogsWriteGateway;
  /** `MAGRIT_PUBLIC_APP_URL`. `null` -> aucun rendu de lien possible, echec EXPLICITE (meme discipline que `quote.sent`, §8.13sexies point 5). */
  baseUrl: string | null;
}>;

const HANDLED_EVENT_NAMES: ReadonlySet<string> = new Set([
  'order.step_changed',
  'quote.sent',
  'quote.converted',
  'customer.created',
]);

export class NotificationDispatchConsumer implements OutboxEventConsumer {
  constructor(private readonly dependencies: NotificationDispatchConsumerDependencies) {}

  async consume(event: ClaimedOutboxEvent): Promise<OutboxConsumeResult> {
    if (!HANDLED_EVENT_NAMES.has(event.name)) {
      // Defensif : ce consommateur n est cable QUE sur ces quatre evenements
      // (perimetre E10.15c + E10.15d-1, §8.23 §8/§11.5) — `order.files_submitted`
      // (fenetre de regroupement, rendu differe) reste HORS PERIMETRE, E10.15d-2.
      return { delivered: true };
    }

    if (!this.dependencies.baseUrl) {
      return { delivered: false, reason: 'MAGRIT_PUBLIC_APP_URL non configurée' };
    }
    const baseUrl = this.dependencies.baseUrl;

    switch (event.name) {
      case 'order.step_changed':
        return this.consumeOrderStepChanged(event, baseUrl);
      case 'quote.sent':
        return this.consumeQuoteSent(event, baseUrl);
      case 'quote.converted':
        return this.consumeQuoteConverted(event, baseUrl);
      case 'customer.created':
        return this.consumeCustomerCreated(event, baseUrl);
      default:
        return { delivered: true };
    }
  }

  private async consumeOrderStepChanged(event: ClaimedOutboxEvent, baseUrl: string): Promise<OutboxConsumeResult> {
    const payload = parseOrderStepChangedPayload(event.payload);
    if (!payload) {
      return {
        delivered: false,
        reason: 'order.step_changed: charge utile invalide (order_id/order_number/customer_id/to_step_id attendus)',
      };
    }

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

    // Aucune revalidation des balises ici : le texte enregistre a deja passe
    // `assertKnownNotificationTags` a l ecriture du modele (CA5) — ce rendu
    // se contente de substituer ce qu il trouve dans le contexte.
    const commonContext: Record<string, string> = {
      'tenant.name': context.tenantName,
      'customer.company_name': context.customerCompanyName ?? '',
      'order.number': payload.order_number,
      'order.customer_reference': context.orderCustomerReference ?? '',
      'order.expected_delivery_date': context.orderExpectedDeliveryDate ?? '',
      'step.label': context.stepLabel,
      'step.previous_label': context.stepPreviousLabel ?? '',
    };

    for (const template of templates) {
      const outcome = await this.dispatchTemplate(
        event,
        'order.step_changed',
        payload.customer_id,
        context.customerDefaultContactName,
        commonContext,
        template,
        baseUrl,
      );
      if (!outcome.delivered) return outcome;
    }
    return { delivered: true };
  }

  private async consumeQuoteSent(event: ClaimedOutboxEvent, baseUrl: string): Promise<OutboxConsumeResult> {
    const payload = parseQuoteSentPayload(event.payload);
    if (!payload) {
      return { delivered: false, reason: 'quote.sent: charge utile invalide (quote_id/customer_id/number attendus)' };
    }

    const templates = await this.dependencies.gateway.findActiveTemplates(event.tenantId, 'quote.sent', null);
    if (templates.length === 0) return { delivered: true };

    const context = await this.dependencies.gateway.getQuoteSentDispatchContext(
      event.tenantId,
      payload.quote_id,
      payload.customer_id,
    );
    if (!context) return { delivered: true }; // Defensif : le devis vient d etre envoye sur ce meme evenement.

    const commonContext: Record<string, string> = {
      'tenant.name': context.tenantName,
      'customer.company_name': context.customerCompanyName ?? '',
      'quote.number': payload.number,
      'quote.valid_until': context.quoteValidUntil ?? '',
      // Aucune source de donnee aujourd hui (`commercial_quotes` ne porte pas
      // de `customer_reference`) — dette documentee, meme regime que
      // `order.expected_delivery_date` avant E10.16 : chaine vide, jamais un
      // echec (`NotificationTag.nullable`).
      'quote.customer_reference': '',
    };

    for (const template of templates) {
      const outcome = await this.dispatchTemplate(
        event,
        'quote.sent',
        payload.customer_id,
        context.customerDefaultContactName,
        commonContext,
        template,
        baseUrl,
      );
      if (!outcome.delivered) return outcome;
    }
    return { delivered: true };
  }

  private async consumeQuoteConverted(event: ClaimedOutboxEvent, baseUrl: string): Promise<OutboxConsumeResult> {
    const payload = parseQuoteConvertedPayload(event.payload);
    if (!payload) {
      return {
        delivered: false,
        reason: 'quote.converted: charge utile invalide (quote_id/customer_id/number/order_number attendus)',
      };
    }

    const templates = await this.dependencies.gateway.findActiveTemplates(event.tenantId, 'quote.converted', null);
    if (templates.length === 0) return { delivered: true };

    const context = await this.dependencies.gateway.getCustomerNotificationContext(event.tenantId, payload.customer_id);
    if (!context) return { delivered: true }; // Defensif : la commande vient de naitre sur ce meme evenement.

    const commonContext: Record<string, string> = {
      'tenant.name': context.tenantName,
      'customer.company_name': context.customerCompanyName ?? '',
      'quote.number': payload.number,
      'order.number': payload.order_number,
    };

    for (const template of templates) {
      const outcome = await this.dispatchTemplate(
        event,
        'quote.converted',
        payload.customer_id,
        context.customerDefaultContactName,
        commonContext,
        template,
        baseUrl,
      );
      if (!outcome.delivered) return outcome;
    }
    return { delivered: true };
  }

  private async consumeCustomerCreated(event: ClaimedOutboxEvent, baseUrl: string): Promise<OutboxConsumeResult> {
    const payload = parseCustomerCreatedPayload(event.payload);
    if (!payload) {
      return { delivered: false, reason: 'customer.created: charge utile invalide (customer_id attendu)' };
    }

    const templates = await this.dependencies.gateway.findActiveTemplates(event.tenantId, 'customer.created', null);
    if (templates.length === 0) return { delivered: true };

    const context = await this.dependencies.gateway.getCustomerNotificationContext(event.tenantId, payload.customer_id);
    if (!context) return { delivered: true }; // Defensif : le client vient d etre cree sur ce meme evenement.

    const commonContext: Record<string, string> = {
      'tenant.name': context.tenantName,
      'customer.company_name': context.customerCompanyName ?? '',
    };

    for (const template of templates) {
      const outcome = await this.dispatchTemplate(
        event,
        'customer.created',
        payload.customer_id,
        context.customerDefaultContactName,
        commonContext,
        template,
        baseUrl,
      );
      if (!outcome.delivered) return outcome;
    }
    return { delivered: true };
  }

  /**
   * Resout les destinataires d UN modele et met en file un message par
   * destinataire — PARTAGE par les quatre evenements : seuls `customerId`,
   * `customerDefaultContactName` et `commonContext` (deja construits par
   * l appelant, specifiques a l evenement) different d un evenement a
   * l autre. Meme logique EXACTE que la version E10.15c a laquelle
   * `order.step_changed` etait seul abonne.
   */
  private async dispatchTemplate(
    event: ClaimedOutboxEvent,
    eventName: NotificationEventName,
    customerId: string,
    customerDefaultContactName: string,
    commonContext: Record<string, string>,
    template: ActiveNotificationTemplate,
    baseUrl: string,
  ): Promise<OutboxConsumeResult> {
    if (template.audience === 'customer') {
      const recipients = await this.dependencies.gateway.resolveCustomerRecipients(event.tenantId, customerId);

      if (recipients.length === 0) {
        // §8.23 (description NotificationLog) : « un modele actif qui ne
        // previent personne, faute d interlocuteur renseigne, est exactement
        // le cas qu il faut voir » — entree DROPPED, jamais un silence.
        return this.enqueueOne(event, eventName, template, {
          status: 'dropped',
          recipient: null,
          lastError: 'notification.no_recipient: aucun compte boutique actif ou invité rattaché à ce client.',
          context: {
            ...commonContext,
            'customer.contact_name': customerDefaultContactName,
            'link.portal_quotes': '',
          },
        });
      }

      for (const recipient of recipients) {
        const outcome = await this.enqueueOne(event, eventName, template, {
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
      'customer.contact_name': customerDefaultContactName,
      'link.portal_quotes': defaultShop ? buildPortalQuotesLink(baseUrl, defaultShop.slug) : '',
    };

    for (const recipient of template.recipients ?? []) {
      const outcome = await this.enqueueOne(event, eventName, template, {
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
    eventName: NotificationEventName,
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
          // `eventName` (parametre, `NotificationEventName`), pas `event.name`
          // (`EventNameDto`, le vocabulaire GENERAL du bus, plus large que le
          // sous-ensemble NOTIFIABLE) : `consume()` a deja aiguille sur l un
          // des quatre evenements geres avant d atteindre ce point.
          coalescingWindowMinutes: coalescingWindowMinutesForEvent(eventName),
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
