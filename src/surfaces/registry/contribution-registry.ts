import {
  SURFACE_IDS,
  type ModuleManifest,
  type NavigationContribution,
  type RouteContribution,
  type SurfaceContribution,
  type SurfaceDefinition,
  type SurfaceId,
} from './contracts';

export class ContributionRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContributionRegistryError';
  }
}

export function createContributionRegistry(input: Readonly<{
  manifests: readonly ModuleManifest[];
  contributions: readonly SurfaceContribution[];
}>) {
  const manifestsById = uniqueBy(input.manifests, ({ id }) => id, 'module');
  const featuresById = uniqueBy(
    input.manifests.flatMap((manifest) =>
      manifest.features.map((feature) => ({ ...feature, moduleId: manifest.id })),
    ),
    ({ id }) => id,
    'feature',
  );
  const capabilitiesById = uniqueBy(
    input.manifests.flatMap((manifest) =>
      manifest.capabilities.map((capability) => ({ ...capability, moduleId: manifest.id })),
    ),
    ({ id }) => id,
    'capability',
  );
  const routes = input.contributions.flatMap((contribution) => contribution.routes);
  const navigation = input.contributions.flatMap((contribution) => contribution.navigation);
  const routesById = uniqueBy(routes, ({ id }) => id, 'route');
  uniqueBy(navigation, ({ id }) => id, 'navigation');

  for (const contribution of input.contributions) {
    const manifest = manifestsById.get(contribution.moduleId);
    if (!manifest) fail(`Contribution du module inconnu ${contribution.moduleId}.`);
    if (!manifest.surfaces.includes(contribution.surface)) {
      fail(`Le module ${manifest.id} ne déclare pas la surface ${contribution.surface}.`);
    }
    for (const route of contribution.routes) validateRoute(route, contribution, featuresById, capabilitiesById);
    for (const item of contribution.navigation) validateNavigation(item, contribution, featuresById, routesById);
  }

  uniqueBy(
    routes.map((route) => ({ id: `${route.surface}:${route.mount}:${normalizePath(route.path)}` })),
    ({ id }) => id,
    'chemin de route',
  );

  return Object.freeze({
    manifest(moduleId: string): ModuleManifest | null {
      return manifestsById.get(moduleId) ?? null;
    },
    forSurface(surface: SurfaceId): SurfaceDefinition {
      const contributions = input.contributions.filter((item) => item.surface === surface);
      const moduleIds = new Set(contributions.map(({ moduleId }) => moduleId));
      return Object.freeze({
        id: surface,
        routes: Object.freeze(routes.filter((route) => route.surface === surface)),
        navigation: Object.freeze(
          navigation
            .filter((item) => item.surface === surface)
            .sort((left, right) => left.order - right.order),
        ),
        modules: Object.freeze(
          input.manifests.filter((manifest) => moduleIds.has(manifest.id)),
        ),
      });
    },
    surfaces(): readonly SurfaceDefinition[] {
      return SURFACE_IDS.map((surface) => this.forSurface(surface));
    },
  });
}

function validateRoute(
  route: RouteContribution,
  contribution: SurfaceContribution,
  features: ReadonlyMap<string, { moduleId: string }>,
  capabilities: ReadonlyMap<string, { moduleId: string }>,
) {
  if (route.moduleId !== contribution.moduleId || route.surface !== contribution.surface) {
    fail(`La route ${route.id} ne correspond pas à sa contribution parente.`);
  }
  assertOwnedReference(route.featureId, route.moduleId, features, 'feature', route.id);
  for (const capabilityId of route.requiredCapabilities ?? []) {
    assertOwnedReference(capabilityId, route.moduleId, capabilities, 'capability', route.id);
  }
  if (normalizePath(route.path).length === 0) fail(`La route ${route.id} a un chemin vide.`);
}

function validateNavigation(
  item: NavigationContribution,
  contribution: SurfaceContribution,
  features: ReadonlyMap<string, { moduleId: string }>,
  routes: ReadonlyMap<string, RouteContribution>,
) {
  if (item.moduleId !== contribution.moduleId || item.surface !== contribution.surface) {
    fail(`La navigation ${item.id} ne correspond pas à sa contribution parente.`);
  }
  assertOwnedReference(item.featureId, item.moduleId, features, 'feature', item.id);
  const route = routes.get(item.routeId);
  if (!route || route.moduleId !== item.moduleId || route.surface !== item.surface) {
    fail(`La navigation ${item.id} référence une route incompatible ${item.routeId}.`);
  }
}

function assertOwnedReference(
  id: string,
  moduleId: string,
  definitions: ReadonlyMap<string, { moduleId: string }>,
  kind: string,
  ownerId: string,
) {
  const definition = definitions.get(id);
  if (!definition || definition.moduleId !== moduleId) {
    fail(`${ownerId} référence une ${kind} inconnue ou étrangère ${id}.`);
  }
}

function uniqueBy<T>(
  values: readonly T[],
  key: (value: T) => string,
  kind: string,
): Map<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    const id = key(value);
    if (result.has(id)) fail(`Doublon de ${kind}: ${id}.`);
    result.set(id, value);
  }
  return result;
}

function normalizePath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '');
}

function fail(message: string): never {
  throw new ContributionRegistryError(message);
}
