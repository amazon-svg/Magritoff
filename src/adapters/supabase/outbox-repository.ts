/**
 * Implementation Supabase du port `OutboxRepository` du socle E10.0.
 *
 * Ecrit dans `public.outbox_events` (migration 20260901000100).
 *
 * ------------------------------------------------------------------------
 * POURQUOI UN CLIENT SERVICE_ROLE
 * ------------------------------------------------------------------------
 * La table est fermee aux roles client : `revoke all ... from public, anon,
 * authenticated`, grants au seul `service_role`. C est voulu — l ecriture d un
 * evenement n est jamais le fait d un client, c est celle du service qui
 * commet la transaction metier. Le client `authenticated` de l edge function
 * ne peut donc pas y ecrire, et ne le doit pas.
 *
 * ------------------------------------------------------------------------
 * LIMITE ASSUMEE : L ECRITURE N EST PAS TRANSACTIONNELLE
 * ------------------------------------------------------------------------
 * Le pattern outbox suppose que l evenement soit ecrit DANS LA MEME
 * TRANSACTION que la modification metier. Ici les deux passent par PostgREST,
 * en deux appels HTTP distincts : l atomicite n existe pas. Un evenement peut
 * donc se perdre si l ecriture metier reussit et celle-ci echoue.
 *
 * Ce n est pas un oubli mais une limite de la facon dont les modules E10
 * ecrivent aujourd hui (acces table direct sous RLS, pas de fonction
 * `security definer`). La mise en conformite est tracee en dette dans
 * docs/api/CONVENTIONS.md §8.1 : deplacer l ecriture metier ET l ajout a
 * l outbox dans une meme fonction `api_*` `security definer`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { OutboxEvent, OutboxRepository } from '../../modules/_shared/application/index.ts';

export class SupabaseOutboxRepository implements OutboxRepository {
  /**
   * @param client Client `service_role` — seul role habilite sur la table.
   */
  constructor(private readonly client: SupabaseClient<any>) {}

  async append(events: readonly OutboxEvent[]): Promise<void> {
    if (events.length === 0) return;

    const rows = events.map((event) => ({
      id: event.id,
      tenant_id: event.tenantId,
      event_name: event.name,
      event_version: event.version,
      aggregate_type: event.aggregateType,
      aggregate_id: event.aggregateId,
      payload: event.payload,
      occurred_at: event.occurredAt,
    }));

    const { error } = await this.client.from('outbox_events').insert(rows);
    if (error) {
      throw new Error(`Ecriture des evenements sortants impossible: ${error.message}`);
    }
  }
}

/**
 * Enveloppe un depot d evenements pour qu un echec de publication ne fasse pas
 * echouer la requete metier.
 *
 * Le choix est explicite et volontairement visible ici plutot que cache dans
 * l adaptateur : la modification metier est DEJA commise quand l outbox est
 * appelee. Rendre une erreur a ce moment dirait au client que son operation a
 * echoue alors qu elle a reussi — il rejouerait, et creerait un doublon.
 *
 * On prefere donc perdre l evenement, bruyamment, plutot que mentir sur l issue
 * de l operation. C est la contrepartie directe de l absence d atomicite
 * decrite plus haut : elle disparaitra avec elle.
 */
export function bestEffortOutbox(
  repository: OutboxRepository,
  onFailure: (error: unknown, events: readonly OutboxEvent[]) => void,
): OutboxRepository {
  return {
    async append(events) {
      try {
        await repository.append(events);
      } catch (error) {
        onFailure(error, events);
      }
    },
  };
}
