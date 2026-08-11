import type { AccessService, ResourceRef } from '../../../../platform';
import { ok, type ActorContext, type Result } from '../../../../kernel';
import type { AccessDecision, AccessError } from '../../../../platform';
import { accessManagementCapabilities } from '../../domain';

export const legacyCapabilityMapping = Object.freeze({
  can_quote: ['quotes.quote.create'],
  can_order: ['orders.order.create'],
  can_invite: ['tenant.members.invite'],
  can_validate: ['orders.workflow.validate'],
  can_cancel: ['orders.order.cancel'],
  can_modify: ['orders.order.edit'],
  can_export: ['orders.order.export'],
  can_manage_catalog: ['catalog.product.manage'],
  can_manage_roles: [
    accessManagementCapabilities.accessRead,
    accessManagementCapabilities.rolesRead,
    accessManagementCapabilities.rolesManage,
    accessManagementCapabilities.assignmentsRead,
    accessManagementCapabilities.assignmentsManage,
    accessManagementCapabilities.auditRead,
  ],
} as const satisfies Readonly<Record<string, readonly string[]>>);

const canonicalToLegacy = new Map<string, string>();
for (const [legacy, canonicalNames] of Object.entries(legacyCapabilityMapping)) {
  for (const canonical of canonicalNames) canonicalToLegacy.set(canonical, legacy);
}

export function canonicalCapabilityNames(value: unknown): readonly string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];
  const names = new Set<string>();
  for (const [name, enabled] of Object.entries(value)) {
    if (enabled !== true) continue;
    const mapped = legacyCapabilityMapping[name as keyof typeof legacyCapabilityMapping];
    if (mapped) {
      for (const canonical of mapped) names.add(canonical);
    } else {
      names.add(name);
    }
  }
  return [...names].sort();
}

function legacyName(capability: string): string {
  return canonicalToLegacy.get(capability) ?? capability;
}

/**
 * Anti-corruption adapter for the historical `can_*` vocabulary. New code
 * only asks for canonical capabilities; the wrapped provider remains unaware
 * of the new access-management module.
 */
export class LegacyMappedAccessService implements AccessService {
  constructor(private readonly delegate: AccessService) {}

  can(
    actor: ActorContext,
    capability: string,
    resource?: ResourceRef,
  ): Promise<AccessDecision> {
    return this.delegate.can(actor, legacyName(capability), resource);
  }

  require(
    actor: ActorContext,
    capability: string,
    resource?: ResourceRef,
  ): Promise<Result<void, AccessError>> {
    return this.delegate.require(actor, legacyName(capability), resource);
  }

  async listCapabilities(
    actor: ActorContext,
  ): Promise<Result<readonly string[], AccessError>> {
    const capabilities = await this.delegate.listCapabilities(actor);
    if (capabilities.ok === false) return capabilities;
    const mapped = new Set<string>();
    for (const capability of capabilities.value) {
      const canonical = legacyCapabilityMapping[
        capability as keyof typeof legacyCapabilityMapping
      ];
      if (canonical) {
        for (const name of canonical) mapped.add(name);
      } else {
        mapped.add(capability);
      }
    }
    return ok([...mapped].sort());
  }
}
