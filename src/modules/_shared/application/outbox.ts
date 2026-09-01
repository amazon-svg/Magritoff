/**
 * Bus d evenements sortants (story E10.0, CA10).
 *
 * Mecanisme generique, reutilisable tel quel par les stories E10.x : elles
 * appellent `publisher.publish(...)` dans la meme transaction que leur
 * ecriture metier, rien de plus. E10.0 ne publie aucun evenement.
 *
 * Pattern outbox : l evenement est ECRIT EN BASE dans la meme transaction que
 * la modification metier, puis relaye. Publier directement en HTTP depuis le
 * service casse l atomicite — la commande passe mais l evenement se perd, ou
 * l inverse.
 *
 * Livraison AU MOINS UNE FOIS : le consommateur doit dedupliquer sur
 * `event_id`. La signature `X-Magrit-Signature: sha256=<hmac>` couvre le corps
 * brut exact ; elle se verifie en comparaison a temps constant.
 *
 * --------------------------------------------------------------------------
 * Sort de `DomainEvent` (src/kernel/events/index.ts) — decision E10.0
 * --------------------------------------------------------------------------
 * Le type `DomainEvent<Name, Payload>` existait sans aucun usage. Il est
 * CONSERVE et REUTILISE comme socle : `OutboxEvent` en derive au lieu de le
 * remplacer. Il apportait deja id / name / occurredAt / tenantId /
 * aggregateId / payload ; il lui manquait la VERSION de payload et le TYPE d
 * agregat, exiges par CA10. Ces deux champs sont ajoutes par intersection,
 * cote module, sans toucher au kernel : le kernel reste minimal (R4) et aucun
 * code existant n est modifie.
 */
import type { DomainEvent } from '../../../kernel/events/index.ts';
import type { TenantId } from '../../../kernel/ids/index.ts';
import {
  EVENT_NAME_HEADER,
  EVENT_SIGNATURE_HEADER,
  eventEnvelopeSchema,
  OUTBOX_EVENT_NAMES,
  type EventEnvelopeDto,
  type EventNameDto,
} from '../api/contracts.ts';

export { EVENT_NAME_HEADER, EVENT_SIGNATURE_HEADER, OUTBOX_EVENT_NAMES };
export type { EventEnvelopeDto, EventNameDto };

/** Version courante du schema de payload, par evenement. */
export const OUTBOX_EVENT_VERSIONS: Readonly<Record<EventNameDto, number>> = Object.freeze({
  'quote.converted': 1,
  'order.step_changed': 1,
  'order.files_submitted': 1,
  'customer.created': 1,
  'project.created': 1,
  'price_rule.changed': 1,
});

export type EventPayload = Readonly<Record<string, unknown>>;

/**
 * Evenement sortant. Derive de `DomainEvent` du kernel, augmente des deux
 * champs exiges par le contrat : version de payload et type d agregat.
 */
export type OutboxEvent<TName extends EventNameDto = EventNameDto> = DomainEvent<
  TName,
  EventPayload
> &
  Readonly<{
    version: number;
    aggregateType: string;
  }>;

/** Ce qu un service metier fournit ; le reste est derive par le socle. */
export type OutboxEventDraft<TName extends EventNameDto = EventNameDto> = Readonly<{
  name: TName;
  tenantId: TenantId;
  aggregateType: string;
  aggregateId: string;
  payload: EventPayload;
  /** Version explicite, sinon `OUTBOX_EVENT_VERSIONS[name]`. */
  version?: number;
}>;

/**
 * Port d ecriture dans la table `outbox_events`. L implementation Supabase
 * vit dans src/adapters/supabase/ ; le socle n en connait que le contrat.
 */
export interface OutboxRepository {
  /** Ecrit les evenements, dans la meme transaction que l ecriture metier. */
  append(events: readonly OutboxEvent[]): Promise<void>;
}

export type OutboxPublisherDependencies = Readonly<{
  repository: OutboxRepository;
  now: () => Date;
  newEventId: () => string;
}>;

/** Point d entree unique des modules E10.x pour emettre un evenement. */
export class OutboxPublisher {
  constructor(private readonly dependencies: OutboxPublisherDependencies) {}

  async publish(...drafts: readonly OutboxEventDraft[]): Promise<readonly OutboxEvent[]> {
    const events = drafts.map((draft) => this.toEvent(draft));
    if (events.length > 0) await this.dependencies.repository.append(events);
    return events;
  }

  private toEvent(draft: OutboxEventDraft): OutboxEvent {
    return Object.freeze({
      id: this.dependencies.newEventId(),
      name: draft.name,
      occurredAt: this.dependencies.now().toISOString(),
      tenantId: draft.tenantId,
      aggregateId: draft.aggregateId,
      aggregateType: draft.aggregateType,
      version: draft.version ?? OUTBOX_EVENT_VERSIONS[draft.name],
      payload: Object.freeze({ ...draft.payload }),
    });
  }
}

/** Traduit un evenement interne en enveloppe contractuelle livrable. */
export function toEventEnvelope(event: OutboxEvent): EventEnvelopeDto {
  return eventEnvelopeSchema.parse({
    event_id: event.id,
    event_name: event.name,
    event_version: event.version,
    occurred_at: event.occurredAt,
    tenant_id: event.tenantId,
    aggregate_type: event.aggregateType,
    aggregate_id: event.aggregateId,
    payload: event.payload,
  });
}

/**
 * Serialise l enveloppe sous la forme EXACTE qui sera signee et transmise.
 * Signer autre chose que les octets envoyes rend la verification impossible.
 */
export function serializeEventEnvelope(envelope: EventEnvelopeDto): string {
  return JSON.stringify(envelope);
}

/** Signature HMAC-SHA256 du corps brut, au format `sha256=<hex>`. */
export async function signEventBody(secret: string, body: string): Promise<string> {
  if (secret.length === 0) throw new TypeError('Le secret de signature ne peut pas etre vide.');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return `sha256=${toHex(signature)}`;
}

/** Verifie une signature en temps constant. */
export async function verifyEventSignature(
  secret: string,
  body: string,
  candidate: string,
): Promise<boolean> {
  const expected = await signEventBody(secret, body);
  return timingSafeEqual(expected, candidate);
}

/** En-tetes de livraison d un evenement signe. */
export async function buildDeliveryHeaders(
  secret: string,
  envelope: EventEnvelopeDto,
): Promise<Readonly<{ body: string; headers: Readonly<Record<string, string>> }>> {
  const body = serializeEventEnvelope(envelope);
  const signature = await signEventBody(secret, body);
  return Object.freeze({
    body,
    headers: Object.freeze({
      'Content-Type': 'application/json; charset=utf-8',
      [EVENT_SIGNATURE_HEADER]: signature,
      [EVENT_NAME_HEADER]: envelope.event_name,
    }),
  });
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
