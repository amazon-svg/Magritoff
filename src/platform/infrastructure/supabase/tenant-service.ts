import type { SupabaseClient } from '@supabase/supabase-js';
import {
  appError,
  err,
  ok,
  parseId,
  type Result,
  type TenantId,
  type UserId,
} from '../../../kernel';
import type { Database } from '../../../types/database.types';
import type {
  Tenant,
  TenantError,
  TenantHierarchy,
  TenantMembership,
  TenantService,
} from '../../tenant';

type PlatformSupabaseClient = SupabaseClient<Database>;

type TenantRow = Readonly<{
  id: string;
  name: string;
  parent_tenant_id: string | null;
}>;

function tenantError(
  code: TenantError['code'],
  message: string,
  retryable = false,
): TenantError {
  return appError(code, message, retryable) as TenantError;
}

function parseTenantId(value: string): Result<TenantId, TenantError> {
  const parsed = parseId<'TenantId'>(value);
  return parsed.ok
    ? parsed
    : err(
        tenantError(
          'tenant.provider_unavailable',
          'The tenant provider returned an invalid identifier.',
          true,
        ),
      );
}

function mapTenant(row: TenantRow): Result<Tenant, TenantError> {
  const id = parseTenantId(row.id);
  if (!id.ok) return id;
  return ok({ id: id.value, name: row.name, status: 'active' });
}

export class SupabaseTenantService implements TenantService {
  constructor(private readonly client: PlatformSupabaseClient) {}

  async get(tenantId: TenantId): Promise<Result<Tenant | null, TenantError>> {
    const row = await this.loadTenant(tenantId);
    if (!row.ok) return row;
    if (row.value === null) return ok(null);
    return mapTenant(row.value);
  }

  async listMemberships(
    userId: UserId,
  ): Promise<Result<readonly TenantMembership[], TenantError>> {
    const { data, error } = await this.client
      .from('tenant_members')
      .select('user_id, tenant_id')
      .eq('user_id', userId);

    if (error) return this.providerFailure('Memberships could not be loaded.');

    const memberships: TenantMembership[] = [];
    for (const row of data ?? []) {
      const parsedUserId = parseId<'UserId'>(row.user_id);
      const parsedTenantId = parseTenantId(row.tenant_id);
      if (!parsedUserId.ok || !parsedTenantId.ok) {
        return this.providerFailure('A membership contains an invalid identifier.');
      }
      memberships.push({
        userId: parsedUserId.value,
        tenantId: parsedTenantId.value,
        status: 'active',
      });
    }

    return ok(memberships);
  }

  async resolveMembership(
    userId: UserId,
    tenantId: TenantId,
  ): Promise<Result<TenantMembership | null, TenantError>> {
    const { data, error } = await this.client
      .from('tenant_members')
      .select('user_id, tenant_id')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) return this.providerFailure('The tenant membership could not be resolved.');
    if (!data) return ok(null);

    const parsedUserId = parseId<'UserId'>(data.user_id);
    const parsedTenantId = parseTenantId(data.tenant_id);
    if (!parsedUserId.ok || !parsedTenantId.ok) {
      return this.providerFailure('The membership contains an invalid identifier.');
    }

    return ok({
      userId: parsedUserId.value,
      tenantId: parsedTenantId.value,
      status: 'active',
    });
  }

  async requireMembership(
    userId: UserId,
    tenantId: TenantId,
  ): Promise<Result<TenantMembership, TenantError>> {
    const membership = await this.resolveMembership(userId, tenantId);
    if (!membership.ok) return membership;
    if (!membership.value) {
      return err(tenantError('tenant.not_a_member', 'The user is not a member of this tenant.'));
    }
    if (membership.value.status !== 'active') {
      return err(
        tenantError('tenant.membership_revoked', 'The tenant membership is not active.'),
      );
    }

    return ok(membership.value);
  }

  async getHierarchy(
    tenantId: TenantId,
  ): Promise<Result<TenantHierarchy, TenantError>> {
    const row = await this.loadTenant(tenantId);
    if (!row.ok) return row;
    if (!row.value) return err(tenantError('tenant.not_found', 'The tenant was not found.'));

    const tenant = mapTenant(row.value);
    if (!tenant.ok) return tenant;

    const { data: children, error } = await this.client
      .from('tenants')
      .select('id')
      .eq('parent_tenant_id', tenantId);
    if (error) return this.providerFailure('The tenant hierarchy could not be loaded.');

    const childIds: TenantId[] = [];
    for (const child of children ?? []) {
      const childId = parseTenantId(child.id);
      if (!childId.ok) return childId;
      childIds.push(childId.value);
    }

    let parentId: TenantId | undefined;
    if (row.value.parent_tenant_id) {
      const parsedParentId = parseTenantId(row.value.parent_tenant_id);
      if (!parsedParentId.ok) return parsedParentId;
      parentId = parsedParentId.value;
    }

    return ok({
      tenant: tenant.value,
      children: childIds,
      ...(parentId ? { parentId } : {}),
    });
  }

  private async loadTenant(
    tenantId: TenantId,
  ): Promise<Result<TenantRow | null, TenantError>> {
    const { data, error } = await this.client
      .from('tenants')
      .select('id, name, parent_tenant_id')
      .eq('id', tenantId)
      .maybeSingle();
    return error
      ? this.providerFailure('The tenant could not be loaded.')
      : ok(data);
  }

  private providerFailure<T>(message: string): Result<T, TenantError> {
    return err(tenantError('tenant.provider_unavailable', message, true));
  }
}
