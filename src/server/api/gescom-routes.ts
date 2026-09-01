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
import { createCustomersRoutes } from './customers-routes.ts';
import { createCustomerShopAccessRoutes } from './customer-shop-access-routes.ts';
import { createProjectsRoutes } from './projects-routes.ts';
import { createProjectTagsRoutes } from './project-tags-routes.ts';
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
