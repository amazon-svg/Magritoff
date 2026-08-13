import { describe, expect, it } from 'vitest';
import { accountModuleManifest } from '../../src/modules/account';
import { ordersModuleManifest } from '../../src/modules/orders';
import { shopsModuleManifest } from '../../src/modules/shops';
import { quotesModuleManifest } from '../../src/modules/quotes';
import { quoteTemplatesModuleManifest } from '../../src/modules/quote-templates';
import { librariesModuleManifest } from '../../src/modules/libraries';
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
    expect(workspace.routes).toContainEqual(
      expect.objectContaining({ id: 'account.workspace.settings', path: 'account', mount: 'router' }),
    );
    expect(workspace.navigation).toContainEqual(
      expect.objectContaining({
        label: 'Mon compte',
        iconId: 'user',
        testId: 'nav-sidebar-profile-link',
      }),
    );
    expect(portal.routes).toContainEqual(
      expect.objectContaining({ path: 'account/profile', mount: 'host' }),
    );
  });

  it('compose Orders sur les quatre surfaces', () => {
    expect(ordersModuleManifest.surfaces).toEqual(['storefront', 'customer-portal', 'workspace', 'backoffice']);
    expect(applicationContributionRegistry.forSurface('storefront').routes).toContainEqual(expect.objectContaining({ id: 'orders.storefront.checkout', path: 'checkout', mount: 'host' }));
    expect(applicationContributionRegistry.forSurface('customer-portal').routes).toContainEqual(expect.objectContaining({ id: 'orders.customer-portal.list', path: 'account/orders', mount: 'host' }));
    expect(applicationContributionRegistry.forSurface('workspace').routes).toContainEqual(expect.objectContaining({ id: 'orders.workspace.list', path: 'orders', mount: 'router' }));
    expect(applicationContributionRegistry.forSurface('backoffice').routes).toContainEqual(expect.objectContaining({ id: 'orders.backoffice.production', requiredCapabilities: ['orders.transition'] }));
  });

  it('compose Shops sur storefront, workspace et backoffice', () => {
    expect(shopsModuleManifest.surfaces).toEqual(['storefront', 'workspace', 'backoffice']);
    expect(applicationContributionRegistry.forSurface('storefront').routes).toContainEqual(expect.objectContaining({ id: 'shops.storefront.root', mount: 'host' }));
    expect(applicationContributionRegistry.forSurface('workspace').routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'shops.workspace.list', path: 'shops' }),
      expect.objectContaining({ id: 'shops.workspace.edit', path: 'shops/:id' }),
    ]));
    expect(applicationContributionRegistry.forSurface('backoffice').routes).toContainEqual(expect.objectContaining({ id: 'shops.backoffice.list', requiredCapabilities: ['shops.govern'] }));
  });

  it('compose Quotes sur les quatre surfaces', () => {
    expect(quotesModuleManifest.surfaces).toEqual(['storefront', 'customer-portal', 'workspace', 'backoffice']);
    expect(applicationContributionRegistry.forSurface('customer-portal').routes).toContainEqual(expect.objectContaining({ id: 'quotes.customer-portal.list', path: 'account/quotes' }));
    expect(applicationContributionRegistry.forSurface('workspace').routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'quotes.workspace.list', path: 'quotes' }),
      expect.objectContaining({ id: 'quotes.workspace.pending', path: 'quotes/pending' }),
      expect.objectContaining({ id: 'quotes.workspace.edit', path: 'quotes/:id/edit' }),
    ]));
    expect(applicationContributionRegistry.forSurface('backoffice').routes).toContainEqual(expect.objectContaining({ id: 'quotes.backoffice.pending', requiredCapabilities: ['quotes.validate'] }));
  });

  it('limite QuoteTemplates au workspace', () => {
    expect(quoteTemplatesModuleManifest.surfaces).toEqual(['workspace']);
    expect(applicationContributionRegistry.forSurface('workspace').routes).toContainEqual(expect.objectContaining({ id: 'quote-templates.workspace.list', path: 'quote-templates' }));
    expect(applicationContributionRegistry.forSurface('backoffice').modules.map(({ id }) => id).includes('quote-templates')).toBe(false);
  });

  it('limite Libraries au workspace', () => {
    expect(librariesModuleManifest.surfaces).toEqual(['workspace']);
    expect(applicationContributionRegistry.forSurface('workspace').routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'libraries.workspace.list', path: 'library' }),
      expect.objectContaining({ id: 'libraries.workspace.detail', path: 'library/:id' }),
    ]));
    expect(applicationContributionRegistry.forSurface('workspace').navigation).toContainEqual(
      expect.objectContaining({ id: 'libraries.workspace.navigation', label: 'Bibliothèques' }),
    );
    expect(applicationContributionRegistry.forSurface('backoffice').modules.map(({ id }) => id).includes('libraries')).toBe(false);
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
