/**
 * Service applicatif du module Clients (story E10.4).
 *
 * Orchestration pure : aucune dependance a Supabase ni au HTTP. Les erreurs
 * metier sont des types dedies (`CustomerNotFoundError`,
 * `CustomerCommandRejectedError`) ; c est la route qui les traduit en Problem
 * RFC 7807, avec le request_id qu elle seule connait.
 */
import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type { OutboxPublisher } from '../../_shared/application/index.ts';
import type {
  CreateCustomerCommand,
  CreateCustomerContactCommand,
  CustomerContactDto,
  CustomerDetailDto,
  CustomerDto,
  UpdateCustomerCommand,
  UpdateCustomerContactCommand,
} from '../api/contracts.ts';
import {
  CustomerCommandRejectedError,
  CustomerNotFoundError,
  type CustomersRepository,
  type ListCustomersParams,
  type ListCustomersResult,
} from './customers-repository.ts';
import { checkSiretFormat, lookupSiretAtInsee, type Clock, type Delay } from './siret-verification.ts';

export type SiretVerificationOutcome = Readonly<{
  customer: CustomerDto;
  siret: string;
  verified: boolean;
  companyName: string | null;
  nafCode: string | null;
  active: boolean;
  mocked: boolean;
  checkedAt: string;
}>;

export type CustomersServiceDependencies = Readonly<{
  repository: CustomersRepository;
  outbox: OutboxPublisher;
  clock?: Clock;
  delay?: Delay;
}>;

export class CustomersService {
  private readonly repository: CustomersRepository;
  private readonly outbox: OutboxPublisher;
  private readonly clock: Clock;
  private readonly delay: Delay | undefined;

  constructor(dependencies: CustomersServiceDependencies) {
    this.repository = dependencies.repository;
    this.outbox = dependencies.outbox;
    this.clock = dependencies.clock ?? (() => new Date());
    this.delay = dependencies.delay;
  }

  list(tenantId: TenantId, params: ListCustomersParams): Promise<ListCustomersResult> {
    return this.repository.list(tenantId, params);
  }

  async getDetail(tenantId: TenantId, customerId: string): Promise<CustomerDetailDto> {
    const detail = await this.repository.findDetailById(tenantId, customerId);
    if (!detail) throw new CustomerNotFoundError();
    return detail;
  }

  async getSummary(tenantId: TenantId, customerId: string): Promise<CustomerDto> {
    const customer = await this.repository.findById(tenantId, customerId);
    if (!customer) throw new CustomerNotFoundError();
    return customer;
  }

  /**
   * Cree un client (CA2, CA10). La forme conditionnelle des champs selon
   * `type` est deja verifiee par `createCustomerCommandSchema` (superRefine)
   * avant que le service ne soit atteint — cf. defineGescomRoute, qui rejette
   * l entree en 422 avant d appeler `handle()`.
   */
  async create(
    tenantId: TenantId,
    actor: UserId,
    command: CreateCustomerCommand,
  ): Promise<CustomerDto> {
    const created = await this.repository.create(tenantId, actor, command);
    // CA10 : l evenement est publie dans le meme flux applicatif que
    // l ecriture ; OutboxPublisher.append() ecrit en base (meme transaction
    // metier cote adaptateur Supabase), pas en HTTP direct.
    await this.outbox.publish({
      name: 'customer.created',
      tenantId,
      aggregateType: 'customer',
      aggregateId: created.id,
      payload: {
        customer_id: created.id,
        type: created.type,
        company_name: created.company_name,
        first_name: created.first_name,
        last_name: created.last_name,
      },
    });
    return created;
  }

  async update(
    tenantId: TenantId,
    customerId: string,
    command: UpdateCustomerCommand,
  ): Promise<CustomerDto> {
    const current = await this.repository.findById(tenantId, customerId);
    if (!current) throw new CustomerNotFoundError();

    if (command.siret !== undefined && command.siret !== null) {
      if (current.type !== 'company') {
        throw new CustomerCommandRejectedError(
          'customer.not_a_company',
          'Seul un client entreprise porte un SIRET.',
          [{ field: 'siret', message: 'Ce client n est pas une entreprise.' }],
        );
      }
      const check = checkSiretFormat(command.siret);
      if (!check.ok) {
        throw new CustomerCommandRejectedError(
          'customer.siret_invalid',
          'SIRET invalide.',
          [
            {
              field: 'siret',
              message:
                check.error === 'siret_shape'
                  ? 'Le SIRET doit comporter 14 chiffres.'
                  : 'SIRET invalide (echec de la cle de Luhn).',
            },
          ],
        );
      }
    }

    return this.repository.update(tenantId, customerId, command);
  }

  async listContacts(
    tenantId: TenantId,
    customerId: string,
  ): Promise<readonly CustomerContactDto[]> {
    const exists = await this.repository.findById(tenantId, customerId);
    if (!exists) throw new CustomerNotFoundError();
    return this.repository.listContacts(tenantId, customerId);
  }

  async getContact(
    tenantId: TenantId,
    customerId: string,
    contactId: string,
  ): Promise<CustomerContactDto> {
    const contact = await this.repository.findContactById(tenantId, customerId, contactId);
    if (!contact) throw new CustomerNotFoundError('Interlocuteur introuvable.');
    return contact;
  }

  /**
   * Ajoute un interlocuteur (CA4, CA5). Aucune ecriture ici ne cree de compte
   * utilisateur ni n envoie d invitation — c est une donnee de gestion pure ;
   * la bascule de l ancien interlocuteur principal, si `is_primary: true`,
   * est garantie par le trigger `customer_contacts_enforce_single_primary`
   * cote base, pas par une logique applicative qui pourrait diverger.
   */
  async createContact(
    tenantId: TenantId,
    customerId: string,
    command: CreateCustomerContactCommand,
  ): Promise<CustomerContactDto> {
    const exists = await this.repository.findById(tenantId, customerId);
    if (!exists) throw new CustomerNotFoundError();
    return this.repository.createContact(tenantId, customerId, command);
  }

  async updateContact(
    tenantId: TenantId,
    customerId: string,
    contactId: string,
    command: UpdateCustomerContactCommand,
  ): Promise<CustomerContactDto> {
    const exists = await this.repository.findById(tenantId, customerId);
    if (!exists) throw new CustomerNotFoundError();
    return this.repository.updateContact(tenantId, customerId, contactId, command);
  }

  /**
   * Verifie le SIRET d un client aupres de l INSEE (CA3). BOUCHON : voir
   * src/modules/customers/application/siret-verification.ts.
   */
  async verifySiret(tenantId: TenantId, customerId: string): Promise<SiretVerificationOutcome> {
    const customer = await this.repository.findById(tenantId, customerId);
    if (!customer) throw new CustomerNotFoundError();

    if (customer.type !== 'company') {
      throw new CustomerCommandRejectedError(
        'customer.not_a_company',
        'Seul un client entreprise peut faire l objet d une verification SIRET.',
      );
    }
    if (!customer.siret) {
      throw new CustomerCommandRejectedError(
        'customer.siret_missing',
        'Ce client entreprise ne porte encore aucun SIRET.',
      );
    }

    const format = checkSiretFormat(customer.siret);
    if (!format.ok) {
      // Ne devrait pas arriver : le SIRET stocke a deja passe le CHECK de
      // forme en base et la validation Zod a la creation. Filet de securite.
      throw new CustomerCommandRejectedError(
        'customer.siret_invalid',
        'Le SIRET enregistre pour ce client est invalide.',
      );
    }

    const lookup = await lookupSiretAtInsee(format.siret, {
      now: this.clock,
      ...(this.delay ? { delay: this.delay } : {}),
    });

    const updated = await this.repository.markSiretVerified(tenantId, customerId, {
      verified: lookup.verified,
      verifiedAt: lookup.checkedAt,
    });

    return {
      customer: updated,
      siret: lookup.siret,
      verified: lookup.verified,
      companyName: lookup.companyName,
      nafCode: lookup.nafCode,
      active: lookup.active,
      mocked: lookup.mocked,
      checkedAt: lookup.checkedAt,
    };
  }
}
