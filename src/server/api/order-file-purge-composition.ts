/**
 * Points de composition du mecanisme de purge des fichiers de commande
 * (E10.22a/E10.22a-bis/E10.22b/E10.22c, docs/api/CONVENTIONS.md §8.22). Meme
 * contre-mesure que `createOutboxDispatchApplication()` pour la dette M1
 * (§8.2) : les Edge Functions (`magrit-order-file-purge`, ETENDUE par E10.22b/
 * E10.22c, PAS une nouvelle fonction, ET `magrit-outbox-dispatcher`,
 * EXISTANTE) ne font qu instancier des adaptateurs -- toute la composition,
 * typecheckee et testable, vit ici.
 *
 * DEUX exports, pour DEUX consommateurs distincts (§3 du contrat) :
 *  - `createOrderFilePurgeSweepApplication()` -- le balayage quotidien
 *    (SECOND `pg_cron`, dedie), consomme par `magrit-order-file-purge`.
 *    N ENVOIE AUCUN COURRIEL. Porte desormais CINQ etapes (E10.22a/a-bis :
 *    rappels + preuve de livraison ; E10.22b : purge REELLE des fichiers
 *    dont les deux rappels sont confirmes delivres ; E10.22c : objets
 *    orphelins, dette D7) -- voir `PurgeSweepService`.
 *  - `createOrderFilePurgeNoticeConsumer()` -- le consommateur outbox
 *    `order_files.purge_scheduled`, a BRANCHER dans le registre du drain
 *    EXISTANT (`outbox-dispatch-composition.ts`), PAS dans une Edge
 *    Function separee : c est lui qui envoie reellement le courriel, via le
 *    relais deja fiable (reprise, backoff) d E10.10b-3. INCHANGE par E10.22b/
 *    E10.22c : `order_files.purged` n a AUCUN consommateur (§9 du contrat --
 *    seule trace versionnee, personne ne l ecoute aujourd hui).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SupabaseOrderFilePurgeExecutionRepository,
  SupabaseOrderFilePurgeNoticeGateway,
  SupabaseOrderFilePurgeSweepRepository,
  SupabaseOrphanObjectRepository,
} from '../../adapters/supabase/order-file-purge-repository.ts';
import { ResendOrderFilePurgeNoticeEmailSender } from '../../adapters/resend/order-file-purge-notice-email-sender.ts';
import { ResendEmailDeliveryStatusGateway } from '../../adapters/resend/resend-email-delivery-status-gateway.ts';
import { PurgeNoticeNotificationConsumer } from '../../modules/order-files/application/purge-notice-notification-consumer.ts';
import {
  DEFAULT_PURGE_SWEEP_SETTINGS,
  PurgeSweepService,
  type PurgeSweepReport,
  type PurgeSweepSettings,
} from '../../modules/order-files/application/purge-sweep-service.ts';

export type OrderFilePurgeSweepDependencies = Readonly<{
  /** Client `service_role` -- seul role habilite sur les six fonctions du mecanisme. */
  serviceRoleClient: SupabaseClient<any>;
  /** `null` -> la relecture de statut rend systematiquement `null` (toujours pendante), pas de repli silencieux. */
  resendApiKey: string | null;
  fetchImplementation?: typeof fetch;
  settings?: PurgeSweepSettings;
}>;

export function createOrderFilePurgeSweepApplication(
  dependencies: OrderFilePurgeSweepDependencies,
): Readonly<{ runOnce: () => Promise<PurgeSweepReport> }> {
  const repository = new SupabaseOrderFilePurgeSweepRepository(dependencies.serviceRoleClient);
  const deliveryStatus = new ResendEmailDeliveryStatusGateway(
    dependencies.resendApiKey,
    dependencies.fetchImplementation ?? globalThis.fetch,
  );
  // E10.22b/E10.22c -- MEME client service_role (RPC + storage), aucune
  // dependance neuve a cabler : les deux volets ajoutes par ce lot.
  const execution = new SupabaseOrderFilePurgeExecutionRepository(dependencies.serviceRoleClient);
  const orphans = new SupabaseOrphanObjectRepository(dependencies.serviceRoleClient);

  const service = new PurgeSweepService({
    repository,
    deliveryStatus,
    execution,
    orphans,
    settings: dependencies.settings ?? DEFAULT_PURGE_SWEEP_SETTINGS,
  });

  return Object.freeze({ runOnce: () => service.runOnce() });
}

export type OrderFilePurgeNoticeConsumerDependencies = Readonly<{
  serviceRoleClient: SupabaseClient<any>;
  resendApiKey: string | null;
  fromEmail: string;
  /** `MAGRIT_PUBLIC_APP_URL`. `null` -> le consommateur echoue explicitement (pas de lien devine) — qa-review round 1 B2. */
  publicAppUrl: string | null;
  fetchImplementation?: typeof fetch;
}>;

/** A brancher sous la cle `order_files.purge_scheduled` du registre de `createOutboxDispatchApplication()`. */
export function createOrderFilePurgeNoticeConsumer(
  dependencies: OrderFilePurgeNoticeConsumerDependencies,
): PurgeNoticeNotificationConsumer {
  const gateway = new SupabaseOrderFilePurgeNoticeGateway(dependencies.serviceRoleClient);
  const emailSender = new ResendOrderFilePurgeNoticeEmailSender(
    dependencies.resendApiKey,
    dependencies.fromEmail,
    dependencies.fetchImplementation ?? globalThis.fetch,
  );

  return new PurgeNoticeNotificationConsumer({
    recipients: gateway,
    deliveries: gateway,
    emailSender,
    publicAppUrl: dependencies.publicAppUrl,
  });
}
