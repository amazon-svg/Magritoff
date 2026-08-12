export const SURFACE_IDS = [
  'storefront',
  'customer-portal',
  'workspace',
  'backoffice',
] as const;

export type SurfaceId = (typeof SURFACE_IDS)[number];

export type FeatureDefinition = Readonly<{
  id: string;
  description: string;
}>;

export type CapabilityDefinition = Readonly<{
  id: string;
  description: string;
}>;

export type ModuleManifest = Readonly<{
  id: string;
  name: string;
  features: readonly FeatureDefinition[];
  capabilities: readonly CapabilityDefinition[];
  surfaces: readonly SurfaceId[];
}>;

export type RouteContribution = Readonly<{
  id: string;
  moduleId: string;
  featureId: string;
  surface: SurfaceId;
  path: string;
  mount: 'router' | 'host';
  requiredCapabilities?: readonly string[];
}>;

export type NavigationContribution = Readonly<{
  id: string;
  moduleId: string;
  featureId: string;
  surface: SurfaceId;
  routeId: string;
  groupId: string;
  label: string;
  iconId: string;
  order: number;
  testId?: string;
}>;

export type SurfaceContribution = Readonly<{
  moduleId: string;
  surface: SurfaceId;
  routes: readonly RouteContribution[];
  navigation: readonly NavigationContribution[];
}>;

export type SurfaceDefinition = Readonly<{
  id: SurfaceId;
  routes: readonly RouteContribution[];
  navigation: readonly NavigationContribution[];
  modules: readonly ModuleManifest[];
}>;

export function defineModuleManifest<const T extends ModuleManifest>(manifest: T): T {
  return manifest;
}

export function defineSurfaceContribution<const T extends SurfaceContribution>(contribution: T): T {
  return contribution;
}
