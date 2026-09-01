/**
 * Faux repository Clients (E10.4), partage entre `customers.contract.test.ts`
 * et `customer-shop-access.contract.test.ts` (E10.5).
 *
 * Extrait plutot que duplique : un second faux reecrit a la main aurait pu
 * diverger de celui deja exerce par les tests E10.4 (leçon du sprint —
 * `docs/api/CONVENTIONS.md`, un faux non teste qui diverge de l adaptateur
 * reel passe le typecheck sans etre detecte).
 */
import type { TenantId, UserId } from '@/kernel';
import {
  CustomerCommandRejectedError,
  CustomerNotFoundError,
  type CustomersRepository,
  type ListCustomersParams,
  type ListCustomersResult,
} from '@/modules/customers/application/customers-repository';
import type {
  CreateCustomerCommand,
  CreateCustomerContactCommand,
  CustomerContactDto,
  CustomerDetailDto,
  CustomerDto,
  UpdateCustomerCommand,
  UpdateCustomerContactCommand,
} from '@/modules/customers/api/contracts';

let sequence = 0;
export function fakeUuid(): string {
  sequence += 1;
  return `00000000-0000-4000-9000-${String(sequence).padStart(12, '0')}`;
}

export class InMemoryCustomersRepository implements CustomersRepository {
  private readonly customers = new Map<string, CustomerDto>();
  private readonly contacts = new Map<string, CustomerContactDto>();

  async list(tenantId: TenantId, params: ListCustomersParams): Promise<ListCustomersResult> {
    const rows = [...this.customers.values()]
      .filter((c) => c.tenant_id === tenantId)
      .filter((c) => !params.type || c.type === params.type)
      .filter((c) => {
        if (!params.q) return true;
        const haystack = `${c.company_name ?? ''} ${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase();
        return haystack.includes(params.q.toLowerCase());
      })
      .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
    return { rows };
  }

  async findById(tenantId: TenantId, customerId: string): Promise<CustomerDto | null> {
    const found = this.customers.get(customerId);
    return found && found.tenant_id === tenantId ? found : null;
  }

  async findDetailById(tenantId: TenantId, customerId: string): Promise<CustomerDetailDto | null> {
    const customer = await this.findById(tenantId, customerId);
    if (!customer) return null;
    const contacts = await this.listContacts(tenantId, customerId);
    return { ...customer, contacts: [...contacts], projects: [], quotes: [], orders: [] };
  }

  async create(
    tenantId: TenantId,
    _actor: UserId,
    command: CreateCustomerCommand,
  ): Promise<CustomerDto> {
    const now = new Date().toISOString();
    const customer: CustomerDto = {
      id: fakeUuid(),
      tenant_id: tenantId,
      type: command.type,
      company_name: command.company_name ?? null,
      siret: command.siret ?? null,
      vat_number: command.vat_number ?? null,
      civility: command.civility ?? null,
      first_name: command.first_name ?? null,
      last_name: command.last_name ?? null,
      billing_address: command.billing_address ?? null,
      shipping_address: command.shipping_address ?? null,
      is_active: true,
      siret_verified: false,
      siret_verified_at: null,
      created_at: now,
      updated_at: now,
    };
    this.customers.set(customer.id, customer);
    return customer;
  }

  async update(
    tenantId: TenantId,
    customerId: string,
    command: UpdateCustomerCommand,
  ): Promise<CustomerDto> {
    const current = await this.findById(tenantId, customerId);
    if (!current) throw new CustomerNotFoundError();
    const nextSiret = 'siret' in command ? (command.siret ?? null) : current.siret;
    const siretChanged = nextSiret !== current.siret;
    const updated: CustomerDto = {
      ...current,
      ...('company_name' in command ? { company_name: command.company_name ?? null } : {}),
      siret: nextSiret,
      ...('vat_number' in command ? { vat_number: command.vat_number ?? null } : {}),
      ...('civility' in command ? { civility: command.civility ?? null } : {}),
      ...('first_name' in command ? { first_name: command.first_name ?? null } : {}),
      ...('last_name' in command ? { last_name: command.last_name ?? null } : {}),
      ...('is_active' in command ? { is_active: command.is_active! } : {}),
      ...(siretChanged ? { siret_verified: false, siret_verified_at: null } : {}),
      updated_at: new Date().toISOString(),
    };
    this.customers.set(customerId, updated);
    return updated;
  }

  async listContacts(
    tenantId: TenantId,
    customerId: string,
  ): Promise<readonly CustomerContactDto[]> {
    void tenantId;
    return [...this.contacts.values()].filter((c) => c.customer_id === customerId);
  }

  async findContactById(
    _tenantId: TenantId,
    customerId: string,
    contactId: string,
  ): Promise<CustomerContactDto | null> {
    const contact = this.contacts.get(contactId);
    return contact && contact.customer_id === customerId ? contact : null;
  }

  async createContact(
    _tenantId: TenantId,
    customerId: string,
    command: CreateCustomerContactCommand,
  ): Promise<CustomerContactDto> {
    const now = new Date().toISOString();
    const contact: CustomerContactDto = {
      id: fakeUuid(),
      customer_id: customerId,
      first_name: command.first_name,
      last_name: command.last_name,
      role: command.role ?? null,
      email: command.email,
      phone: command.phone ?? null,
      is_primary: command.is_primary ?? false,
      created_at: now,
      updated_at: now,
      shop_accesses: [],
    };
    if (contact.is_primary) this.demoteOtherPrimaries(customerId, contact.id);
    this.contacts.set(contact.id, contact);
    return contact;
  }

  async updateContact(
    _tenantId: TenantId,
    customerId: string,
    contactId: string,
    command: UpdateCustomerContactCommand,
  ): Promise<CustomerContactDto> {
    const current = this.contacts.get(contactId);
    if (!current || current.customer_id !== customerId) throw new CustomerNotFoundError();
    const updated: CustomerContactDto = {
      ...current,
      ...(command.first_name !== undefined ? { first_name: command.first_name } : {}),
      ...(command.last_name !== undefined ? { last_name: command.last_name } : {}),
      ...(command.role !== undefined ? { role: command.role } : {}),
      ...(command.email !== undefined ? { email: command.email } : {}),
      ...(command.phone !== undefined ? { phone: command.phone } : {}),
      ...(command.is_primary !== undefined ? { is_primary: command.is_primary } : {}),
      updated_at: new Date().toISOString(),
    };
    if (updated.is_primary) this.demoteOtherPrimaries(customerId, contactId);
    this.contacts.set(contactId, updated);
    return updated;
  }

  async markSiretVerified(
    tenantId: TenantId,
    customerId: string,
    result: Readonly<{ verified: boolean; verifiedAt: string; siret: string }>,
  ): Promise<CustomerDto> {
    const current = await this.findById(tenantId, customerId);
    if (!current) throw new CustomerNotFoundError();
    if (current.siret !== result.siret) throw new CustomerNotFoundError();
    const updated = {
      ...current,
      siret_verified: result.verified,
      siret_verified_at: result.verifiedAt,
    };
    this.customers.set(customerId, updated);
    return updated;
  }

  private demoteOtherPrimaries(customerId: string, keepId: string): void {
    for (const [id, contact] of this.contacts) {
      if (contact.customer_id === customerId && id !== keepId && contact.is_primary) {
        this.contacts.set(id, { ...contact, is_primary: false });
      }
    }
  }
}

export { CustomerCommandRejectedError, CustomerNotFoundError };
