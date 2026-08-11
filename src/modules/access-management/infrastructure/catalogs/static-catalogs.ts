import type { CapabilityCatalog, ModuleCatalog } from '../../application';
import {
  accessManagementCapabilities,
  type CapabilityDescriptor,
  type ModuleRegistration,
} from '../../domain';

const accessCapabilities: readonly CapabilityDescriptor[] = [
  {
    name: accessManagementCapabilities.rolesRead,
    moduleKey: 'access_management',
    label: 'Consulter les rôles',
    assignableByTenantAdmin: true,
    sensitivity: 'standard',
  },
  {
    name: accessManagementCapabilities.rolesManage,
    moduleKey: 'access_management',
    label: 'Gérer les rôles',
    assignableByTenantAdmin: true,
    sensitivity: 'sensitive',
  },
  {
    name: accessManagementCapabilities.assignmentsRead,
    moduleKey: 'access_management',
    label: 'Consulter les affectations',
    assignableByTenantAdmin: true,
    sensitivity: 'standard',
  },
  {
    name: accessManagementCapabilities.assignmentsManage,
    moduleKey: 'access_management',
    label: 'Gérer les affectations',
    assignableByTenantAdmin: true,
    sensitivity: 'sensitive',
  },
  {
    name: accessManagementCapabilities.auditRead,
    moduleKey: 'access_management',
    label: "Consulter l'audit des accès",
    assignableByTenantAdmin: true,
    sensitivity: 'sensitive',
  },
  {
    name: accessManagementCapabilities.entitlementsRead,
    moduleKey: 'platform',
    label: 'Consulter les activations commerciales',
    assignableByTenantAdmin: false,
    sensitivity: 'platform_only',
  },
  {
    name: accessManagementCapabilities.entitlementsManage,
    moduleKey: 'platform',
    label: 'Gérer les activations commerciales',
    assignableByTenantAdmin: false,
    sensitivity: 'platform_only',
  },
];

export const accessManagementRegistration: ModuleRegistration = Object.freeze({
  moduleKey: 'access_management',
  accessCapability: accessManagementCapabilities.rolesRead,
  capabilities: accessCapabilities,
});

export class StaticModuleCatalog implements ModuleCatalog {
  constructor(private readonly registrations: readonly ModuleRegistration[]) {}

  list(): readonly ModuleRegistration[] {
    return this.registrations;
  }
}

export class StaticCapabilityCatalog implements CapabilityCatalog {
  constructor(private readonly registrations: readonly ModuleRegistration[]) {}

  list(): readonly CapabilityDescriptor[] {
    return this.registrations.flatMap((registration) => registration.capabilities);
  }
}
