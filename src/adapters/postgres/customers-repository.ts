import type { PoolClient } from 'pg';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp, toIsoTimestampOrNull } from '../../modules/_shared/application/index.ts';
import type { Address, CreateCustomerCommand, CreateCustomerContactCommand, CustomerContactDto, CustomerDetailDto, CustomerDto, UpdateCustomerCommand, UpdateCustomerContactCommand } from '../../modules/customers/api/contracts.ts';
import { CustomerCommandRejectedError, CustomerNotFoundError, type CustomersRepository, type ListCustomersParams, type ListCustomersResult } from '../../modules/customers/application/customers-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type CustomerRow = Record<string, unknown> & { id: string; tenant_id: string; created_at: Date; updated_at: Date };
type ContactRow = Record<string, unknown> & { id: string; customer_id: string; created_at: Date; updated_at: Date };

export class PostgresCustomersRepository implements CustomersRepository {
  constructor(private readonly transactions: PostgresTransactionRunner) {}

  list(tenantId: TenantId, params: ListCustomersParams): Promise<ListCustomersResult> {
    return this.transactions.run({ tenantId }, async (client) => {
      const values: unknown[] = [tenantId, params.size + 1];
      const filters = ['tenant_id = $1'];
      if (params.type !== null) { values.push(params.type); filters.push(`type = $${values.length}`); }
      if (params.q !== null) {
        const q = sanitizeSearchTerm(params.q);
        if (q.length > 0) { values.push(`%${q}%`); filters.push(`concat_ws(' ', company_name, first_name, last_name) ilike $${values.length}`); }
      }
      if (params.cursor !== null) {
        values.push(params.cursor.sort, params.cursor.id);
        filters.push(`(created_at, id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`);
      }
      const result = await client.query<CustomerRow>(`
        select * from public.customers where ${filters.join(' and ')}
         order by created_at desc, id desc limit $2
      `, values);
      return { rows: result.rows.map(toCustomerDto) };
    });
  }

  findById(tenantId: TenantId, customerId: string): Promise<CustomerDto | null> {
    return this.transactions.run({ tenantId }, async (client) => {
      const result = await client.query<CustomerRow>('select * from public.customers where tenant_id = $1 and id = $2', [tenantId, customerId]);
      return result.rows[0] === undefined ? null : toCustomerDto(result.rows[0]);
    });
  }

  async findDetailById(tenantId: TenantId, customerId: string): Promise<CustomerDetailDto | null> {
    const customer = await this.findById(tenantId, customerId);
    if (customer === null) return null;
    return { ...customer, contacts: [...await this.listContacts(tenantId, customerId)], projects: [], quotes: [], orders: [] };
  }

  create(tenantId: TenantId, actor: UserId, command: CreateCustomerCommand): Promise<CustomerDto> {
    return this.writeCustomer(tenantId, async (client) => {
      const result = await client.query<CustomerRow>(`
        insert into public.customers (
          tenant_id, type, company_name, siret, vat_number, civility, first_name,
          last_name, billing_address, shipping_address, created_by
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11) returning *
      `, [tenantId, command.type, command.company_name ?? null, command.siret ?? null,
        command.vat_number ?? null, command.civility ?? null, command.first_name ?? null,
        command.last_name ?? null, json(command.billing_address), json(command.shipping_address), actor]);
      return toCustomerDto(required(result.rows));
    }, actor);
  }

  update(tenantId: TenantId, customerId: string, command: UpdateCustomerCommand): Promise<CustomerDto> {
    return this.writeCustomer(tenantId, async (client) => {
      const { assignments, values } = patch(command, ['company_name','siret','vat_number','civility','first_name','last_name','billing_address','shipping_address','is_active']);
      if (assignments.length === 0) return this.selectCustomer(client, tenantId, customerId);
      const result = await client.query<CustomerRow>(`update public.customers set ${assignments.join(', ')} where tenant_id = $1 and id = $2 returning *`, [tenantId, customerId, ...values]);
      if (result.rows[0] === undefined) throw new CustomerNotFoundError();
      return toCustomerDto(result.rows[0]);
    });
  }

  listContacts(tenantId: TenantId, customerId: string): Promise<readonly CustomerContactDto[]> {
    return this.transactions.run({ tenantId }, async (client) => {
      const result = await client.query<ContactRow>(`select contact.* from public.customer_contacts contact join public.customers customer on customer.id = contact.customer_id where customer.tenant_id = $1 and customer.id = $2 order by contact.is_primary desc, contact.created_at`, [tenantId, customerId]);
      return result.rows.map(toContactDto);
    });
  }

  findContactById(tenantId: TenantId, customerId: string, contactId: string): Promise<CustomerContactDto | null> {
    return this.transactions.run({ tenantId }, async (client) => {
      const result = await client.query<ContactRow>(`select contact.* from public.customer_contacts contact join public.customers customer on customer.id = contact.customer_id where customer.tenant_id = $1 and customer.id = $2 and contact.id = $3`, [tenantId, customerId, contactId]);
      return result.rows[0] === undefined ? null : toContactDto(result.rows[0]);
    });
  }

  createContact(tenantId: TenantId, customerId: string, command: CreateCustomerContactCommand): Promise<CustomerContactDto> {
    return this.writeContact(tenantId, async (client) => {
      await this.assertCustomer(client, tenantId, customerId);
      const result = await client.query<ContactRow>(`insert into public.customer_contacts (customer_id, first_name, last_name, role, email, phone, is_primary) values ($1,$2,$3,$4,$5,$6,$7) returning *`, [customerId, command.first_name, command.last_name, command.role ?? null, command.email, command.phone ?? null, command.is_primary ?? false]);
      return toContactDto(required(result.rows));
    });
  }

  updateContact(tenantId: TenantId, customerId: string, contactId: string, command: UpdateCustomerContactCommand): Promise<CustomerContactDto> {
    return this.writeContact(tenantId, async (client) => {
      const { assignments, values } = patch(command, ['first_name','last_name','role','email','phone','is_primary']);
      if (assignments.length === 0) {
        const result = await client.query<ContactRow>('select * from public.customer_contacts where customer_id = $1 and id = $2', [customerId, contactId]);
        if (result.rows[0] === undefined) throw new CustomerNotFoundError('Interlocuteur introuvable.');
        return toContactDto(result.rows[0]);
      }
      const result = await client.query<ContactRow>(`update public.customer_contacts set ${assignments.join(', ')} where customer_id = $1 and id = $2 returning *`, [customerId, contactId, ...values]);
      if (result.rows[0] === undefined) throw new CustomerNotFoundError('Interlocuteur introuvable.');
      return toContactDto(result.rows[0]);
    });
  }

  markSiretVerified(tenantId: TenantId, customerId: string, result: Readonly<{ verified: boolean; verifiedAt: string; siret: string }>): Promise<CustomerDto> {
    return this.writeCustomer(tenantId, async (client) => {
      const updated = await client.query<CustomerRow>(`update public.customers set siret_verified = $3, siret_verified_at = $4 where tenant_id = $1 and id = $2 and siret = $5 returning *`, [tenantId, customerId, result.verified, result.verifiedAt, result.siret]);
      if (updated.rows[0] === undefined) throw new CustomerNotFoundError();
      return toCustomerDto(updated.rows[0]);
    });
  }

  private async writeCustomer<T>(
    tenantId: TenantId,
    operation: (client: PoolClient) => Promise<T>,
    actor?: UserId,
  ): Promise<T> {
    try {
      return await this.transactions.run(
        { tenantId, ...(actor === undefined ? {} : { userId: actor }) },
        operation,
      );
    } catch (error) {
      throw mapError(error);
    }
  }

  private writeContact<T>(
    tenantId: TenantId,
    operation: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    return this.writeCustomer(tenantId, operation);
  }

  private async assertCustomer(
    client: PoolClient,
    tenantId: TenantId,
    customerId: string,
  ): Promise<void> {
    const result = await client.query(
      'select 1 from public.customers where tenant_id = $1 and id = $2',
      [tenantId, customerId],
    );
    if (result.rowCount !== 1) throw new CustomerNotFoundError();
  }

  private async selectCustomer(
    client: PoolClient,
    tenantId: TenantId,
    customerId: string,
  ): Promise<CustomerDto> {
    const result = await client.query<CustomerRow>(
      'select * from public.customers where tenant_id = $1 and id = $2',
      [tenantId, customerId],
    );
    if (result.rows[0] === undefined) throw new CustomerNotFoundError();
    return toCustomerDto(result.rows[0]);
  }
}

function sanitizeSearchTerm(raw: string) { return raw.replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim(); }
function json(value: unknown) { return value == null ? null : JSON.stringify(value); }
function required<T>(rows: readonly T[]): T { if (rows[0] === undefined) throw new Error('Ecriture client sans resultat.'); return rows[0]; }
function patch(command: Record<string, unknown>, allowed: readonly string[]) { const assignments: string[] = []; const values: unknown[] = []; for (const field of allowed) if (field in command) { values.push(field.includes('address') ? json(command[field]) : command[field]); assignments.push(`${field} = $${values.length + 2}${field.includes('address') ? '::jsonb' : ''}`); } return { assignments, values }; }
function toAddress(value: unknown): Address | null { return value && typeof value === 'object' ? value as Address : null; }
function toCustomerDto(row: CustomerRow): CustomerDto { return { id: row.id, tenant_id: row.tenant_id, type: row['type'] as CustomerDto['type'], company_name: row['company_name'] as string|null, siret: row['siret'] as string|null, vat_number: row['vat_number'] as string|null, civility: row['civility'] as CustomerDto['civility'], first_name: row['first_name'] as string|null, last_name: row['last_name'] as string|null, billing_address: toAddress(row['billing_address']), shipping_address: toAddress(row['shipping_address']), is_active: Boolean(row['is_active']), siret_verified: Boolean(row['siret_verified']), siret_verified_at: toIsoTimestampOrNull(row['siret_verified_at'] as Date|null), created_at: toIsoTimestamp(row.created_at), updated_at: toIsoTimestamp(row.updated_at) }; }
function toContactDto(row: ContactRow): CustomerContactDto { return { id: row.id, customer_id: row.customer_id, first_name: String(row['first_name']), last_name: String(row['last_name']), role: row['role'] as string|null, email: String(row['email']), phone: row['phone'] as string|null, is_primary: Boolean(row['is_primary']), created_at: toIsoTimestamp(row.created_at), updated_at: toIsoTimestamp(row.updated_at), shop_accesses: [] }; }
function mapError(error: unknown): Error { if (error instanceof CustomerNotFoundError) return error; const value = error as { code?: string; constraint?: string; message?: string }; if (value.code === '23505') return new CustomerCommandRejectedError(value.constraint === 'customer_contacts_primary_uidx' ? 'customer.primary_contact_conflict' : 'customer.siret_already_used', value.message ?? 'Conflit client.'); if (value.code === '23514') return new CustomerCommandRejectedError('api.validation_failed', value.message ?? 'Validation client impossible.'); return error instanceof Error ? error : new Error(String(error)); }
