/**
 * Consommateur outbox `order_files.purge_scheduled` (E10.22a,
 * docs/api/CONVENTIONS.md §8.22 §4). Vit dans le module METIER
 * (order-files), pas dans le socle -- meme parti que
 * `QuoteSentNotificationConsumer` (commercial-quotes).
 *
 * SEUL CONSOMMATEUR DU BUS QUI DOIT « RENDRE COMPTE » (arbitrage Arnaud du
 * 2026-09-10) : la remise du courriel AUTORISE une destruction quinze jours
 * plus tard (E10.22b), donc CE consommateur consigne, pour chaque
 * destinataire, ce qu il obtient de Resend (`PurgeNoticeDeliveryGateway`) --
 * pas seulement s il a reussi a envoyer.
 *
 * Destinataires resolus A LA REMISE (jamais portes par la charge utile,
 * meme doctrine que `quote.sent`) : le proprietaire a pu changer depuis
 * l emission du rappel.
 *
 * UNITE DE LIVRAISON DIFFERENTE DE `quote.sent` : un SEUL destinataire
 * accepte par Resend suffit a livrer l evenement (§2 du contrat :
 * "confirmed_at = instant de la PREMIERE livraison confirmee" -- un
 * destinataire joint suffit, le but est qu un humain ait ete prevenu, pas
 * que tous l aient ete). Livrer FAUX seulement si AUCUN destinataire n a pu
 * etre atteint -- l evenement est alors rejoue par le drain (meme
 * `notice_id`, donc jamais un second rappel cote base, §4 du contrat :
 * "PAS event_id").
 */
import type { ClaimedOutboxEvent, OutboxConsumeResult, OutboxEventConsumer } from '../../_shared/application/index.ts';
import type {
  PurgeNoticeDeliveryGateway,
  PurgeNoticeRecipientGateway,
} from './purge-notice-gateway.ts';
import type { PurgeNoticeEmailDelivery, PurgeNoticeEmailSender } from './purge-notice-email-sender.ts';

/** Garde de type EXPLICITE -- voir l usage dans `consume()` pour le motif. */
function isFailedDelivery(
  outcome: PurgeNoticeEmailDelivery,
): outcome is Readonly<{ sent: false; reason: string }> {
  return !outcome.sent;
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
 * Formate un `Timestamp` du contrat (ISO 8601 UTC, ex.
 * "2026-10-12T00:00:00Z") en francais lisible ("12 octobre 2026"). Parsing
 * MANUEL des composants -- meme discipline que `formatFrenchDate`
 * (commercial-quotes) -- DUPLIQUEE ICI plutot qu importee (petite fonction
 * pure sans logique metier, meme parti que `escapeHtml`, deja duplique dans
 * chaque envoyeur Resend du depot) : eviter une dependance inter-module pour
 * quinze lignes.
 */
export function formatFrenchPurgeDate(isoTimestamp: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoTimestamp);
  if (!match) return isoTimestamp;
  const [, year, month, day] = match as unknown as [string, string, string, string];
  const monthLabel = FRENCH_MONTHS[Number(month) - 1] ?? month;
  return `${Number(day)} ${monthLabel} ${year}`;
}

/** Forme validee du payload `OrderFilesPurgeScheduledPayload` (contrat). */
type PurgeScheduledEventPayload = Readonly<{
  notice_id: string;
  stage: 'first' | 'second';
  file_count: number;
  order_count: number;
  purge_at: string;
  days_before_purge: number;
  order_ids: readonly string[];
}>;

function parsePurgeScheduledPayload(payload: ClaimedOutboxEvent['payload']): PurgeScheduledEventPayload | null {
  const noticeId = payload['notice_id'];
  const stage = payload['stage'];
  const fileCount = payload['file_count'];
  const orderCount = payload['order_count'];
  const purgeAt = payload['purge_at'];
  const daysBeforePurge = payload['days_before_purge'];
  const orderIds = payload['order_ids'];
  if (
    typeof noticeId !== 'string' ||
    (stage !== 'first' && stage !== 'second') ||
    typeof fileCount !== 'number' ||
    typeof orderCount !== 'number' ||
    typeof purgeAt !== 'string' ||
    typeof daysBeforePurge !== 'number' ||
    !Array.isArray(orderIds) ||
    orderIds.length === 0 ||
    !orderIds.every((id): id is string => typeof id === 'string')
  ) {
    return null;
  }
  return {
    notice_id: noticeId,
    stage,
    file_count: fileCount,
    order_count: orderCount,
    purge_at: purgeAt,
    days_before_purge: daysBeforePurge,
    order_ids: orderIds,
  };
}

/**
 * Chemin SERVEUR du workspace, litteral UNIQUE (qa-review round 1, B2 --
 * meme piege signale explicitement pour le lien devis d E10.10b-3,
 * §8.13sexies "Le lien") : `workspaceRuntimeRoutes` est un registre COTE
 * NAVIGATEUR (`src/app/surfaces/workspaceRuntimeRoutes.tsx`), inutilisable
 * depuis un consommateur de drain (aucun bundle navigateur, execution Deno).
 * Un test dedie (`tests/modules/order-files/purge-notice-notification-
 * consumer.test.ts`) assere l egalite de la portion `commercial-orders/:orderId`
 * de ce chemin avec le registre de surfaces (`workspaceSurface`, route
 * `commercial-orders.workspace.detail`) : si cette route change sans que ce
 * litteral suive, ce test tombe. LIMITE CONNUE (qa-review round 2) : le
 * prefixe `/t/:tenantSlug/dashboard` n est verifie contre AUCUN registre —
 * contrairement au portail client (`portalRuntimePaths`), le workspace n a
 * pas de registre de prefixe equivalent. Le test ne couvre donc PAS le
 * montage reel de `src/app/routes.tsx`, seulement la route interne. Extraire
 * un `workspaceRuntimePaths` fermerait cet ecart — hors perimetre d E10.22a.
 */
export function buildOrderDetailLink(baseUrl: string, tenantSlug: string, orderId: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/t/${encodeURIComponent(tenantSlug)}/dashboard/commercial-orders/${encodeURIComponent(orderId)}`;
}

export type PurgeNoticeNotificationConsumerDependencies = Readonly<{
  recipients: PurgeNoticeRecipientGateway;
  deliveries: PurgeNoticeDeliveryGateway;
  emailSender: PurgeNoticeEmailSender;
  /** `MAGRIT_PUBLIC_APP_URL`. `null` -> aucun envoi possible (§8.13sexies point 4, "Le lien"; qa-review round 1 B2). */
  publicAppUrl: string | null;
}>;

export class PurgeNoticeNotificationConsumer implements OutboxEventConsumer {
  constructor(private readonly dependencies: PurgeNoticeNotificationConsumerDependencies) {}

  async consume(event: ClaimedOutboxEvent): Promise<OutboxConsumeResult> {
    const payload = parsePurgeScheduledPayload(event.payload);
    if (!payload) {
      return {
        delivered: false,
        reason:
          'order_files.purge_scheduled: charge utile invalide (notice_id/stage/file_count/order_count/purge_at/days_before_purge/order_ids attendus)',
      };
    }

    // Pas de lien possible sans base publique : echec explicite, PAS de
    // repli silencieux (meme discipline que quote.sent, §8.13sexies point 5 —
    // qa-review round 1 B2 : le contrat exige des liens vers les fiches
    // commande dans CE rappel, ils ne sont jamais devinables).
    if (!this.dependencies.publicAppUrl) {
      return { delivered: false, reason: 'MAGRIT_PUBLIC_APP_URL non configurée' };
    }

    const tenantSlug = await this.dependencies.recipients.getTenantSlug(event.tenantId);
    if (!tenantSlug) {
      // Tenant introuvable : defensif, ne devrait pas arriver pour un
      // evenement reellement emis par ce tenant. Rien a notifier != echec.
      return { delivered: true };
    }

    const recipients = await this.dependencies.recipients.resolveRecipients(event.tenantId);
    if (recipients.length === 0) {
      // Le proprietaire (ou son adresse) a disparu entre l emission et la
      // remise : CAS NOMINAL, pas un echec (meme doctrine que quote.sent).
      // notices.confirmed_at ne se posera jamais -> la garde de purge
      // d E10.22b bloque -> api_expire_order_file_purge_notices (E10.22a-bis)
      // debloquera la situation au bout de la fenetre, vers les
      // destinataires DU MOMENT.
      return { delivered: true };
    }

    const purgeAtLabel = formatFrenchPurgeDate(payload.purge_at);
    const orderLinks = payload.order_ids.map((orderId) =>
      buildOrderDetailLink(this.dependencies.publicAppUrl as string, tenantSlug, orderId),
    );

    const outcomes = await Promise.all(
      recipients.map(async (recipient) => {
        const delivery = await this.dependencies.emailSender.send({
          to: recipient.email,
          stage: payload.stage,
          fileCount: payload.file_count,
          orderCount: payload.order_count,
          purgeAtLabel,
          daysBeforePurge: payload.days_before_purge,
          orderLinks,
        });

        await this.dependencies.deliveries.recordDeliveryAttempt(payload.notice_id, recipient, {
          providerMessageId: delivery.sent ? delivery.providerMessageId : null,
        });

        return delivery;
      }),
    );

    // Unite de livraison : UN SEUL destinataire accepte par Resend suffit
    // (§2 du contrat -- "un destinataire joint suffit"), CONTRAIREMENT a
    // `quote.sent` (echec partiel -> evenement entier en echec). Zero
    // acceptation -> l evenement est rejoue par le drain (backoff), MEME
    // notice_id donc AUCUNE seconde ligne de suivi cote base.
    const accepted = outcomes.find((outcome) => outcome.sent);
    if (!accepted) {
      // Predicat de type EXPLICITE (`is`) : le narrowing du discriminant
      // `sent` a travers `.find()` n est fiable, dans TOUTES les
      // configurations tsconfig de ce depot, qu avec un garde de type
      // declare -- jamais par inference implicite sur une valeur issue d un
      // tableau.
      const firstFailure = outcomes.find(isFailedDelivery);
      return { delivered: false, reason: firstFailure?.reason ?? 'aucun destinataire accepte par Resend' };
    }

    return { delivered: true };
  }
}
