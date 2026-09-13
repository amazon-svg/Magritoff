/**
 * Service applicatif du module Exports de commandes (story E10.18c).
 *
 * Orchestration pure : aucune dependance a Supabase ni au HTTP. Les trois
 * operations sont GARDEES par `can_export_orders`, LECTURE COMPRISE — ecart
 * avec les autres modules E10 (dont la lecture est toujours ouverte),
 * explicite au contrat (`x-required-capabilities` sur les trois operations) :
 * un registre d exports dit qui a sorti le chiffre d affaires, et la lecture
 * par identifiant sert directement le fichier.
 */
import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type { OrderExportDto } from '../api/contracts.ts';
import {
  OrderExportAccessDeniedError,
  OrderExportNotFoundError,
  type ListOrderExportsFilters,
  type OrderExportsRepository,
  type RequestOrderExportParams,
} from './order-exports-repository.ts';

/** Droit metier exige sur les TROIS operations (contrat §8.24 point 6). */
const CAN_EXPORT_ORDERS = 'can_export_orders';

export type OrderExportsServiceDependencies = Readonly<{
  repository: OrderExportsRepository;
}>;

export class OrderExportsService {
  private readonly repository: OrderExportsRepository;

  constructor(dependencies: OrderExportsServiceDependencies) {
    this.repository = dependencies.repository;
  }

  async list(
    tenantId: TenantId,
    actor: UserId,
    filters: ListOrderExportsFilters,
  ): Promise<readonly OrderExportDto[]> {
    await this.assertCanExportOrders(tenantId, actor);
    return this.repository.list(tenantId, actor, filters);
  }

  async request(
    tenantId: TenantId,
    actor: UserId,
    params: RequestOrderExportParams,
  ): Promise<OrderExportDto> {
    await this.assertCanExportOrders(tenantId, actor);
    return this.repository.request(tenantId, actor, params);
  }

  async getById(tenantId: TenantId, actor: UserId, exportId: string): Promise<OrderExportDto> {
    await this.assertCanExportOrders(tenantId, actor);
    const found = await this.repository.findById(tenantId, actor, exportId);
    if (!found) throw new OrderExportNotFoundError();
    return found;
  }

  /**
   * Garde GARDEE PAR CAPABILITY, verifiee AVANT toute autre validation — meme
   * discipline que `DocumentTemplatesService.assertCanManageDocumentTemplates`
   * (E10.10b-4a) : un acteur sans le droit ne doit rien apprendre de plus.
   */
  private async assertCanExportOrders(tenantId: TenantId, actor: UserId): Promise<void> {
    const authorized = await this.repository.actorHasCapability(tenantId, actor, CAN_EXPORT_ORDERS);
    if (!authorized) throw new OrderExportAccessDeniedError();
  }
}
