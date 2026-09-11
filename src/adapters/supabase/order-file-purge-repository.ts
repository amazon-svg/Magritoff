/**
 * Implementation Supabase du mecanisme de purge des fichiers de commande
 * (E10.22a/E10.22a-bis/E10.22b/E10.22c, docs/api/CONVENTIONS.md §8.22).
 * Client `service_role` EXIGE partout : chaque fonction SQL appelee est
 * `security definer`, `grant execute` au SEUL `service_role` (migrations
 * `20260910000500` et `20260910000600`) -- meme discipline que
 * `SupabaseOutboxDispatchRepository` (E10.10b-3).
 *
 * QUATRE classes, QUATRE responsabilites (meme separation que les ports) :
 *  - `SupabaseOrderFilePurgeSweepRepository` -- le balayage des rappels
 *    (`PurgeSweepRepository`), consomme par `magrit-order-file-purge`.
 *  - `SupabaseOrderFilePurgeNoticeGateway` -- resolution des destinataires
 *    A LA REMISE et consignation des tentatives d envoi
 *    (`PurgeNoticeRecipientGateway` + `PurgeNoticeDeliveryGateway`),
 *    consomme par le consommateur outbox (drain EXISTANT, minute par
 *    minute).
 *  - `SupabaseOrderFilePurgeExecutionRepository` (E10.22b) -- purge REELLE :
 *    reclame/marque les fichiers dont la garde des deux rappels confirmes
 *    est remplie, retire les objets par lot, emet `order_files.purged`.
 *  - `SupabaseOrphanObjectRepository` (E10.22c) -- objets orphelins, dette
 *    D7 : liste et retire par lot, AUCUNE ligne a marquer.
 *
 * `BUCKET`/`storagePathFor` REUTILISES depuis `order-files-repository.ts`
 * (E10.17a) -- meme bucket, meme forme de chemin, jamais une seconde source
 * qui pourrait diverger.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantId } from '../../kernel/ids/index.ts';
import type {
  PurgeNoticeDeliveryGateway,
  PurgeNoticeDeliveryOutcome,
  PurgeNoticeDeliveryRecord,
  PurgeNoticeRecipient,
  PurgeNoticeRecipientGateway,
} from '../../modules/order-files/application/purge-notice-gateway.ts';
import type {
  ClaimedPurgeNoticeStage,
  ClaimedPurgeNoticeSummary,
  DeliveryPendingCheck,
  ExpiredPurgeNoticeSummary,
  PurgeSweepRepository,
} from '../../modules/order-files/application/purge-sweep-repository.ts';
import type {
  BlockedPurgeCount,
  BlockedPurgeReason,
  PurgeExecutionRepository,
  PurgeExecutionSummary,
} from '../../modules/order-files/application/purge-execution-repository.ts';
import type { OrphanObjectRepository } from '../../modules/order-files/application/orphan-object-repository.ts';
import { BUCKET, storagePathFor } from './order-files-repository.ts';

export class SupabaseOrderFilePurgeSweepRepository implements PurgeSweepRepository {
  /** @param client Client `service_role` -- seul role habilite sur les six fonctions de ce mecanisme. */
  constructor(private readonly client: SupabaseClient<any>) {}

  async claimNotices(stage: ClaimedPurgeNoticeStage, leadDays: number): Promise<readonly ClaimedPurgeNoticeSummary[]> {
    const { data, error } = await this.client.rpc('api_claim_order_file_purge_notices', {
      p_stage: stage,
      p_lead_days: leadDays,
    });
    if (error) throw new Error(`Reclamation des rappels de purge (${stage}) impossible: ${error.message}`);
    const rows = (data ?? []) as readonly Readonly<{
      claimed_notice_id: string;
      claimed_tenant_id: string;
      claimed_file_count: number;
      claimed_order_count: number;
    }>[];
    return rows.map((row) => ({
      noticeId: row.claimed_notice_id,
      tenantId: row.claimed_tenant_id,
      fileCount: row.claimed_file_count,
      orderCount: row.claimed_order_count,
    }));
  }

  async expireStaleNotices(window: Readonly<{ days: number }>): Promise<readonly ExpiredPurgeNoticeSummary[]> {
    const { data, error } = await this.client.rpc('api_expire_order_file_purge_notices', {
      p_window: `${window.days} days`,
    });
    if (error) throw new Error(`Expiration des rappels de purge impossible: ${error.message}`);
    const rows = (data ?? []) as readonly Readonly<{ id: string; tenant_id: string; stage: string }>[];
    return rows.map((row) => ({
      noticeId: row.id,
      tenantId: row.tenant_id,
      stage: row.stage as ClaimedPurgeNoticeStage,
    }));
  }

  async claimDeliveriesForRecheck(limit: number): Promise<readonly DeliveryPendingCheck[]> {
    const { data, error } = await this.client.rpc('api_claim_order_file_purge_notice_deliveries_for_check', {
      p_limit: limit,
    });
    if (error) throw new Error(`Reclamation des livraisons a relire impossible: ${error.message}`);
    const rows = (data ?? []) as readonly Readonly<{
      delivery_id: string;
      notice_id: string;
      provider_message_id: string;
    }>[];
    return rows.map((row) => ({
      deliveryId: row.delivery_id,
      noticeId: row.notice_id,
      providerMessageId: row.provider_message_id,
    }));
  }

  async recordDeliveryCheck(deliveryId: string, lastStatus: string): Promise<void> {
    const { error } = await this.client.rpc('api_record_order_file_purge_notice_delivery_check', {
      p_delivery_id: deliveryId,
      p_last_status: lastStatus,
    });
    if (error) throw new Error(`Consignation du statut de livraison ${deliveryId} impossible: ${error.message}`);
  }

  /** E10.22d — voir le port. */
  async resetStaleNotices(): Promise<number> {
    const { data, error } = await this.client.rpc('api_reset_stale_order_file_purge_notices');
    if (error) throw new Error(`Remise a zero des rappels perimes impossible: ${error.message}`);
    return Number(data ?? 0);
  }
}

export class SupabaseOrderFilePurgeNoticeGateway
  implements PurgeNoticeRecipientGateway, PurgeNoticeDeliveryGateway
{
  /** @param client Client `service_role`. */
  constructor(private readonly client: SupabaseClient<any>) {}

  async resolveRecipients(tenantId: TenantId): Promise<readonly PurgeNoticeRecipient[]> {
    const { data, error } = await this.client.rpc('api_resolve_order_file_purge_recipients', {
      p_tenant_id: tenantId,
    });
    if (error) throw new Error(`Resolution des destinataires de purge impossible: ${error.message}`);
    const rows = (data ?? []) as readonly Readonly<{ recipient_user_id: string | null; recipient_email: string }>[];
    return rows.map((row) => ({ userId: row.recipient_user_id, email: row.recipient_email }));
  }

  /**
   * qa-review round 1 (B2) : le slug est necessaire pour composer le lien
   * workspace vers les fiches commande (`/t/<slug>/dashboard/commercial-
   * orders/<orderId>`), le consommateur n en connait que le `tenantId`
   * (UUID). Lecture directe de `public.tenants` -- table PostgREST standard,
   * RLS bypassee par `service_role` comme partout ailleurs dans cet
   * adaptateur.
   */
  async getTenantSlug(tenantId: TenantId): Promise<string | null> {
    const { data, error } = await this.client.from('tenants').select('slug').eq('id', tenantId).maybeSingle();
    if (error) throw new Error(`Resolution du slug du tenant ${tenantId} impossible: ${error.message}`);
    return (data as Readonly<{ slug: string }> | null)?.slug ?? null;
  }

  async recordDeliveryAttempt(
    noticeId: string,
    recipient: PurgeNoticeRecipient,
    outcome: PurgeNoticeDeliveryOutcome,
  ): Promise<PurgeNoticeDeliveryRecord> {
    const { data, error } = await this.client.rpc('api_record_order_file_purge_notice_delivery_attempt', {
      p_notice_id: noticeId,
      p_recipient_user_id: recipient.userId,
      p_recipient_email: recipient.email,
      p_provider_message_id: outcome.providerMessageId,
    });
    if (error) {
      throw new Error(`Consignation de la tentative d envoi (${recipient.email}) impossible: ${error.message}`);
    }
    const row = data as Readonly<{ id: string; accepted_at: string | null }>;
    return { id: row.id, accepted: row.accepted_at !== null };
  }
}

/**
 * E10.22b — purge REELLE. `client` = `service_role` (RPC des fonctions
 * `security definer` de la migration `20260910000600` ET acces au bucket
 * prive `commercial_order_files`, AUCUNE policy `storage.objects`, contrat
 * §8.19 §3 -- meme client pour les deux, ce mecanisme tourne ENTIEREMENT
 * sous `service_role` (Edge Function `magrit-order-file-purge`), pas de
 * distinction caller-JWT / service_role a faire ici, CONTRAIREMENT a
 * `SupabaseOrderFilesRepository` (E10.17a) qui sert des requetes HTTP
 * authentifiees.
 */
export class SupabaseOrderFilePurgeExecutionRepository implements PurgeExecutionRepository {
  constructor(private readonly client: SupabaseClient<any>) {}

  async purgeEligibleFiles(limit: number): Promise<readonly PurgeExecutionSummary[]> {
    const { data, error } = await this.client.rpc('api_claim_order_files_for_purge', { p_limit: limit });
    if (error) throw new Error(`Reclamation des fichiers a purger impossible: ${error.message}`);
    const rows = (data ?? []) as readonly Readonly<{
      purged_file_id: string;
      purged_order_id: string;
      purged_tenant_id: string;
      purged_byte_size: number | string;
    }>[];
    if (rows.length === 0) return [];

    // Ordre PRESCRIT par E10.17a, non renegociable : la LIGNE est DEJA
    // marquee (fonction SQL ci-dessus, transactionnelle) -- l objet de
    // stockage est retire ENSUITE, PAR LOT, best-effort (§5 du contrat :
    // point de non-retour deja franchi, un echec ici ne doit JAMAIS
    // empecher la suite ni remonter d erreur a l appelant -- rattrape par
    // E10.22c au tour suivant si necessaire).
    const paths = rows.map((row) =>
      storagePathFor(row.purged_tenant_id as TenantId, row.purged_order_id, row.purged_file_id),
    );
    const { error: removeError } = await this.client.storage.from(BUCKET).remove(paths);
    if (removeError) {
      console.error('[order-file-purge] retrait par lot des objets purges echoue', removeError);
    }

    // UN evenement order_files.purged PAR ESPACE (§5/§9 du contrat), APRES
    // le retrait des objets -- jamais avant. Regroupement PAR TENANT, borne
    // a 50 order_ids par evenement (meme regle que order_files.purge_scheduled).
    const byTenant = new Map<string, { orderIds: Set<string>; byteSizeFreed: number; fileCount: number }>();
    for (const row of rows) {
      const entry = byTenant.get(row.purged_tenant_id) ?? {
        orderIds: new Set<string>(),
        byteSizeFreed: 0,
        fileCount: 0,
      };
      entry.orderIds.add(row.purged_order_id);
      entry.byteSizeFreed += Number(row.purged_byte_size);
      entry.fileCount += 1;
      byTenant.set(row.purged_tenant_id, entry);
    }

    const summaries: PurgeExecutionSummary[] = [];
    for (const [tenantId, entry] of byTenant) {
      const orderIds = [...entry.orderIds].slice(0, 50);
      const { error: recordError } = await this.client.rpc('api_record_order_files_purged', {
        p_tenant_id: tenantId,
        p_file_count: entry.fileCount,
        p_order_count: entry.orderIds.size,
        p_byte_size_freed: entry.byteSizeFreed,
        p_order_ids: orderIds,
      });
      if (recordError) {
        // N2 (qa-review round 1) : NE JAMAIS avorter tout le tour. Les
        // fichiers de CE tenant sont DEJA purges (ligne + objets, point de
        // non-retour deja franchi) -- seul l evenement de trace echoue a
        // s ecrire pour CET espace. Journalise, le tour continue pour les
        // tenants suivants ET pour l etape suivante du balayage (E10.22c,
        // orphelins) : un throw ici privait ces deux choses d avoir lieu.
        console.error(
          `[order-file-purge] consignation de order_files.purged (${tenantId}) echouee -- fichiers deja purges, evenement manquant`,
          recordError,
        );
        continue;
      }
      summaries.push({
        tenantId,
        fileCount: entry.fileCount,
        orderCount: entry.orderIds.size,
        byteSizeFreed: entry.byteSizeFreed,
        orderIds,
      });
    }
    return summaries;
  }

  /** B1 (qa-review round 1, BLOQUANT) : voir le port. */
  async countBlockedFiles(): Promise<readonly BlockedPurgeCount[]> {
    const { data, error } = await this.client.rpc('api_count_blocked_order_file_purges');
    if (error) throw new Error(`Comptage des blocages de purge impossible: ${error.message}`);
    const rows = (data ?? []) as readonly Readonly<{
      blocked_tenant_id: string;
      blocked_reason: string;
      blocked_count: number;
    }>[];
    return rows.map((row) => ({
      tenantId: row.blocked_tenant_id,
      reason: row.blocked_reason as BlockedPurgeReason,
      count: row.blocked_count,
    }));
  }
}

/**
 * E10.22c — objets orphelins, dette D7. Meme discipline de client unique
 * `service_role` que `SupabaseOrderFilePurgeExecutionRepository` ci-dessus.
 * AUCUNE ligne n est marquee ici : soit l objet n a jamais eu de ligne
 * (jamais confirme), soit sa ligne est deja marquee `deleted_at` (M2
 * qa-review round 1 : purge AUTOMATIQUE **ou** suppression MANUELLE dont le
 * retrait storage a echoue).
 */
export class SupabaseOrphanObjectRepository implements OrphanObjectRepository {
  constructor(private readonly client: SupabaseClient<any>) {}

  async removeOrphanObjects(olderThanHours: number, limit: number): Promise<number> {
    const { data, error } = await this.client.rpc('api_claim_orphan_order_file_objects', {
      p_older_than: `${olderThanHours} hours`,
      p_limit: limit,
    });
    if (error) throw new Error(`Reclamation des objets orphelins impossible: ${error.message}`);
    const rows = (data ?? []) as readonly Readonly<{ orphan_object_id: string; orphan_object_path: string }>[];
    if (rows.length === 0) return 0;

    // N1 (qa-review round 1) : le compte rendu DERIVE du resultat REEL de
    // `remove()`, jamais de `rows.length` -- un echec de retrait ne doit
    // JAMAIS etre annonce comme un succes dans le rapport du tour.
    const { data: removed, error: removeError } = await this.client.storage
      .from(BUCKET)
      .remove(rows.map((row) => row.orphan_object_path));
    if (removeError) {
      console.error('[order-file-purge] retrait par lot des objets orphelins echoue', removeError);
      return 0;
    }
    return removed?.length ?? 0;
  }
}
