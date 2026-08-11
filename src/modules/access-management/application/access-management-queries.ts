import {
  appError,
  err,
  ok,
  type ActorContext,
  type AppError,
  type Result,
} from '../../../kernel';
import type { AccessService, EntitlementService } from '../../../platform';
import {
  accessManagementCapabilities,
  type CapabilityDescriptor,
  type MemberRoleAssignments,
  type ModuleAvailability,
  type MyTenantAccess,
  type RoleDefinition,
  type RoleId,
} from '../domain';
import type {
  AccessManagementReadRepository,
  CapabilityCatalog,
  ModuleCatalog,
  RoleStatusFilter,
} from './ports';

export type AccessManagementQueryError = AppError & Readonly<{
  code:
    | 'access_management.forbidden'
    | 'access_management.not_found'
    | 'access_management.provider_unavailable'
    | 'access_management.invalid_legacy_data';
}>;

export type AccessManagementQueryDependencies = Readonly<{
  access: AccessService;
  entitlements: EntitlementService;
  repository: AccessManagementReadRepository;
  capabilities: CapabilityCatalog;
  modules: ModuleCatalog;
}>;

function queryError(
  code: AccessManagementQueryError['code'],
  message: string,
  retryable = false,
): AccessManagementQueryError {
  return appError(code, message, retryable) as AccessManagementQueryError;
}

function normalizeProviderError(error: AppError): AccessManagementQueryError {
  if (error.code === 'access_management.invalid_legacy_data') {
    return error as AccessManagementQueryError;
  }
  return queryError(
    'access_management.provider_unavailable',
    'Access information is temporarily unavailable.',
    true,
  );
}

export class AccessManagementQueries {
  constructor(private readonly dependencies: AccessManagementQueryDependencies) {}

  async getMyTenantAccess(
    actor: ActorContext,
  ): Promise<Result<MyTenantAccess, AccessManagementQueryError>> {
    const capabilities = await this.dependencies.access.listCapabilities(actor);
    if (capabilities.ok === false) return err(normalizeProviderError(capabilities.error));

    const modules = await this.resolveModules(actor);
    if (modules.ok === false) return err(modules.error);

    return ok({
      tenantId: actor.tenantId,
      userId: actor.userId,
      membership: 'active',
      capabilities: capabilities.value,
      modules: modules.value,
    });
  }

  async listModules(
    actor: ActorContext,
  ): Promise<Result<readonly ModuleAvailability[], AccessManagementQueryError>> {
    return this.resolveModules(actor);
  }

  async listCapabilityCatalog(
    actor: ActorContext,
  ): Promise<Result<readonly CapabilityDescriptor[], AccessManagementQueryError>> {
    const authorization = await this.require(actor, accessManagementCapabilities.rolesRead);
    if (authorization.ok === false) return err(authorization.error);
    return ok(this.dependencies.capabilities.list());
  }

  async listRoles(
    actor: ActorContext,
    status: RoleStatusFilter = 'active',
  ): Promise<Result<readonly RoleDefinition[], AccessManagementQueryError>> {
    const authorization = await this.require(actor, accessManagementCapabilities.rolesRead);
    if (authorization.ok === false) return err(authorization.error);
    const roles = await this.dependencies.repository.listRoles(actor.tenantId, status);
    return roles.ok === false
      ? err(normalizeProviderError(roles.error))
      : ok(roles.value);
  }

  async getRole(
    actor: ActorContext,
    roleId: RoleId,
  ): Promise<Result<RoleDefinition, AccessManagementQueryError>> {
    const authorization = await this.require(actor, accessManagementCapabilities.rolesRead);
    if (authorization.ok === false) return err(authorization.error);
    const role = await this.dependencies.repository.getRole(actor.tenantId, roleId);
    if (role.ok === false) return err(normalizeProviderError(role.error));
    return role.value
      ? ok(role.value)
      : err(queryError('access_management.not_found', 'The role was not found.'));
  }

  async listMemberAssignments(
    actor: ActorContext,
  ): Promise<Result<readonly MemberRoleAssignments[], AccessManagementQueryError>> {
    const authorization = await this.require(actor, accessManagementCapabilities.assignmentsRead);
    if (authorization.ok === false) return err(authorization.error);
    const assignments = await this.dependencies.repository.listMemberAssignments(actor.tenantId);
    return assignments.ok === false
      ? err(normalizeProviderError(assignments.error))
      : ok(assignments.value);
  }

  private async resolveModules(
    actor: ActorContext,
  ): Promise<Result<readonly ModuleAvailability[], AccessManagementQueryError>> {
    const modules: ModuleAvailability[] = [];
    for (const registration of this.dependencies.modules.list()) {
      let enabled = true;
      if (registration.feature) {
        const feature = await this.dependencies.entitlements.hasFeature(
          actor.tenantId,
          registration.feature,
        );
        if (feature.ok === false) return err(normalizeProviderError(feature.error));
        enabled = feature.value;
      }

      if (!enabled) {
        modules.push({
          moduleKey: registration.moduleKey,
          enabled: false,
          accessible: false,
          reason: 'feature_disabled',
        });
        continue;
      }

      const decision = await this.dependencies.access.can(actor, registration.accessCapability);
      if (!decision.allowed && decision.reason === 'provider_unavailable') {
        return err(normalizeProviderError(appError('access.provider_unavailable', 'Unavailable.')));
      }
      modules.push({
        moduleKey: registration.moduleKey,
        enabled: true,
        accessible: decision.allowed,
        reason: decision.allowed ? 'available' : 'missing_capability',
      });
    }
    return ok(modules);
  }

  private async require(
    actor: ActorContext,
    capability: string,
  ): Promise<Result<void, AccessManagementQueryError>> {
    const authorization = await this.dependencies.access.require(actor, capability);
    if (authorization.ok === true) return ok(undefined);
    if (authorization.error.code.endsWith('.provider_unavailable')) {
      return err(normalizeProviderError(authorization.error));
    }
    return err(queryError('access_management.forbidden', 'This operation is not permitted.'));
  }
}
