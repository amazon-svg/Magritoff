/**
 * Combinateur GENERIQUE de consommateurs outbox (story E10.15c, contrat
 * §8.23 §3(a)).
 *
 * Le registre du socle (`OutboxConsumerRegistry`) reste « un consommateur
 * par `event_name` » — c est volontaire (voir `outbox-dispatcher.ts`) :
 * elargir ce registre en liste aurait ete une modification du SOCLE pour un
 * besoin de COMPOSITION. `CompositeOutboxConsumer` n a AUCUNE connaissance
 * metier (il a donc sa place ici, dans `_shared/application/`, pas dans un
 * module) : il execute une liste ORDONNEE de `OutboxEventConsumer` derriere
 * UN SEUL enregistrement du registre, et echoue des que l un d eux echoue.
 *
 * L ORDRE EST OPPOSABLE. Un evenement dont le composite echoue est REJOUE EN
 * ENTIER au tour suivant (meme `event_id`, backoff du drain) : les
 * consommateurs qui ont deja reussi sont donc RE-INVOQUES. Un consommateur
 * IDEMPOTENT (protege par une contrainte d unicite, ex.
 * `NotificationDispatchConsumer`) ne souffre pas de ce rejeu ; un
 * consommateur qui ne l est PAS (ex. l envoyeur de devis existant,
 * `QuoteSentNotificationConsumer`, qui n a pas de garde d unicite sur son
 * propre effet) renverrait alors un second courriel. D ou la regle : un
 * consommateur idempotent precede TOUJOURS un consommateur qui ne l est pas.
 */
import type { ClaimedOutboxEvent, OutboxConsumeResult, OutboxEventConsumer } from './outbox-dispatcher.ts';

export class CompositeOutboxConsumer implements OutboxEventConsumer {
  private readonly consumers: readonly OutboxEventConsumer[];

  constructor(consumers: readonly OutboxEventConsumer[]) {
    if (consumers.length === 0) {
      throw new TypeError('CompositeOutboxConsumer requiert au moins un consommateur.');
    }
    this.consumers = consumers;
  }

  async consume(event: ClaimedOutboxEvent): Promise<OutboxConsumeResult> {
    for (const consumer of this.consumers) {
      const result = await consumer.consume(event);
      if (!result.delivered) return result;
    }
    return { delivered: true };
  }
}
