/**
 * REGISTRE des routes de la facade Gestion commerciale (Epic E10).
 *
 * ------------------------------------------------------------------------
 * POURQUOI CE FICHIER EXISTE
 * ------------------------------------------------------------------------
 * Sans lui, rien ne reliait une route ecrite en code a une entree reelle de
 * `openapi/magrit-core.v1.yaml`. Un dev-story pouvait ecrire
 *
 *     defineGescomRoute({ operationId: 'createCustomer', path: '/customers', ... })
 *
 * sans jamais toucher au contrat, et `pnpm typecheck`, `test:architecture`,
 * `gen:api:check` et `test:contract` restaient tous verts : le lint ne voyait
 * que le document, jamais les routes declarees. Le CA1 — « aucun endpoint
 * implemente sans etre decrit avant » — n etait donc verifie par personne.
 *
 * ------------------------------------------------------------------------
 * CE QUE TOUTE STORY E10.x DOIT FAIRE
 * ------------------------------------------------------------------------
 * 1. Decrire l operation dans `openapi/magrit-core.v1.yaml` (agent architecte).
 * 2. `pnpm gen:api` et committer le fichier genere.
 * 3. Ecrire ses routes dans `src/server/api/<domaine>-routes.ts`.
 * 4. LES ENREGISTRER ICI.
 *
 * L etape 4 n est pas une formalite : `tests/contract/gescom-routes.contract.test.ts`
 * verifie que chaque route enregistree correspond a un
 * `paths[<chemin>][<methode>].operationId` du contrat, et
 * `tests/architecture/gescom-api-socle-boundaries.test.ts` verifie qu aucun
 * fichier de routes n echappe au registre. Oublier l une ou l autre fait
 * echouer la CI.
 */
import type { CustomersService } from '../../modules/customers/application/customers-service.ts';
import type { CustomerContactShopAccessService } from '../../modules/shop-customers/application/customer-contact-shop-access-service.ts';
import type { ProjectsService } from '../../modules/projects/application/projects-service.ts';
import type { ProjectTagsService } from '../../modules/project-tags/application/project-tags-service.ts';
import type { CommercialQuotesService } from '../../modules/commercial-quotes/application/commercial-quotes-service.ts';
import type { PriceRulesService } from '../../modules/pricing/application/price-rules-service.ts';
import type { CommercialSettingsService } from '../../modules/commercial-settings/application/commercial-settings-service.ts';
import type { StorefrontQuotesService } from '../../modules/storefront-quotes/application/storefront-quotes-service.ts';
import type { CommercialOrdersService } from '../../modules/commercial-orders/application/commercial-orders-service.ts';
import type { ProductionStepsService } from '../../modules/production-steps/application/production-steps-service.ts';
import type { DocumentTemplatesService } from '../../modules/document-templates/application/document-templates-service.ts';
import type { QuoteDocumentsService } from '../../modules/quote-documents/application/quote-documents-service.ts';
import type { OrderFilesService } from '../../modules/order-files/application/order-files-service.ts';
import type { OrderUploadLinksService } from '../../modules/order-upload-links/application/order-upload-links-service.ts';
import type { NotificationTemplatesService } from '../../modules/notifications/application/notification-templates-service.ts';
import { createCustomersRoutes } from './customers-routes.ts';
import { createCustomerShopAccessRoutes } from './customer-shop-access-routes.ts';
import { createProjectsRoutes } from './projects-routes.ts';
import { createProjectTagsRoutes } from './project-tags-routes.ts';
import { createCommercialQuotesRoutes } from './commercial-quotes-routes.ts';
import { createPriceRulesRoutes } from './price-rules-routes.ts';
import { createCommercialSettingsRoutes } from './commercial-settings-routes.ts';
import { createStorefrontQuotesRoutes } from './storefront-quotes-routes.ts';
import { createCommercialOrdersRoutes } from './commercial-orders-routes.ts';
import { createProductionStepsRoutes } from './production-steps-routes.ts';
import { createDocumentTemplatesRoutes } from './document-templates-routes.ts';
import { createQuoteDocumentsRoutes } from './quote-documents-routes.ts';
import { createOrderFilesRoutes } from './order-files-routes.ts';
import { createOrderUploadLinksRoutes } from './order-upload-links-routes.ts';
import { createNotificationTemplatesRoutes } from './notification-templates-routes.ts';
import type { GescomRoute } from './gescom-middleware.ts';

/**
 * Services metier requis par les routes enregistrees ici. Une story E10.x
 * ajoute son propre champ ; `gescomRoutes()` grossit d autant.
 */
export type GescomServices = Readonly<{
  customers: CustomersService;
  /** E10.5 — ouverture/revocation d un acces boutique depuis un interlocuteur. */
  customerShopAccess: CustomerContactShopAccessService;
  /** E10.1 — conteneur de travail Projets, en remplacement du panier. */
  projects: ProjectsService;
  /** E10.2 — tags libres colores sur les projets, crees a la volee. */
  projectTags: ProjectTagsService;
  /** E10.3 — creation d un devis depuis un projet (selection multi-produits). */
  commercialQuotes: CommercialQuotesService;
  /** E10.6 — referentiel des regles de prix et marge publique standard par gamme. */
  priceRules: PriceRulesService;
  /** E10.10a — reglages commerciaux du tenant (validite par defaut des devis). */
  commercialSettings: CommercialSettingsService;
  /**
   * E10.10b-1 — lecture des devis mis a disposition du client dans sa
   * boutique (`ShopCustomerPrincipal`, troisieme mode d authentification).
   */
  storefrontQuotes: StorefrontQuotesService;
  /** E10.12 — « bouton Valider » : transformation d un devis en commande, lecture des commandes. */
  commercialOrders: CommercialOrdersService;
  /** E10.13 — referentiel des etapes de production du tenant, configurable et ordonnancable. */
  productionSteps: ProductionStepsService;
  /** E10.10b-4a — import et stockage du gabarit PDF par tenant (fond apporte par l imprimeur). */
  documentTemplates: DocumentTemplatesService;
  /** E10.10b-4c — document PDF produit a l envoi (moteur de generation + lecture atelier/portail). */
  quoteDocuments: QuoteDocumentsService;
  /** E10.17a — fichiers de commande (depot, visibilite, suppression). */
  orderFiles: OrderFilesService;
  /** E10.20a — liens publics de depot (quatrieme mode d authentification, socle uniquement). */
  orderUploadLinks: OrderUploadLinksService;
  /** E10.15a — socle configurable des notifications multicanal (catalogue, modeles, apercu). Aucun envoi. */
  notificationTemplates: NotificationTemplatesService;
}>;

/**
 * Compose les routes de tous les modules E10.x montes sur la facade.
 *
 * E10.4 est la premiere story a la remplir (module Clients). Les stories
 * suivantes concatenent leur propre fabrique de routes ici.
 */
export function gescomRoutes(services: GescomServices): readonly GescomRoute[] {
  return [
    ...createCustomersRoutes(services.customers),
    ...createCustomerShopAccessRoutes(services.customers, services.customerShopAccess),
    ...createProjectsRoutes(services.projects),
    ...createProjectTagsRoutes(services.projectTags),
    ...createCommercialQuotesRoutes(services.commercialQuotes),
    ...createPriceRulesRoutes(services.priceRules),
    ...createCommercialSettingsRoutes(services.commercialSettings),
    ...createStorefrontQuotesRoutes(services.storefrontQuotes),
    ...createCommercialOrdersRoutes(services.commercialOrders, services.commercialQuotes, services.productionSteps),
    ...createProductionStepsRoutes(services.productionSteps),
    ...createDocumentTemplatesRoutes(services.documentTemplates),
    ...createQuoteDocumentsRoutes(services.quoteDocuments, services.commercialQuotes),
    ...createOrderFilesRoutes(services.orderFiles),
    ...createOrderUploadLinksRoutes(services.orderUploadLinks),
    ...createNotificationTemplatesRoutes(services.notificationTemplates),
  ];
}

/**
 * Routes montees sur la facade E10, dans leur configuration de production.
 * Conserve pour compatibilite avec le harnais de tests qui inspecte le
 * registre sans construire de services (`tests/contract/gescom-routes.contract.test.ts`,
 * `tests/architecture/gescom-api-socle-boundaries.test.ts`) : ces routes ne
 * different pas selon l instance de service injectee, seule leur DEFINITION
 * (chemin, operationId, scopes) compte pour ces tests.
 */
export const GESCOM_ROUTES: readonly GescomRoute[] = Object.freeze(
  gescomRoutes({
    customers: createNullCustomersService(),
    customerShopAccess: createNullService('CustomerContactShopAccessService'),
    projects: createNullService('ProjectsService'),
    projectTags: createNullService('ProjectTagsService'),
    commercialQuotes: createNullService('CommercialQuotesService'),
    priceRules: createNullService('PriceRulesService'),
    commercialSettings: createNullService('CommercialSettingsService'),
    storefrontQuotes: createNullService('StorefrontQuotesService'),
    commercialOrders: createNullService('CommercialOrdersService'),
    productionSteps: createNullService('ProductionStepsService'),
    documentTemplates: createNullService('DocumentTemplatesService'),
    quoteDocuments: createNullService('QuoteDocumentsService'),
    orderFiles: createNullService('OrderFilesService'),
    orderUploadLinks: createNullService('OrderUploadLinksService'),
    notificationTemplates: createNullService('NotificationTemplatesService'),
  }),
);

/**
 * Service factice pour la seule fin d enumerer les DEFINITIONS de routes
 * (chemin/operationId/scopes) sans dependance a Supabase. Aucune de ses
 * methodes n est jamais executee : `GESCOM_ROUTES` n est utilise que par les
 * tests de contrat et d architecture, jamais pour servir une vraie requete
 * (la composition applicative reelle appelle `gescomRoutes()` avec le service
 * Supabase, voir src/server/api/composition.ts / l edge function).
 */
function createNullCustomersService(): CustomersService {
  return createNullService('CustomersService');
}

/** Meme principe que `createNullCustomersService`, generalise aux services ajoutes depuis E10.5. */
function createNullService<T>(serviceName: string): T {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(
          `GESCOM_ROUTES est un registre de DEFINITIONS pour les tests de contrat/architecture ; ` +
            `il ne doit jamais executer de handler. Utiliser gescomRoutes({ ... }) avec un ${serviceName} ` +
            'reel pour servir une requete.',
        );
      },
    },
  ) as T;
}
