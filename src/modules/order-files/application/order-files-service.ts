/**
 * Service applicatif du module Fichiers de commande (story E10.17a).
 *
 * Orchestration pure : aucune dependance a Supabase ni au HTTP. AUCUNE garde
 * de capability (decision #4 du contrat, docs/api/CONVENTIONS.md §8.19) :
 * dépôt, visibilite et suppression sont ouverts a tout membre du tenant —
 * l authentification par jeton UTILISATEUR (jamais une cle de service,
 * decision #5) est verifiee par la ROUTE (`authentication: 'user'`), pas ici.
 */
import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type {
  ConfirmOrderFileUploadCommand,
  OrderFileDetailDto,
  OrderFileDto,
  OrderFileUploadTicketDto,
  UpdateOrderFileCommand,
} from '../api/contracts.ts';
import {
  OrderFileNotFoundError,
  OrderNotFoundError,
  type ListOrderFilesResult,
  type OrderFilesRepository,
} from './order-files-repository.ts';

export type OrderFilesServiceDependencies = Readonly<{
  repository: OrderFilesRepository;
}>;

export class OrderFilesService {
  private readonly repository: OrderFilesRepository;

  constructor(dependencies: OrderFilesServiceDependencies) {
    this.repository = dependencies.repository;
  }

  /** `listOrderFiles`. Lecture OUVERTE a tout membre du tenant. */
  async list(tenantId: TenantId, orderId: string): Promise<ListOrderFilesResult> {
    const rows = await this.repository.listByOrder(tenantId, orderId);
    if (rows === null) throw new OrderNotFoundError();
    return rows;
  }

  /** `getOrderFile`. 404 `order_file.not_found` indistinctement (fichier inconnu, commande inconnue, ou supprime). */
  async getById(tenantId: TenantId, orderId: string, fileId: string): Promise<OrderFileDetailDto> {
    const file = await this.repository.findById(tenantId, orderId, fileId);
    if (!file) throw new OrderFileNotFoundError();
    return file;
  }

  /**
   * Precondition `If-Match` d `updateOrderFile` (qa-review N6) : meme
   * resolution que `getById`, SANS signer d URL de telechargement (l `ETag`
   * les exclut de toute facon). 404 `order_file.not_found` indistinctement.
   */
  async getRawById(tenantId: TenantId, orderId: string, fileId: string): Promise<OrderFileDto> {
    const file = await this.repository.findRawById(tenantId, orderId, fileId);
    if (!file) throw new OrderFileNotFoundError();
    return file;
  }

  /** `issueOrderFileUploadUrl`. ALLOUE un `file_id`, ne cree aucune ligne. */
  async issueUploadUrl(tenantId: TenantId, orderId: string): Promise<OrderFileUploadTicketDto> {
    return this.repository.issueUploadUrl(tenantId, orderId);
  }

  /** `confirmOrderFileUpload`. LE SEUL endroit ou un fichier existe. */
  async confirmUpload(
    tenantId: TenantId,
    orderId: string,
    actor: UserId,
    command: ConfirmOrderFileUploadCommand,
  ): Promise<OrderFileDto> {
    return this.repository.confirmUpload(tenantId, orderId, actor, command);
  }

  /** `updateOrderFile`. Un seul champ modifiable : `visibility`. */
  async updateVisibility(
    tenantId: TenantId,
    orderId: string,
    fileId: string,
    command: UpdateOrderFileCommand,
  ): Promise<OrderFileDto> {
    return this.repository.updateVisibility(tenantId, orderId, fileId, command);
  }

  /** `deleteOrderFile`. Octets detruits, ligne conservee comme trace. */
  async remove(tenantId: TenantId, orderId: string, fileId: string, actor: UserId): Promise<void> {
    await this.repository.remove(tenantId, orderId, fileId, actor);
  }
}
