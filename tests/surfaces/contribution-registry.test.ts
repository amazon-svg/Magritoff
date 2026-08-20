import { describe, expect, it } from 'vitest';
import { accountModuleManifest } from '../../src/modules/account';
import { ordersModuleManifest } from '../../src/modules/orders';
import { shopsModuleManifest } from '../../src/modules/shops';
import { quotesModuleManifest } from '../../src/modules/quotes';
import { quoteTemplatesModuleManifest } from '../../src/modules/quote-templates';
import { librariesModuleManifest } from '../../src/modules/libraries';
import { catalogModuleManifest } from '../../src/modules/catalog';
import { commercialModuleManifest } from '../../src/modules/commercial';
import { membersModuleManifest } from '../../src/modules/members';
import { tenantsModuleManifest } from '../../src/modules/tenants';
import { rolesModuleManifest } from '../../src/modules/roles';
import { conversationsModuleManifest } from '../../src/modules/conversations';
import { machineParksModuleManifest } from '../../src/modules/machine-parks';
import { mockupsModuleManifest } from '../../src/modules/mockups';
import { plansModuleManifest } from '../../src/modules/plans';
import { shopCustomersModuleManifest } from '../../src/modules/shop-customers';
import { applicationContributionRegistry } from '../../src/surfaces';
import {
  ContributionRegistryError,
  createContributionRegistry,
  defineModuleManifest,
  defineSurfaceContribution,
} from '../../src/surfaces/registry';

describe('registre des contributions de surfaces', () => {
  const manifests = [
    accountModuleManifest,
    ordersModuleManifest,
    shopsModuleManifest,
    shopCustomersModuleManifest,
    quotesModuleManifest,
    quoteTemplatesModuleManifest,
    librariesModuleManifest,
    catalogModuleManifest,
    commercialModuleManifest,
    membersModuleManifest,
    tenantsModuleManifest,
    rolesModuleManifest,
    conversationsModuleManifest,
    machineParksModuleManifest,
    mockupsModuleManifest,
    plansModuleManifest,
  ];

  it('expose les quatre composition roots même lorsqu ils sont encore vides', () => {
    expect(applicationContributionRegistry.surfaces().map(({ id }) => id)).toEqual([
      'storefront',
      'customer-portal',
      'workspace',
      'backoffice',
    ]);
  });

  it('matérialise chaque surface déclarée par chaque module', () => {
    for (const manifest of manifests) {
      for (const surface of manifest.surfaces) {
        expect(
          applicationContributionRegistry.forSurface(surface).modules.map(({ id }) => id),
          `${manifest.id} doit contribuer à ${surface}`,
        ).toContain(manifest.id);
      }
    }
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
    expect(applicationContributionRegistry.forSurface('storefront').routes).toContainEqual(expect.objectContaining({ id: 'orders.storefront.confirmation', path: 'thank-you', mount: 'host' }));
    expect(applicationContributionRegistry.forSurface('customer-portal').routes).toContainEqual(expect.objectContaining({ id: 'orders.customer-portal.list', path: 'account/orders', mount: 'host' }));
    expect(applicationContributionRegistry.forSurface('workspace').routes).toContainEqual(expect.objectContaining({ id: 'orders.workspace.list', path: 'orders', mount: 'router' }));
    expect(applicationContributionRegistry.forSurface('backoffice').plannedRoutes).toContainEqual(expect.objectContaining({ id: 'orders.backoffice.production', availability: 'planned', requiredCapabilities: ['orders.transition'] }));
  });

  it('compose Shops sur storefront, workspace et backoffice', () => {
    expect(shopsModuleManifest.surfaces).toEqual(['storefront', 'workspace', 'backoffice']);
    expect(applicationContributionRegistry.forSurface('storefront').routes).toContainEqual(expect.objectContaining({ id: 'shops.storefront.root', mount: 'host' }));
    expect(applicationContributionRegistry.forSurface('workspace').routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'shops.workspace.list', path: 'shops' }),
      expect.objectContaining({ id: 'shops.workspace.edit', path: 'shops/:id' }),
    ]));
    expect(applicationContributionRegistry.forSurface('backoffice').plannedRoutes).toContainEqual(expect.objectContaining({ id: 'shops.backoffice.list', availability: 'planned', requiredCapabilities: ['shops.govern'] }));
  });

  it('compose Quotes sur les quatre surfaces', () => {
    expect(quotesModuleManifest.surfaces).toEqual(['storefront', 'customer-portal', 'workspace', 'backoffice']);
    expect(applicationContributionRegistry.forSurface('customer-portal').routes).toContainEqual(expect.objectContaining({ id: 'quotes.customer-portal.list', path: 'account/quotes' }));
    expect(applicationContributionRegistry.forSurface('storefront').routes).not.toContainEqual(expect.objectContaining({ id: 'quotes.storefront.create' }));
    expect(applicationContributionRegistry.forSurface('storefront').plannedRoutes).toContainEqual(expect.objectContaining({ id: 'quotes.storefront.create', path: 'quote', availability: 'planned' }));
    expect(applicationContributionRegistry.forSurface('workspace').routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'quotes.workspace.list', path: 'quotes' }),
      expect.objectContaining({ id: 'quotes.workspace.pending', path: 'quotes/pending' }),
      expect.objectContaining({ id: 'quotes.workspace.edit', path: 'quotes/:id/edit' }),
    ]));
    expect(applicationContributionRegistry.forSurface('workspace').navigation).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'quotes.workspace.navigation', exact: true }),
      expect.objectContaining({ id: 'quotes.workspace.pending-navigation', nested: true }),
    ]));
    expect(applicationContributionRegistry.forSurface('backoffice').plannedRoutes).toContainEqual(expect.objectContaining({ id: 'quotes.backoffice.pending', availability: 'planned', requiredCapabilities: ['quotes.validate'] }));
  });

  it('n expose aucune route ou navigation backoffice avant son composition root', () => {
    const backoffice = applicationContributionRegistry.forSurface('backoffice');

    expect(backoffice.routes).toEqual([]);
    expect(backoffice.navigation).toEqual([]);
    expect(backoffice.plannedRoutes.map(({ id }) => id)).toEqual([
      'orders.backoffice.production',
      'shops.backoffice.list',
      'shop-customers.backoffice.accounts',
      'quotes.backoffice.pending',
    ]);
    expect(backoffice.plannedNavigation.map(({ routeId }) => routeId)).toEqual([
      'quotes.backoffice.pending',
      'orders.backoffice.production',
      'shops.backoffice.list',
      'shop-customers.backoffice.accounts',
    ]);
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

  it('compose la consultation Catalog sur storefront et sa gestion sur workspace', () => {
    expect(catalogModuleManifest.surfaces).toEqual(['storefront', 'workspace']);
    expect(applicationContributionRegistry.forSurface('storefront').routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'catalog.storefront.list', path: 'catalog', mount: 'host' }),
      expect.objectContaining({ id: 'catalog.storefront.gamme', path: 'g/:gammeSlug', mount: 'host' }),
      expect.objectContaining({ id: 'catalog.storefront.product', path: 'p/:productId', mount: 'host' }),
    ]));
    expect(applicationContributionRegistry.forSurface('workspace').routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'catalog.workspace.gammes', path: 'gammes' }),
      expect.objectContaining({ id: 'catalog.workspace.pim', path: 'admin/pim' }),
    ]));
    expect(applicationContributionRegistry.forSurface('workspace').navigation).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'catalog.workspace.pim-navigation', label: 'PIM — Produits' }),
      expect.objectContaining({ id: 'catalog.workspace.gammes-navigation', label: 'Gammes actives' }),
    ]));
  });

  it('limite la gestion Commercial au workspace', () => {
    expect(commercialModuleManifest.surfaces).toEqual(['workspace']);
    expect(applicationContributionRegistry.forSurface('workspace').routes).toContainEqual(
      expect.objectContaining({ id: 'commercial.workspace.pricing', path: 'commercial' }),
    );
    expect(applicationContributionRegistry.forSurface('workspace').navigation).toContainEqual(
      expect.objectContaining({ id: 'commercial.workspace.navigation', label: 'Prix & marges' }),
    );
  });

  it('limite les utilisateurs Magrit au workspace', () => {
    expect(membersModuleManifest.surfaces).toEqual(['workspace']);
    expect(applicationContributionRegistry.forSurface('workspace').routes).toContainEqual(
      expect.objectContaining({ id: 'members.workspace.list', path: 'users' }),
    );
    expect(applicationContributionRegistry.forSurface('workspace').navigation).toContainEqual(
      expect.objectContaining({
        id: 'members.workspace.navigation',
        label: 'Utilisateurs',
        testId: 'nav-sidebar-users-link',
      }),
    );
  });

  it('déclare les comptes boutique comme un module distinct des membres Magrit', () => {
    expect(shopCustomersModuleManifest.surfaces).toEqual([
      'storefront', 'customer-portal', 'workspace', 'backoffice',
    ]);
    expect(shopCustomersModuleManifest.id).not.toBe(membersModuleManifest.id);
    expect(shopCustomersModuleManifest.capabilities.map(({ id }) => id)).toContain(
      'shop-customers.delegate',
    );
    expect(applicationContributionRegistry.manifest('shop-customers')).toBe(
      shopCustomersModuleManifest,
    );
    expect(applicationContributionRegistry.forSurface('storefront').routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'shop-customers.storefront.activate', path: 'activate' }),
        expect.objectContaining({ id: 'shop-customers.storefront.reset-password', path: 'reset-password' }),
      ]),
    );
    expect(applicationContributionRegistry.forSurface('backoffice').plannedRoutes).toContainEqual(
      expect.objectContaining({
        id: 'shop-customers.backoffice.accounts',
        availability: 'planned',
        requiredCapabilities: ['shop-customers.manage'],
      }),
    );
  });

  it('limite la gestion des espaces au workspace', () => {
    expect(tenantsModuleManifest.surfaces).toEqual(['workspace']);
    expect(applicationContributionRegistry.forSurface('workspace').routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'tenants.workspace.settings', path: 'settings' }),
      expect.objectContaining({ id: 'tenants.workspace.spaces', path: 'spaces' }),
    ]));
    expect(applicationContributionRegistry.forSurface('workspace').navigation).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'tenants.workspace.settings-navigation', label: "Paramètres de l'espace" }),
      expect.objectContaining({ id: 'tenants.workspace.spaces-navigation', label: 'Sous-espaces', nested: true }),
    ]));
  });

  it('limite la gestion des rôles au workspace', () => {
    expect(rolesModuleManifest.surfaces).toEqual(['workspace']);
    expect(applicationContributionRegistry.forSurface('workspace').routes).toContainEqual(
      expect.objectContaining({ id: 'roles.workspace.workflow', path: 'order-roles' }),
    );
    expect(applicationContributionRegistry.forSurface('workspace').navigation).toContainEqual(
      expect.objectContaining({ id: 'roles.workspace.navigation', label: 'Workflow & rôles' }),
    );
  });

  it('limite l historique des conversations au workspace', () => {
    expect(conversationsModuleManifest.surfaces).toEqual(['workspace']);
    expect(applicationContributionRegistry.forSurface('workspace').routes).toContainEqual(
      expect.objectContaining({ id: 'conversations.workspace.history', path: 'history' }),
    );
    expect(applicationContributionRegistry.forSurface('workspace').navigation).toContainEqual(
      expect.objectContaining({ id: 'conversations.workspace.navigation', label: 'Historique' }),
    );
  });

  it('limite les parcs machine au workspace', () => {
    expect(machineParksModuleManifest.surfaces).toEqual(['workspace']);
    expect(applicationContributionRegistry.forSurface('workspace').routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'machine-parks.workspace.list', path: 'machines' }),
      expect.objectContaining({ id: 'machine-parks.workspace.wizard', path: 'machines/wizard' }),
      expect.objectContaining({ id: 'machine-parks.workspace.detail', path: 'machines/:parkId' }),
    ]));
    expect(applicationContributionRegistry.forSurface('workspace').navigation).toContainEqual(
      expect.objectContaining({ id: 'machine-parks.workspace.navigation', label: 'Parc machine' }),
    );
  });

  it('limite la galerie Mockups au workspace actuel', () => {
    expect(mockupsModuleManifest.surfaces).toEqual(['workspace']);
    expect(applicationContributionRegistry.forSurface('workspace').routes).toContainEqual(
      expect.objectContaining({ id: 'mockups.workspace.reference', path: 'admin/mockups' }),
    );
    expect(applicationContributionRegistry.forSurface('workspace').navigation).toContainEqual(
      expect.objectContaining({ id: 'mockups.workspace.navigation', label: 'Visuels Magrit' }),
    );
  });

  it('limite le sélecteur de Plans au workspace', () => {
    expect(plansModuleManifest.surfaces).toEqual(['workspace']);
    expect(applicationContributionRegistry.forSurface('workspace').routes).toContainEqual(
      expect.objectContaining({ id: 'plans.workspace.selection', path: 'plan' }),
    );
    expect(applicationContributionRegistry.forSurface('workspace').navigation).toContainEqual(
      expect.objectContaining({ id: 'plans.workspace.navigation', label: 'Plan & abonnement' }),
    );
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
