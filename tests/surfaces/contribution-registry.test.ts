import { describe, expect, it } from 'vitest';
import { accountModuleManifest } from '../../src/modules/account';
import { applicationContributionRegistry } from '../../src/surfaces';
import {
  ContributionRegistryError,
  createContributionRegistry,
  defineModuleManifest,
  defineSurfaceContribution,
} from '../../src/surfaces/registry';

describe('registre des contributions de surfaces', () => {
  it('expose les quatre composition roots même lorsqu ils sont encore vides', () => {
    expect(applicationContributionRegistry.surfaces().map(({ id }) => id)).toEqual([
      'storefront',
      'customer-portal',
      'workspace',
      'backoffice',
    ]);
  });

  it('compose le module account sur workspace et customer portal', () => {
    const workspace = applicationContributionRegistry.forSurface('workspace');
    const portal = applicationContributionRegistry.forSurface('customer-portal');

    expect(accountModuleManifest.surfaces).toEqual(['workspace', 'customer-portal']);
    expect(workspace.routes).toEqual([
      expect.objectContaining({ id: 'account.workspace.settings', path: 'account', mount: 'router' }),
    ]);
    expect(workspace.navigation).toEqual([
      expect.objectContaining({
        label: 'Mon compte',
        iconId: 'user',
        testId: 'nav-sidebar-profile-link',
      }),
    ]);
    expect(portal.routes).toEqual([
      expect.objectContaining({ path: 'account/profile', mount: 'host' }),
    ]);
  });

  it('rejette les modules, features et chemins dupliqués', () => {
    const manifest = moduleManifest();
    const contribution = surfaceContribution();

    expect(() => createContributionRegistry({ manifests: [manifest, manifest], contributions: [] }))
      .toThrow(ContributionRegistryError);
    expect(() => createContributionRegistry({
      manifests: [manifest],
      contributions: [contribution, { ...contribution, moduleId: 'probe' }],
    })).toThrow(/Doublon de route/);
  });

  it('rejette une feature inconnue et une surface non déclarée', () => {
    const manifest = moduleManifest();
    const contribution = surfaceContribution();
    const unknownFeature = {
      ...contribution,
      routes: [{ ...contribution.routes[0], featureId: 'probe.unknown' }],
    };
    const wrongSurface = {
      ...contribution,
      surface: 'backoffice' as const,
      routes: contribution.routes.map((route) => ({ ...route, surface: 'backoffice' as const })),
      navigation: [],
    };

    expect(() => createContributionRegistry({ manifests: [manifest], contributions: [unknownFeature] }))
      .toThrow(/feature inconnue/);
    expect(() => createContributionRegistry({ manifests: [manifest], contributions: [wrongSurface] }))
      .toThrow(/ne déclare pas la surface backoffice/);
  });
});

function moduleManifest() {
  return defineModuleManifest({
    id: 'probe',
    name: 'Probe',
    features: [{ id: 'probe.read', description: 'Lire.' }],
    capabilities: [],
    surfaces: ['workspace'],
  } as const);
}

function surfaceContribution() {
  return defineSurfaceContribution({
    moduleId: 'probe',
    surface: 'workspace',
    routes: [{
      id: 'probe.workspace',
      moduleId: 'probe',
      featureId: 'probe.read',
      surface: 'workspace',
      path: 'probe',
      mount: 'router',
    }],
    navigation: [],
  } as const);
}
