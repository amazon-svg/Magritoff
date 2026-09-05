import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type {
  CreateCustomerCommand,
  CreateCustomerContactCommand,
  CustomerContactDto,
  CustomerDetailDto,
  CustomerDto,
  CustomerType,
  UpdateCustomerCommand,
  UpdateCustomerContactCommand,
} from '../api/contracts.ts';

export type ListCustomersParams = Readonly<{
  q: string | null;
  type: CustomerType | null;
  size: number;
  cursor: Readonly<{ sort: string; id: string }> | null;
}>;

export type ListCustomersResult = Readonly<{
  /**
   * `size + 1` lignes lues au plus (non tronquees ici) : la ligne
   * excedentaire, si presente, prouve l existence d une page suivante.
   * `buildPage()` (src/modules/_shared/application/pagination.ts) fait le
   * decoupage et encode le curseur suivant — un seul endroit sait comment.
   */
  rows: readonly CustomerDto[];
}>;

/** Rejete quand une commande viole une regle metier non portee par le schema Zod. */
export class CustomerCommandRejectedError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly fieldErrors: readonly Readonly<{ field: string; message: string }>[] = [],
  ) {
    super(message);
    this.name = 'CustomerCommandRejectedError';
  }
}

/** Le client (ou l interlocuteur) n existe pas dans le tenant du jeton. */
export class CustomerNotFoundError extends Error {
  constructor(message = 'Client introuvable dans ce tenant.') {
    super(message);
    this.name = 'CustomerNotFoundError';
  }
}

/**
 * Port (interface) du referentiel Clients. L implementation Supabase vit dans
 * src/adapters/supabase/customers-repository.ts ; ce module n en connait que
 * le contrat.
 */
export interface CustomersRepository {
  list(tenantId: TenantId, params: ListCustomersParams): Promise<ListCustomersResult>;

  /** `null` si absent ou hors du tenant (404 cote route, jamais 403). */
  findById(tenantId: TenantId, customerId: string): Promise<CustomerDto | null>;

  findDetailById(tenantId: TenantId, customerId: string): Promise<CustomerDetailDto | null>;

  create(
    tenantId: TenantId,
    actor: UserId,
    command: CreateCustomerCommand,
  ): Promise<CustomerDto>;

  update(
    tenantId: TenantId,
    customerId: string,
    command: UpdateCustomerCommand,
  ): Promise<CustomerDto>;

  listContacts(tenantId: TenantId, customerId: string): Promise<readonly CustomerContactDto[]>;

  /** `null` si absent ou hors du client/tenant (404 cote route). */
  findContactById(
    tenantId: TenantId,
    customerId: string,
    contactId: string,
  ): Promise<CustomerContactDto | null>;

  createContact(
    tenantId: TenantId,
    customerId: string,
    command: CreateCustomerContactCommand,
  ): Promise<CustomerContactDto>;

  updateContact(
    tenantId: TenantId,
    customerId: string,
    contactId: string,
    command: UpdateCustomerContactCommand,
  ): Promise<CustomerContactDto>;

  /**
   * Applique le resultat d une verification SIRET (CA3) au client.
   *
   * `result.siret` est le numero SUR LEQUEL la verification a porte :
   * l implementation doit s en servir comme condition d ecriture. Un appel
   * INSEE dure, et un PATCH concurrent peut changer le SIRET du client
   * entre-temps ; sans cette condition, le resultat s appliquerait a un numero
   * que personne n a controle. `CustomerNotFoundError` si le SIRET a change.
   */
  markSiretVerified(
    tenantId: TenantId,
    customerId: string,
    result: Readonly<{ verified: boolean; verifiedAt: string; siret: string }>,
  ): Promise<CustomerDto>;
}
