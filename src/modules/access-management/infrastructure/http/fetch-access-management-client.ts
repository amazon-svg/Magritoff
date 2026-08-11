import type {
  AccessManagementApi,
  AccessManagementApiErrorResponse,
} from '../../api';
import type {
  CapabilityDescriptor,
  MemberRoleAssignments,
  ModuleAvailability,
  MyTenantAccess,
  RoleDefinition,
} from '../../domain';

export type AccessTokenProvider = () => Promise<string | null>;

export class AccessManagementApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'AccessManagementApiError';
  }
}

export class FetchAccessManagementApiClient implements AccessManagementApi {
  constructor(
    private readonly getAccessToken: AccessTokenProvider,
    private readonly baseUrl = '/api/v1',
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  getMyTenantAccess(tenantId: string): Promise<MyTenantAccess> {
    return this.get(`/tenants/${encodeURIComponent(tenantId)}/access/me`);
  }

  async listModules(tenantId: string): Promise<readonly ModuleAvailability[]> {
    const response = await this.get<{ items: readonly ModuleAvailability[] }>(
      `/tenants/${encodeURIComponent(tenantId)}/access/modules`,
    );
    return response.items;
  }

  async listCapabilities(tenantId: string): Promise<readonly CapabilityDescriptor[]> {
    const response = await this.get<{ items: readonly CapabilityDescriptor[] }>(
      `/tenants/${encodeURIComponent(tenantId)}/access/capabilities`,
    );
    return response.items;
  }

  async listRoles(tenantId: string): Promise<readonly RoleDefinition[]> {
    const response = await this.get<{ items: readonly RoleDefinition[] }>(
      `/tenants/${encodeURIComponent(tenantId)}/access/roles`,
    );
    return response.items;
  }

  async listMemberAssignments(
    tenantId: string,
  ): Promise<readonly MemberRoleAssignments[]> {
    const response = await this.get<{ items: readonly MemberRoleAssignments[] }>(
      `/tenants/${encodeURIComponent(tenantId)}/access/members`,
    );
    return response.items;
  }

  private async get<T>(path: string): Promise<T> {
    const token = await this.getAccessToken();
    const headers = new Headers({ Accept: 'application/json' });
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await this.fetcher(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
      method: 'GET',
      headers,
    });
    const body = await response.json() as T | AccessManagementApiErrorResponse;
    if (!response.ok) {
      const failure = body as AccessManagementApiErrorResponse;
      throw new AccessManagementApiError(
        failure.error?.code ?? 'api.internal_error',
        failure.error?.message ?? 'The request failed.',
        response.status,
        failure.error?.retryable ?? response.status >= 500,
        failure.requestId,
      );
    }
    return body as T;
  }
}
