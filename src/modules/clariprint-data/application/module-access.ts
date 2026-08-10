import type { ActorContext, Result } from '../../../kernel';
import type {
  AccessError,
  AccessService,
  EntitlementError,
  EntitlementService,
} from '../../../platform';
import {
  clariprintDataCapabilities,
  clariprintDataFeature,
} from '../domain';

export type ClariprintDataModuleAccessError = AccessError | EntitlementError;

export type ClariprintDataModuleAccessDependencies = Readonly<{
  access: AccessService;
  entitlements: EntitlementService;
}>;

export async function requireClariprintDataModuleAccess(
  actor: ActorContext,
  dependencies: ClariprintDataModuleAccessDependencies,
): Promise<Result<void, ClariprintDataModuleAccessError>> {
  const feature = await dependencies.entitlements.requireFeature(
    actor.tenantId,
    clariprintDataFeature,
  );

  if (!feature.ok) return feature;

  return dependencies.access.require(
    actor,
    clariprintDataCapabilities.moduleAccess,
  );
}
