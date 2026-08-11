import type { CapabilityDescriptor, ModuleRegistration } from '../access-management';
import { clariprintDataCapabilities, clariprintDataFeature } from './domain';

const capabilities: readonly CapabilityDescriptor[] = Object.values(
  clariprintDataCapabilities,
).map((name) => ({
  name,
  moduleKey: 'clariprint_data',
  label: name,
  assignableByTenantAdmin: true,
  sensitivity: name.includes('.financial.') ? 'sensitive' : 'standard',
}));

export const clariprintDataModuleRegistration: ModuleRegistration = Object.freeze({
  moduleKey: 'clariprint_data',
  feature: clariprintDataFeature,
  accessCapability: clariprintDataCapabilities.moduleAccess,
  capabilities,
});

