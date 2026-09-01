/**
 * Implementation Supabase du referentiel Clients (story E10.4).
 *
 * Le tenant est toujours passe explicitement par l appelant (route), jamais
 * lu depuis la session Supabase : c est le principal deja resolu par la
 * facade (CA4) qui fait foi.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import type {
  Address,
  CreateCustomerCommand,
  CreateCustomerContactCommand,
  CustomerContactDto,
  CustomerDetailDto,
  CustomerDto,
  UpdateCustomerCommand,
  UpdateCustomerContactCommand,
} from '../../modules/customers/api/contracts.ts';
import {
  CustomerCommandRejectedError,
  CustomerNotFoundError,
  type CustomersRepository,
  type ListCustomersParams,
  type ListCustomersResult,
} from '../../modules/customers/application/customers-repository.ts';

const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';

export class SupabaseCustomersRepository implements CustomersRepository {
  constructor(private readonly client: SupabaseClient<any>) {}

  async list(tenantId: TenantId, params: ListCustomersParams): Promise<ListCustomersResult> {
    let query = this.client
      .from('customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(params.size + 1);

    if (params.type) query = query.eq('type', params.type);
    if (params.q && params.q.trim().length > 0) {
      const term = `%${params.q.trim()}%`;
      query = query.or(
        `company_name.ilike.${term},first_name.ilike.${term},last_name.ilike.${term}`,
      );
    }
    if (params.cursor) {
      // Pagination par cle (created_at, id) descendante : la page suivante
      // commence strictement apres le curseur, dans le meme ordre de tri.
      query = query.or(
        `created_at.lt.${params.cursor.sort},and(created_at.eq.${params.cursor.sort},id.lt.${params.cursor.id})`,
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { rows: (data ?? []).map(toCustomerDto) };
  }

  async findById(tenantId: TenantId, customerId: string): Promise<CustomerDto | null> {
    const { data, error } = await this.client
      .from('customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', customerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toCustomerDto(data) : null;
  }

  async findDetailById(tenantId: TenantId, customerId: string): Promise<CustomerDetailDto | null> {
    const customer = await this.findById(tenantId, customerId);
    if (!customer) return null;
    const contacts = await this.listContacts(tenantId, customerId);
    return {
      ...customer,
      contacts: [...contacts],
      // Points d extension E10.1/E10.3/E10.12 : toujours vides tant que ces
      // stories ne sont pas livrees (CA6 — pas de donnee inventee).
      projects: [],
      quotes: [],
      orders: [],
    };
  }

  async create(
    tenantId: TenantId,
    actor: UserId,
    command: CreateCustomerCommand,
  ): Promise<CustomerDto> {
    const { data, error } = await this.client
      .from('customers')
      .insert({
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
        created_by: actor,
      })
      .select()
      .single();
    if (error || !data) throw toDomainError(error, 'Création du client impossible.');
    return toCustomerDto(data);
  }

  async update(
    tenantId: TenantId,
    customerId: string,
    command: UpdateCustomerCommand,
  ): Promise<CustomerDto> {
    const patch: Record<string, unknown> = {};
    if ('company_name' in command) patch['company_name'] = command.company_name;
    if ('siret' in command) patch['siret'] = command.siret;
    if ('vat_number' in command) patch['vat_number'] = command.vat_number;
    if ('civility' in command) patch['civility'] = command.civility;
    if ('first_name' in command) patch['first_name'] = command.first_name;
    if ('last_name' in command) patch['last_name'] = command.last_name;
    if ('billing_address' in command) patch['billing_address'] = command.billing_address;
    if ('shipping_address' in command) patch['shipping_address'] = command.shipping_address;
    if ('is_active' in command) patch['is_active'] = command.is_active;

    const { data, error } = await this.client
      .from('customers')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', customerId)
      .select()
      .maybeSingle();
    if (error) throw toDomainError(error, 'Modification du client impossible.');
    if (!data) throw new CustomerNotFoundError();
    return toCustomerDto(data);
  }

  async listContacts(
    tenantId: TenantId,
    customerId: string,
  ): Promise<readonly CustomerContactDto[]> {
    const { data, error } = await this.client
      .from('customer_contacts')
      .select('*, customers!inner(tenant_id)')
      .eq('customer_id', customerId)
      .eq('customers.tenant_id', tenantId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toContactDto);
  }

  async findContactById(
    tenantId: TenantId,
    customerId: string,
    contactId: string,
  ): Promise<CustomerContactDto | null> {
    const { data, error } = await this.client
      .from('customer_contacts')
      .select('*, customers!inner(tenant_id)')
      .eq('id', contactId)
      .eq('customer_id', customerId)
      .eq('customers.tenant_id', tenantId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toContactDto(data) : null;
  }

  async createContact(
    tenantId: TenantId,
    customerId: string,
    command: CreateCustomerContactCommand,
  ): Promise<CustomerContactDto> {
    await this.assertCustomerInTenant(tenantId, customerId);
    const { data, error } = await this.client
      .from('customer_contacts')
      .insert({
        customer_id: customerId,
        first_name: command.first_name,
        last_name: command.last_name,
        role: command.role ?? null,
        email: command.email,
        phone: command.phone ?? null,
        is_primary: command.is_primary ?? false,
      })
      .select()
      .single();
    if (error || !data) throw toDomainError(error, 'Création de l interlocuteur impossible.');
    return toContactDto(data);
  }

  async updateContact(
    tenantId: TenantId,
    customerId: string,
    contactId: string,
    command: UpdateCustomerContactCommand,
  ): Promise<CustomerContactDto> {
    await this.assertCustomerInTenant(tenantId, customerId);
    const patch: Record<string, unknown> = {};
    if (command.first_name !== undefined) patch['first_name'] = command.first_name;
    if (command.last_name !== undefined) patch['last_name'] = command.last_name;
    if (command.role !== undefined) patch['role'] = command.role;
    if (command.email !== undefined) patch['email'] = command.email;
    if (command.phone !== undefined) patch['phone'] = command.phone;
    if (command.is_primary !== undefined) patch['is_primary'] = command.is_primary;

    const { data, error } = await this.client
      .from('customer_contacts')
      .update(patch)
      .eq('customer_id', customerId)
      .eq('id', contactId)
      .select()
      .maybeSingle();
    if (error) throw toDomainError(error, 'Modification de l interlocuteur impossible.');
    if (!data) throw new CustomerNotFoundError('Interlocuteur introuvable.');
    return toContactDto(data);
  }

  async markSiretVerified(
    tenantId: TenantId,
    customerId: string,
    result: Readonly<{ verified: boolean; verifiedAt: string }>,
  ): Promise<CustomerDto> {
    const { data, error } = await this.client
      .from('customers')
      .update({ siret_verified: result.verified, siret_verified_at: result.verifiedAt })
      .eq('tenant_id', tenantId)
      .eq('id', customerId)
      .select()
      .maybeSingle();
    if (error) throw toDomainError(error, 'Mise a jour de la verification SIRET impossible.');
    if (!data) throw new CustomerNotFoundError();
    return toCustomerDto(data);
  }

  private async assertCustomerInTenant(tenantId: TenantId, customerId: string): Promise<void> {
    const { data, error } = await this.client
      .from('customers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', customerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new CustomerNotFoundError();
  }
}

function toCustomerDto(row: Record<string, any>): CustomerDto {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    type: row.type,
    company_name: row.company_name ?? null,
    siret: row.siret ?? null,
    vat_number: row.vat_number ?? null,
    civility: row.civility ?? null,
    first_name: row.first_name ?? null,
    last_name: row.last_name ?? null,
    billing_address: toAddress(row.billing_address),
    shipping_address: toAddress(row.shipping_address),
    is_active: Boolean(row.is_active),
    siret_verified: Boolean(row.siret_verified),
    siret_verified_at: row.siret_verified_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toContactDto(row: Record<string, any>): CustomerContactDto {
  return {
    id: row.id,
    customer_id: row.customer_id,
    first_name: row.first_name,
    last_name: row.last_name,
    role: row.role ?? null,
    email: row.email,
    phone: row.phone ?? null,
    is_primary: Boolean(row.is_primary),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toAddress(value: unknown): Address | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  return {
    line1: String(record['line1'] ?? ''),
    line2: record['line2'] === undefined || record['line2'] === null ? null : String(record['line2']),
    postal_code: String(record['postal_code'] ?? ''),
    city: String(record['city'] ?? ''),
    country: String(record['country'] ?? ''),
  };
}

function toDomainError(error: { code?: string; message: string } | null, fallback: string): Error {
  if (error?.code === UNIQUE_VIOLATION) {
    return new CustomerCommandRejectedError(
      'customer.siret_already_used',
      'Ce SIRET est deja utilise par un autre client de ce tenant.',
      [{ field: 'siret', message: 'SIRET deja utilise dans ce tenant.' }],
    );
  }
  if (error?.code === CHECK_VIOLATION) {
    return new CustomerCommandRejectedError(
      'api.validation_failed',
      error.message ?? fallback,
    );
  }
  return new Error(error?.message ?? fallback);
}
