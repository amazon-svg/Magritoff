/**
 * Drain periodique de l outbox (story E10.10b-3, docs/api/CONVENTIONS.md
 * §8.13sexies).
 *
 * Ce module ne connait AUCUN module metier : il recoit un REGISTRE de
 * consommateurs (`Partial<Record<EventNameDto, OutboxEventConsumer>>`) au lieu
 * d importer `commercial-quotes` ou tout autre module — meme frontiere que le
 * reste du socle (`tests/architecture/gescom-api-socle-boundaries.test.ts`,
 * "le socle ne depend d aucun module metier").
 *
 * Mecanisme : un TOUR reclame un lot borne d evenements en attente (via
 * `OutboxDispatchRepository.claim()`, qui delegue a la fonction Postgres
 * `api_claim_outbox_events` — reclamation atomique, backoff et rebut par
 * fraicheur y sont DEJA appliques, ce module ne les reimplemente pas), les
 * remet un par un au consommateur enregistre pour leur `event_name`, puis
 * rend la main. Aucune boucle, aucun sommeil : l isolat vit le temps d un
 * tour (Edge Runtime a duree bornee).
 *
 * Un evenement SANS consommateur enregistre est marque LIVRE, jamais en
 * echec (§8.13sexies point 3, "Un evenement sans consommateur est livre, pas
 * en echec") : `quote.created`/`quote.accepted`/`quote.rejected`/
 * `customer.created`… n ont aucun abonne dans ce lot, les laisser en attente
 * les ferait s accumuler puis partir au rebut, polluant la seule file qui
 * doit rester lisible.
 *
 * Un consommateur qui LEVE (au lieu de rendre `{delivered:false, reason}`)
 * est traite comme un echec — defense en profondeur, le patron des
 * adaptateurs (Resend) ne doit normalement jamais lever, mais un socle ne
 * doit pas dependre de cette discipline pour rester correct.
 */
import type { EventNameDto } from '../api/contracts.ts';
import type { TenantId } from '../../../kernel/ids/index.ts';

/** Evenement reclame par le drain, pret a etre remis a un consommateur. */
export type ClaimedOutboxEvent = Readonly<{
  id: string;
  tenantId: TenantId;
  name: EventNameDto;
  version: number;
  aggregateType: string;
  aggregateId: string;
  payload: Readonly<Record<string, unknown>>;
  occurredAt: string;
  deliveryAttempts: number;
}>;

/** Reglages du drain (E10.10b-3, reserve e — confirmes par Arnaud). */
export type OutboxDispatchSettings = Readonly<{
  /** Taille de lot par tour. Confirme : 25. */
  limit: number;
  /** Tentatives avant rebut. Confirme : 5. */
  maxAttempts: number;
  /** Fraicheur au-dela de laquelle un evenement part au rebut sans remise, en secondes. Confirme : 24h. */
  maxAgeSeconds: number;
}>;

export const DEFAULT_OUTBOX_DISPATCH_SETTINGS: OutboxDispatchSettings = Object.freeze({
  limit: 25,
  maxAttempts: 5,
  maxAgeSeconds: 24 * 60 * 60,
});

/**
 * Port d acces a la file. L implementation Supabase
 * (`src/adapters/supabase/outbox-dispatch-repository.ts`) delegue la
 * reclamation a `api_claim_outbox_events` (service_role SEUL) et le verdict
 * a de simples UPDATE colonne (grants deja en place).
 */
export interface OutboxDispatchRepository {
  /** Reclame un lot, ATOMIQUEMENT (skip locked cote base). */
  claim(settings: OutboxDispatchSettings): Promise<readonly ClaimedOutboxEvent[]>;
  /** Marque l evenement livre (`published_at = now()`). Vaut aussi pour "livre a zero consommateur". */
  markDelivered(eventId: string): Promise<void>;
  /** Enregistre l echec (`last_error`) ; l evenement reste `published_at is null`, repris au prochain tour selon le backoff DEJA pose par `claim()`. */
  markFailed(eventId: string, reason: string): Promise<void>;
}

/** Issue de traitement d un evenement par un consommateur metier. */
export type OutboxConsumeResult =
  | Readonly<{ delivered: true }>
  | Readonly<{ delivered: false; reason: string }>;

/**
 * Un consommateur metier : sait traiter UN `event_name`. Ne leve jamais
 * (patron des adaptateurs Resend, §8.13sexies point 4) — un echec se rend en
 * valeur, pas en exception.
 */
export interface OutboxEventConsumer {
  consume(event: ClaimedOutboxEvent): Promise<OutboxConsumeResult>;
}

/** Registre des consommateurs, par `event_name`. Absent = livre sans traitement (§8.13sexies point 3). */
export type OutboxConsumerRegistry = Partial<Record<EventNameDto, OutboxEventConsumer>>;

export type DispatchReport = Readonly<{
  claimed: number;
  delivered: number;
  failed: number;
  errors: readonly Readonly<{ eventId: string; eventName: EventNameDto; reason: string }>[];
}>;

export type OutboxDispatcherDependencies = Readonly<{
  repository: OutboxDispatchRepository;
  consumers: OutboxConsumerRegistry;
  settings?: OutboxDispatchSettings;
  /** Journalisation best-effort d une erreur inattendue (consommateur qui leve). Ne bloque jamais le tour. */
  onUnhandledError?: (error: unknown, event: ClaimedOutboxEvent) => void;
}>;

/** Drain : UN tour = reclame, remet, rend la main. Aucune boucle interne. */
export class OutboxDispatcher {
  private readonly settings: OutboxDispatchSettings;

  constructor(private readonly dependencies: OutboxDispatcherDependencies) {
    this.settings = dependencies.settings ?? DEFAULT_OUTBOX_DISPATCH_SETTINGS;
  }

  async runOnce(): Promise<DispatchReport> {
    const claimed = await this.dependencies.repository.claim(this.settings);
    let delivered = 0;
    let failed = 0;
    const errors: Array<{ eventId: string; eventName: EventNameDto; reason: string }> = [];

    for (const event of claimed) {
      const consumer = this.dependencies.consumers[event.name];

      if (!consumer) {
        // Aucun consommateur enregistre : LIVRE, pas en echec.
        await this.dependencies.repository.markDelivered(event.id);
        delivered += 1;
        continue;
      }

      let result: OutboxConsumeResult;
      try {
        result = await consumer.consume(event);
      } catch (error) {
        this.dependencies.onUnhandledError?.(error, event);
        result = {
          delivered: false,
          reason: error instanceof Error ? error.message : 'erreur inattendue du consommateur',
        };
      }

      if (result.delivered) {
        await this.dependencies.repository.markDelivered(event.id);
        delivered += 1;
      } else {
        await this.dependencies.repository.markFailed(event.id, result.reason);
        failed += 1;
        errors.push({ eventId: event.id, eventName: event.name, reason: result.reason });
      }
    }

    return Object.freeze({ claimed: claimed.length, delivered, failed, errors: Object.freeze(errors) });
  }
}
