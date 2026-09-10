/**
 * Service applicatif du module Liens de depot publics (story E10.20a).
 *
 * Orchestration pure : aucune dependance a Supabase ni au HTTP. AUCUNE garde
 * de capability, meme parti qu `order-files` (E10.17a decision #4) : emettre
 * un lien de depot est un geste d atelier ordinaire, coherent avec le fait
 * qu attacher un fichier a une commande n en exige pas davantage — le
 * verrou UM1 rend de toute facon tout droit metier E10 admin-only tant qu il
 * tient (docs/api/CONVENTIONS.md §3.5).
 */
import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type {
  CreateOrderUploadLinkCommand,
  OrderUploadLinkContextDto,
  OrderUploadLinkCreatedDto,
} from '../api/contracts.ts';
import {
  OrderNotFoundError,
  OrderUploadLinkNotFoundError,
  type ListOrderUploadLinksResult,
  type OrderUploadLinksRepository,
} from './order-upload-links-repository.ts';

export type OrderUploadLinksServiceDependencies = Readonly<{
  repository: OrderUploadLinksRepository;
}>;

export class OrderUploadLinksService {
  private readonly repository: OrderUploadLinksRepository;

  constructor(dependencies: OrderUploadLinksServiceDependencies) {
    this.repository = dependencies.repository;
  }

  /** `createOrderUploadLink`. Seul endroit ou le jeton en clair existe. */
  async create(
    tenantId: TenantId,
    orderId: string,
    actor: UserId,
    command: CreateOrderUploadLinkCommand,
  ): Promise<OrderUploadLinkCreatedDto> {
    return this.repository.create(tenantId, orderId, actor, command);
  }

  /** `listOrderUploadLinks`. Liens VIVANTS uniquement, jamais le jeton. */
  async list(tenantId: TenantId, orderId: string): Promise<ListOrderUploadLinksResult> {
    const rows = await this.repository.listByOrder(tenantId, orderId);
    if (rows === null) throw new OrderNotFoundError();
    return rows;
  }

  /** `revokeOrderUploadLink`. Ligne conservee comme trace, elle quitte la liste des vivants. */
  async revoke(tenantId: TenantId, orderId: string, linkId: string, actor: UserId): Promise<void> {
    await this.repository.revoke(tenantId, orderId, linkId, actor);
  }

  /**
   * `getOrderUploadLinkContext`. `token` vient du `UploadLinkPrincipal` deja
   * resolu par le middleware — jamais d un parametre d appelant.
   * `OrderUploadLinkNotFoundError` ne devrait normalement jamais etre vue
   * ici : elle est reutilisee comme signal d echec generique, la route la
   * traduit en 401 `upload_link.invalid` (meme code que toute autre cause
   * d invalidite du lien, contrat arbitrage (F)).
   */
  async getContext(token: string): Promise<OrderUploadLinkContextDto> {
    const context = await this.repository.getContext(token);
    if (context === null) throw new OrderUploadLinkNotFoundError();
    return context;
  }
}
