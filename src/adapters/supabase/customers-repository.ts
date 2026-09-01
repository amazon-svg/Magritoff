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

/**
 * E10.5 — acces boutique embarque via la relation inverse
 * `shop_customer_accounts.customer_contact_id`. La RLS de
 * `shop_customer_accounts` (20260816000200) ne rend visibles que les comptes
 * des boutiques ou l acteur a la capability `can_manage_shop_customers` ou
 * `can_impersonate_shop_customer` : un acteur qui ne l a pas voit un tableau
 * vide, jamais une erreur — fail-closed, pas une fuite.
 */
const SHOP_ACCESS_EMBED = 'shop_customer_accounts(shop_id, status)' as const;

/**
 * Neutralise les caracteres reserves de la grammaire de filtre PostgREST
 * (m2 qa-review) avant de les interpoler dans un `.or(...)`. La virgule
 * separe les conditions et les parentheses delimitent `and()/or()` : une
 * saisie ordinaire les contenant (ex. "Martin, Paris") romptait la requete
 * en 500 cote client, sans fuite inter-tenant.
 *
 * Choix : RETIRER ces caracteres plutot que tenter de les echapper — la
 * syntaxe exacte de citation de PostgREST n a pas pu etre revalidee via
 * documentation dans cet environnement (MCP context7 indisponible ici). Un
 * terme de recherche perd un signe de ponctuation ; il ne casse jamais la
 * requete.
 */
/** Exporte uniquement pour test unitaire (m3). */
export function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()]/g, ' ').trim();
}

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
    if (params.q) {
      const sanitized = sanitizeSearchTerm(params.q);
      if (sanitized.length > 0) {
        const term = `%${sanitized}%`;
        query = query.or(
          `company_name.ilike.${term},first_name.ilike.${term},last_name.ilike.${term}`,
        );
      }
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
      .select(`*, customers!inner(tenant_id), ${SHOP_ACCESS_EMBED}`)
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
      .select(`*, customers!inner(tenant_id), ${SHOP_ACCESS_EMBED}`)
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
    result: Readonly<{ verified: boolean; verifiedAt: string; siret: string }>,
  ): Promise<CustomerDto> {
    const { data, error } = await this.client
      .from('customers')
      .update({ siret_verified: result.verified, siret_verified_at: result.verifiedAt })
      .eq('tenant_id', tenantId)
      .eq('id', customerId)
      // Condition de course : l appel INSEE dure, un PATCH concurrent peut
      // avoir change le SIRET entre-temps. Sans ce filtre, on apposerait
      // « verifie » sur un numero que personne n a controle. Zero ligne
      // touchee -> CustomerNotFoundError, la verification est simplement
      // perdue et l appelant peut la relancer.
      .eq('siret', result.siret)
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
    shop_accesses: toShopAccesses(row.shop_customer_accounts),
  };
}

/**
 * `suspended` n est jamais restitue (voir commentaire du schema Zod) : un
 * acces revoque a deja perdu son `customer_contact_id` cote base et ne peut
 * donc pas apparaitre ici. Le filtre reste une deuxieme ligne de defense si
 * une ligne suspendue restait exceptionnellement liee.
 */
function toShopAccesses(value: unknown): { shop_id: string; status: 'invited' | 'active' }[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (row): row is { shop_id: string; status: string } =>
        Boolean(row) && (row.status === 'invited' || row.status === 'active'),
    )
    .map((row) => ({ shop_id: row.shop_id, status: row.status as 'invited' | 'active' }));
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

/**
 * Nom de la contrainte violee, extrait du message Postgres
 * (`duplicate key value violates unique constraint "nom_contrainte"`).
 * `details` est inclus car PostgREST y reporte parfois la contrainte quand
 * `message` a ete reformule.
 */
function violatedConstraintName(error: { message: string; details?: string | null }): string | null {
  const haystack = `${error.message} ${error.details ?? ''}`;
  return haystack.match(/constraint "([^"]+)"/)?.[1] ?? null;
}

/** Exporte uniquement pour test unitaire (discrimination par contrainte, m2). */
export function toDomainError(
  error: { code?: string; message: string; details?: string | null } | null,
  fallback: string,
): Error {
  if (error?.code === UNIQUE_VIOLATION) {
    const constraint = violatedConstraintName(error);
    // Discrimine par CONTRAINTE, pas par code seul : 23505 est leve aussi
    // bien par customers_tenant_siret_uidx (creation/modification de client)
    // que par customer_contacts_primary_uidx (rarissime en pratique, le
    // trigger customer_contacts_enforce_single_primary retrograde deja
    // l ancien principal AVANT l ecriture, mais une course entre deux
    // requetes concurrentes reste possible). Un meme code pour les deux
    // aurait affiche "SIRET deja utilise" sur une operation d interlocuteur.
    if (constraint === 'customer_contacts_primary_uidx') {
      return new CustomerCommandRejectedError(
        'customer.primary_contact_conflict',
        'Un autre interlocuteur vient d etre defini comme principal, reessayer.',
        [{ field: 'is_primary', message: 'Conflit sur l interlocuteur principal.' }],
      );
    }
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
