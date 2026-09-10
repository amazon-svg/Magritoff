/**
 * Implementation Supabase du mecanisme de purge des fichiers de commande
 * (E10.22a/E10.22a-bis, docs/api/CONVENTIONS.md §8.22). Client `service_role`
 * EXIGE partout : chaque fonction SQL appelee est `security definer`,
 * `grant execute` au SEUL `service_role` (migration `20260910000500`) --
 * meme discipline que `SupabaseOutboxDispatchRepository` (E10.10b-3).
 *
 * DEUX classes, DEUX responsabilites (meme separation que le port) :
 *  - `SupabaseOrderFilePurgeSweepRepository` -- le balayage quotidien
 *    (`PurgeSweepRepository`), consomme par `magrit-order-file-purge`.
 *  - `SupabaseOrderFilePurgeNoticeGateway` -- resolution des destinataires
 *    A LA REMISE et consignation des tentatives d envoi
 *    (`PurgeNoticeRecipientGateway` + `PurgeNoticeDeliveryGateway`),
 *    consomme par le consommateur outbox (drain EXISTANT, minute par
 *    minute).
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
