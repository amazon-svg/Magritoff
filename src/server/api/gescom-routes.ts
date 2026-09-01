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
import type { GescomRoute } from './gescom-middleware.ts';

/**
 * Routes montees sur la facade E10.
 *
 * Vide en E10.0 : le socle ne publie aucun endpoint. Les stories E10.1 a
 * E10.21 remplacent ce tableau par la concatenation de leurs fabriques, ex. :
 *
 *     export function gescomRoutes(services: GescomServices): readonly GescomRoute[] {
 *       return [...createCustomersRoutes(services.customers)];
 *     }
 */
export const GESCOM_ROUTES: readonly GescomRoute[] = Object.freeze([]);
