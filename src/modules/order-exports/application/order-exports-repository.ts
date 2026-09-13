/**
 * Port du repository Exports de commandes (story E10.18c).
 *
 * L implementation Supabase (`src/adapters/supabase/order-exports-repository.ts`)
 * distingue DEUX clients — meme discipline que `SupabaseOrderDocumentsRepository`
 * (E10.19b) : le client `authenticated` (jeton de l acteur, RLS active, seul
 * habilite a appeler `api_request_order_export` qui resout `auth.uid()`) et
 * le client `service_role` (bucket prive `order_exports`, jamais atteint par
 * `authenticated` — aucune policy `storage.objects`).
 */
import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type {
  OrderExportDto,
  OrderExportFiltersDto,
  OrderExportFormat,
  OrderExportGranularity,
  OrderExportStatus,
} from '../api/contracts.ts';

/** L acteur n a pas le droit metier `can_export_orders` requis (403 `identity.role_required`). */
export class OrderExportAccessDeniedError extends Error {
  constructor(message = 'Droit can_export_orders requis.') {
    super(message);
    this.name = 'OrderExportAccessDeniedError';
  }
}

/** Aucune demande de cet identifiant dans le tenant du jeton (404 `order_export.not_found`). */
export class OrderExportNotFoundError extends Error {
  constructor(message = 'Export de commandes introuvable dans ce tenant.') {
    super(message);
    this.name = 'OrderExportNotFoundError';
  }
}

/** L acteur porte deja trois demandes non terminees (422 `order_export.pending_limit_reached`). */
export class OrderExportPendingLimitReachedError extends Error {
  constructor(message = 'Trois demandes non terminees sont deja en file pour cet acteur.') {
    super(message);
    this.name = 'OrderExportPendingLimitReachedError';
  }
}

export type ListOrderExportsFilters = Readonly<{
  status: OrderExportStatus | null;
  format: OrderExportFormat | null;
  granularity: OrderExportGranularity | null;
  /** `size + 1` lignes attendues, pour que `buildPage` detecte une page suivante. */
  size: number;
  /** Position de curseur DEJA decodee (`sort` = `requested_at` ISO, `id` = uuid), ou `null` en premiere page. */
  cursor: Readonly<{ sort: string; id: string }> | null;
}>;

export type RequestOrderExportParams = Readonly<{
  format: OrderExportFormat;
  granularity: OrderExportGranularity;
  filters: OrderExportFiltersDto;
}>;

export interface OrderExportsRepository {
  /** Verifie le droit metier `can_export_orders` (`user_has_capability`, RPC). */
  actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean>;

  /**
   * Registre TENANT-LARGE (contrat : « tout porteur de can_export_orders voit
   * les demandes de TOUS les membres »), du plus recent au plus ancien.
   * `download_url` n est resolu (signature Storage) QUE sur les entrees
   * `ready` DEMANDEES PAR `actor` — `null` partout ailleurs.
   */
  list(
    tenantId: TenantId,
    actor: UserId,
    filters: ListOrderExportsFilters,
  ): Promise<readonly OrderExportDto[]>;

  /** `POST /commercial-order-exports` — cree la demande, `pending`. */
  request(tenantId: TenantId, actor: UserId, params: RequestOrderExportParams): Promise<OrderExportDto>;

  /**
   * `GET /commercial-order-exports/{exportId}`. `null` si la ligne n existe
   * pas dans ce tenant (404, jamais un autre code — meme reponse pour une
   * demande inexistante et pour celle d un autre espace). `download_url`
   * resolu SEULEMENT si `actor` est le demandeur ET que le statut est `ready`.
   */
  findById(tenantId: TenantId, actor: UserId, exportId: string): Promise<OrderExportDto | null>;
}
