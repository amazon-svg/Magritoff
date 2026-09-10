/**
 * Implementation Supabase du referentiel des liens publics de depot
 * (story E10.20a).
 *
 * DEUX clients distincts, jamais confondus — meme discipline qu
 * `SupabaseApiPrincipalVerifier`/`order-files-repository.ts` :
 *  - `client` — porte le JWT Magrit de l appelant (`Authorization` transmise
 *    par la facade). Les TROIS operations d atelier (`create`/`listByOrder`/
 *    `revoke`) l utilisent : leurs fonctions `security definer` lisent
 *    `auth.uid()` pour verifier l appartenance au tenant et signer l audit
 *    (`created_by`/`revoked_by`), exactement comme `api_confirm_order_file_
 *    upload` (E10.17a).
 *  - `anonClient` — SANS AUCUN JWT Magrit, meme raisonnement que
 *    `storefrontClient` (E10.10b-1) : le porteur d un lien de depot n a PAR
 *    CONSTRUCTION aucune credential Magrit, `getContext` doit donc rester
 *    joignable sans JWT. Utiliser `client` ici ferait dependre la
 *    resolution du lien d un JWT que l appelant legitime n a jamais — et
 *    ferait fuiter, le cas echeant, le JWT d un membre qui ouvrirait le lien
 *    de son propre client dans le meme navigateur (§3.6 branche 4 : le
 *    cumul est refuse en AMONT par le middleware, mais ce repository ne doit
 *    de toute facon jamais avoir besoin de ce jeton pour resoudre un lien).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp, toIsoTimestampOrNull } from '../../modules/_shared/application/index.ts';
import type {
  CreateOrderUploadLinkCommand,
  OrderUploadLinkContextDto,
  OrderUploadLinkCreatedDto,
  OrderUploadLinkDto,
} from '../../modules/order-upload-links/api/contracts.ts';
import {
  OrderNotFoundError,
  OrderUploadLinkLimitReachedError,
  OrderUploadLinkNotFoundError,
  type ListOrderUploadLinksResult,
  type OrderUploadLinksRepository,
} from '../../modules/order-upload-links/application/order-upload-links-repository.ts';
// REUTILISES tels quels (pas de seconde constante) : le plafond de poids et
// la liste de types acceptes de ce lot sont IDENTIQUES a E10.17a — meme
// bucket de stockage, meme arbitrage (A) du 2026-09-10 ("on ne bouge pas").
import { ACCEPTED_CONTENT_TYPES, MAX_UPLOAD_BYTE_SIZE } from './order-files-repository.ts';

// `token_hash`/`revoked_by`/`revoked_by_label` sont DELIBEREMENT absents de
// cette selection : le jeton n est jamais relu (une seule fois, a la
// creation), et un lien revoque ne fait plus partie des lectures "vivantes"
// de ce module — meme discipline que `storage_path` sur order-files.
const LINK_COLUMNS =
  'id, order_id, label, expires_at, max_files, deposited_count, use_count, first_used_at, last_used_at, created_at, created_by, created_by_label, revoked_at';

export class SupabaseOrderUploadLinksRepository implements OrderUploadLinksRepository {
  constructor(
    private readonly client: SupabaseClient<any>,
    private readonly anonClient: SupabaseClient<any>,
  ) {}

  async create(
    tenantId: TenantId,
    orderId: string,
    actor: UserId,
    command: CreateOrderUploadLinkCommand,
  ): Promise<OrderUploadLinkCreatedDto> {
    void actor; // trace : la fonction SQL lit auth.uid() de la session, pas ce parametre.
    const { data, error } = await this.client.rpc('api_create_order_upload_link', {
      p_tenant_id: tenantId,
      p_order_id: orderId,
      p_label: command.label ?? null,
      p_expires_in_days: command.expires_in_days,
      p_max_files: command.max_files,
    });
    if (error) throw mapOrderUploadLinkError(error);
    const row = Array.isArray(data) ? data[0] : data;
    return toCreatedDto(row);
  }

  async listByOrder(tenantId: TenantId, orderId: string): Promise<ListOrderUploadLinksResult | null> {
    const orderExists = await this.orderExists(tenantId, orderId);
    if (!orderExists) return null;

    const { data, error } = await this.client
      .from('commercial_order_upload_links')
      .select(LINK_COLUMNS)
      .eq('order_id', orderId)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toLinkDto);
  }

  async revoke(tenantId: TenantId, orderId: string, linkId: string, actor: UserId): Promise<void> {
    void actor; // trace : la fonction SQL lit auth.uid() de la session, pas ce parametre.
    const { error } = await this.client.rpc('api_revoke_order_upload_link', {
      p_tenant_id: tenantId,
      p_order_id: orderId,
      p_link_id: linkId,
    });
    if (error) throw mapOrderUploadLinkError(error);
  }

  async getContext(token: string): Promise<OrderUploadLinkContextDto | null> {
    const { data, error } = await this.anonClient.rpc('api_get_order_upload_link_context', {
      p_token: token,
    });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;

    return {
      printer_name: row.printer_name,
      order_number: row.order_number,
      label: row.label ?? null,
      expires_at: toIsoTimestamp(row.expires_at),
      max_files: Number(row.max_files),
      deposited_count: Number(row.deposited_count),
      // Constantes APPLICATIVES, jamais lues de la fonction SQL : le bucket
      // et sa limite sont un fait de STOCKAGE, pas une donnee de ce lien —
      // meme raisonnement qu `issueOrderFileUploadUrl` (E10.17a).
      max_byte_size: MAX_UPLOAD_BYTE_SIZE,
      accepted_content_types: [...ACCEPTED_CONTENT_TYPES],
    };
  }

  private async orderExists(tenantId: TenantId, orderId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('commercial_orders')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data !== null;
  }
}

function toLinkDto(row: Record<string, any>): OrderUploadLinkDto {
  return {
    id: row.id,
    order_id: row.order_id,
    label: row.label ?? null,
    expires_at: toIsoTimestamp(row.expires_at),
    max_files: Number(row.max_files),
    deposited_count: Number(row.deposited_count),
    use_count: Number(row.use_count),
    first_used_at: toIsoTimestampOrNull(row.first_used_at),
    last_used_at: toIsoTimestampOrNull(row.last_used_at),
    created_at: toIsoTimestamp(row.created_at),
    created_by: row.created_by ?? null,
    created_by_label: row.created_by_label ?? null,
  };
}

function toCreatedDto(row: Record<string, any>): OrderUploadLinkCreatedDto {
  return { ...toLinkDto(row), token: row.token };
}

/**
 * Traduit une erreur Postgres (message d exception `raise exception 'code: detail'`
 * d une fonction `api_*`) en erreur de domaine. Meme discipline que
 * `mapOrderFileError` (E10.17a).
 */
function mapOrderUploadLinkError(error: { code?: string; message: string }): Error {
  const message = error.message ?? '';

  if (message.includes('order.not_found')) {
    return new OrderNotFoundError(message);
  }
  if (message.includes('upload_link.limit_reached')) {
    return new OrderUploadLinkLimitReachedError(message);
  }
  if (message.includes('upload_link.not_found')) {
    return new OrderUploadLinkNotFoundError(message);
  }
  if (message.includes('permission_denied')) {
    return new Error(`permission_denied: ${message}`);
  }
  return new Error(message || 'Operation impossible sur le referentiel des liens de depot.');
}
