import type {
  EmailDeliveryStatus,
  EmailDeliveryStatusGateway,
} from '../../modules/order-files/application/purge-notice-delivery-status-gateway.ts';

/**
 * Relecture `GET /emails/{email_id}` -> `Email.last_event` (E10.22a-bis,
 * docs/api/CONVENTIONS.md §8.22 §0/§4).
 *
 * Verifie le 2026-09-10 sur `https://resend.com/openapi.json` (HTTP 200,
 * 200008 octets) -- PAS de memoire d entrainement : le schema `Email` rend
 * `last_event: string`, avec pour SEUL exemple documente `"delivered"`.
 * AUCUNE enumeration exhaustive n est publiee (recherche faite dans le
 * document entier : seules trois valeurs apparaissent, comme EXEMPLE d un
 * tableau `events` de webhook -- `email.sent`/`email.delivered`/
 * `email.bounced` -- jamais comme une liste fermee de `last_event`).
 *
 * CONSEQUENCE OPPOSABLE : ce gateway ne DEVINE aucune enumeration. Il rend
 * la chaine BRUTE ; c est `PurgeSweepService` qui decide, en ne traitant que
 * `"delivered"` comme une confirmation -- tout le reste (y compris
 * `"bounced"`, dont seul le NOM de l evenement webhook est confirme par la
 * specification, jamais la valeur exacte de `last_event`) reste PENDANT
 * jusqu a expiration de la fenetre de relecture (`api_expire_order_file_
 * purge_notices`). Voir le rapport de fin de story : ceci est une LIMITE
 * DOCUMENTEE, pas une negligence -- la fenetre, pas une enumeration devinee,
 * est le mecanisme de secours general.
 *
 * JAMAIS de `throw` (patron des adaptateurs Resend du depot) : `null` =
 * relecture impossible, traitee PAR L APPELANT comme "toujours pendante".
 */
export class ResendEmailDeliveryStatusGateway implements EmailDeliveryStatusGateway {
  constructor(
    private readonly apiKey: string | null,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch,
  ) {}

  async fetchStatus(providerMessageId: string): Promise<EmailDeliveryStatus | null> {
    if (!this.apiKey) return null;
    try {
      const response = await this.fetchImplementation(
        `https://api.resend.com/emails/${encodeURIComponent(providerMessageId)}`,
        { headers: { Authorization: `Bearer ${this.apiKey}` } },
      );
      if (!response.ok) return null;
      const body = (await response.json()) as { last_event?: unknown };
      return { lastEvent: typeof body.last_event === 'string' ? body.last_event : null };
    } catch {
      return null;
    }
  }
}
