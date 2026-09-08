/**
 * Consommateur `quote.sent` du drain outbox (story E10.10b-3,
 * docs/api/CONVENTIONS.md §8.13sexies). Vit dans le module METIER (pas dans
 * le socle) : c est lui qui sait ce qu un devis envoye doit declencher.
 *
 * Destinataires resolus A LA REMISE (jamais portes par la charge utile) :
 * les `shop_customer_accounts` du tenant de l evenement, rattaches a un
 * `customer_contacts` du client du devis, de statut `active` OU `invited`
 * (`suspended`/`delegated_only` exclus — §8.13sexies point 4). Un client
 * sans aucun compte boutique ouvert est le cas NOMINAL : l evenement est
 * marque livre, pas en echec (`ConsumeResult.delivered = true`).
 *
 * `valid_until` est lu sur le devis A LA REMISE (jamais deduit de la charge
 * utile) : un renvoi a pu le recalculer, et ce n est pas une donnee
 * tarifaire.
 *
 * Echec PARTIEL sur plusieurs destinataires -> l evenement ENTIER echoue
 * (unite de livraison, tout ou rien) : un doublon de notification au rejeu
 * est assume (§8.13sexies point 5), pas une table de livraison par
 * destinataire (dette tracee, pas comblee ici).
 */
import type { ClaimedOutboxEvent, OutboxConsumeResult, OutboxEventConsumer } from '../../_shared/application/index.ts';
import type { TenantId } from '../../../kernel/ids/index.ts';

// ---------------------------------------------------------------------------
// Port email — STRICTEMENT le patron de StorefrontActivationEmailSender
// (src/modules/shop-customers/application/storefront-activation-email-sender.ts) :
// une interface DEDIEE, petite, colocalisee avec son consommateur plutot que
// noyee dans CommercialQuotesRepository.
// ---------------------------------------------------------------------------

export type QuoteSentEmail = Readonly<{
  to: string;
  customerName: string;
  shopName: string;
  quoteNumber: string;
  /** Deja formate en francais lisible (ex. "12 septembre 2026"), ou `null` si le devis n a pas de date de validite. */
  validUntilLabel: string | null;
  isResend: boolean;
  link: string;
}>;

export type QuoteSentEmailDelivery = Readonly<{ sent: boolean; reason?: string }>;

export interface QuoteSentEmailSender {
  send(message: QuoteSentEmail): Promise<QuoteSentEmailDelivery>;
}

// ---------------------------------------------------------------------------
// Port de resolution — implemente par SupabaseQuoteNotificationGateway
// (src/adapters/supabase/commercial-quotes-repository.ts), sur un client
// service_role. Jointure EXPLICITE shops.tenant_id = <tenant de l evenement>
// EXIGEE par l implementation (§8.13sexies, "Isolation") : une erreur ici
// enverrait un devis dans la boite d un tiers, pas juste sur le mauvais
// ecran.
// ---------------------------------------------------------------------------

export type QuoteNotificationRecipient = Readonly<{
  email: string;
  customerName: string;
  shopSlug: string;
  shopName: string;
}>;

export type QuoteNotificationQuoteContext = Readonly<{
  validUntil: string | null;
}>;

export interface QuoteNotificationGateway {
  /**
   * `null` si le devis n existe pas dans CE tenant (defensif : ne devrait pas
   * arriver pour un `quote.sent` reel, traite comme "rien a notifier",
   * jamais comme un echec).
   */
  getQuoteContext(tenantId: TenantId, quoteId: string): Promise<QuoteNotificationQuoteContext | null>;

  /**
   * Comptes boutique ACTIFS ou INVITES rattaches, via `customer_contacts`, au
   * client du devis, DANS LE TENANT de l evenement. Liste vide = cas
   * nominal (§8.13sexies point 4).
   */
  resolveRecipients(
    tenantId: TenantId,
    customerId: string,
  ): Promise<readonly QuoteNotificationRecipient[]>;
}

const FRENCH_MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

/**
 * Formate une date `date` Postgres (`YYYY-MM-DD`, sans heure/fuseau) en
 * francais lisible ("12 septembre 2026"). Parsing MANUEL des composants
 * plutot que `Date`/`Intl` : `valid_until` n a ni heure ni fuseau, une
 * conversion via `Date` risquerait un decalage de jour selon le fuseau
 * d execution (meme classe de piege que documente dans
 * `timestamps.ts` pour les `timestamptz`, en pire ici puisqu il n y a pas de
 * fuseau du tout a interpreter).
 */
export function formatFrenchDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  const [, year, month, day] = match as unknown as [string, string, string, string];
  const monthLabel = FRENCH_MONTHS[Number(month) - 1] ?? month;
  return `${Number(day)} ${monthLabel} ${year}`;
}

/**
 * Chemin SERVEUR du portail client, litteral UNIQUE (§8.13sexies, "Le
 * lien" — piege signale explicitement par l architecte) : `portalRuntimePaths`
 * est un registre COTE NAVIGATEUR (`src/app/surfaces/portalRuntimePaths.ts`),
 * inutilisable depuis un consommateur de drain (aucun bundle navigateur).
 * Meme patron que `/shop/${slug}/activate` deja en place
 * (`storefront-activation-service.ts`). Un test dedie
 * (`tests/modules/commercial-quotes/quote-sent-notification-consumer.test.ts`)
 * assere l egalite de ce chemin avec `portalRuntimePaths` : si quelqu un
 * renomme la route du portail sans mettre a jour ce litteral, ce test tombe.
 */
export function buildAccountQuotesLink(baseUrl: string, shopSlug: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/shop/${encodeURIComponent(shopSlug)}/account/quotes`;
}

/** Forme validee du payload `QuoteSentPayload` (contrat, inchange par ce lot). */
type QuoteSentEventPayload = Readonly<{
  quote_id: string;
  customer_id: string;
  number: string;
  is_resend: boolean;
}>;

function parseQuoteSentPayload(payload: ClaimedOutboxEvent['payload']): QuoteSentEventPayload | null {
  const quoteId = payload['quote_id'];
  const customerId = payload['customer_id'];
  const number = payload['number'];
  const isResend = payload['is_resend'];
  if (
    typeof quoteId !== 'string' ||
    typeof customerId !== 'string' ||
    typeof number !== 'string' ||
    typeof isResend !== 'boolean'
  ) {
    return null;
  }
  return { quote_id: quoteId, customer_id: customerId, number, is_resend: isResend };
}

export type QuoteSentNotificationConsumerDependencies = Readonly<{
  gateway: QuoteNotificationGateway;
  emailSender: QuoteSentEmailSender;
  /** `MAGRIT_PUBLIC_APP_URL`. `null` -> aucun envoi possible (§8.13sexies point 4, "Le lien"). */
  baseUrl: string | null;
}>;

export class QuoteSentNotificationConsumer implements OutboxEventConsumer {
  constructor(private readonly dependencies: QuoteSentNotificationConsumerDependencies) {}

  async consume(event: ClaimedOutboxEvent): Promise<OutboxConsumeResult> {
    const payload = parseQuoteSentPayload(event.payload);
    if (!payload) {
      return { delivered: false, reason: 'quote.sent: charge utile invalide (quote_id/customer_id/number/is_resend attendus)' };
    }

    // Pas de lien possible sans base publique : echec explicite, PAS de
    // repli silencieux (§8.13sexies point 5, "personne ne regarde le retour
    // d un tour de cron").
    if (!this.dependencies.baseUrl) {
      return { delivered: false, reason: 'MAGRIT_PUBLIC_APP_URL non configurée' };
    }

    const context = await this.dependencies.gateway.getQuoteContext(event.tenantId, payload.quote_id);
    if (!context) {
      // Devis introuvable dans ce tenant : defensif, ne devrait pas arriver
      // pour un quote.sent reel. Rien a notifier != echec.
      return { delivered: true };
    }

    const recipients = await this.dependencies.gateway.resolveRecipients(event.tenantId, payload.customer_id);
    if (recipients.length === 0) {
      // Cas NOMINAL (§8.13sexies point 4) : aucun compte boutique ouvert.
      return { delivered: true };
    }

    const validUntilLabel = context.validUntil ? formatFrenchDate(context.validUntil) : null;

    const deliveries = await Promise.all(
      recipients.map((recipient) =>
        this.dependencies.emailSender.send({
          to: recipient.email,
          customerName: recipient.customerName,
          shopName: recipient.shopName,
          quoteNumber: payload.number,
          validUntilLabel,
          isResend: payload.is_resend,
          link: buildAccountQuotesLink(this.dependencies.baseUrl as string, recipient.shopSlug),
        }),
      ),
    );

    // Unite de livraison : un seul echec fait echouer l evenement ENTIER
    // (§8.13sexies point 5, "Echec partiel").
    const failure = deliveries.find((delivery) => !delivery.sent);
    if (failure) {
      return { delivered: false, reason: failure.reason ?? 'échec d envoi non détaillé' };
    }

    return { delivered: true };
  }
}
