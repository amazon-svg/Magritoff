/**
 * Routeur des deux facades `/api/v1` (montage du socle E10.0).
 *
 * ------------------------------------------------------------------------
 * POURQUOI CE FICHIER EXISTE
 * ------------------------------------------------------------------------
 * `createGescomApiHandler` etait ecrit, teste, et monte NULLE PART. Le seul
 * serveur qui repond sur `/api/v1/*` — l edge function `magrit-api` —
 * composait exclusivement la facade historique. Les endpoints E10 existaient
 * donc en memoire, dans les tests, et dans aucun processus joignable : ni en
 * local, ni en production.
 *
 * Ce routeur les met en ligne. Il place devant les deux facades un aiguillage
 * qui choisit d apres le CHEMIN :
 *
 *   - le chemin correspond a une route declaree dans `GESCOM_ROUTES`
 *     -> facade E10 (`createGescomApiHandler`), enveloppe `{ data, meta }` ;
 *   - sinon -> facade historique (`createApiV1Application`), inchangee.
 *
 * ------------------------------------------------------------------------
 * AIGUILLAGE PAR CHEMIN, PAS PAR CHEMIN + METHODE
 * ------------------------------------------------------------------------
 * Un chemin appartient a UNE facade, avec toutes ses methodes. Si l on
 * aiguillait sur le couple (chemin, methode), un `DELETE /api/v1/customers`
 * non declare retomberait sur la facade historique, qui repondrait 404 dans
 * SON format d erreur — un client E10 recevrait un `requestId` camelCase la ou
 * il attend un `request_id`. En aiguillant sur le chemin seul, la facade E10
 * repond elle-meme 405 dans son propre format. La frontiere reste nette.
 *
 * ------------------------------------------------------------------------
 * COLLISIONS
 * ------------------------------------------------------------------------
 * Deux facades qui se partagent un espace d URL peuvent se recouvrir. Un
 * recouvrement rendrait une route historique injoignable, en silence, en
 * production. `createApiFacadeRouter` le refuse AU DEMARRAGE : l edge function
 * ne boote pas plutot que de servir une API amputee.
 */
import { compilePathTemplate } from './api-v1-handler.ts';
import type { GescomRoute } from './gescom-middleware.ts';
import type { ApiRoute } from './routes.ts';

export type ApiFacadeHandler = (request: Request) => Promise<Response>;

export type ApiFacadeRouterOptions = Readonly<{
  gescom: Readonly<{
    /** Definitions montees sur la facade E10 — sert a reconnaitre ses chemins. */
    routes: readonly GescomRoute[];
    handle: ApiFacadeHandler;
  }>;
  legacy: Readonly<{
    /** Routes historiques, fournies pour la detection de collision. */
    routes: readonly ApiRoute[];
    handle: ApiFacadeHandler;
  }>;
}>;

export function createApiFacadeRouter(options: ApiFacadeRouterOptions): ApiFacadeHandler {
  assertNoFacadeCollision(options.gescom.routes, options.legacy.routes);

  const gescomMatchers = uniquePaths(options.gescom.routes).map((path) => compilePathTemplate(path));

  return async function route(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    const belongsToGescom = gescomMatchers.some((match) => match(pathname) !== null);
    return belongsToGescom ? options.gescom.handle(request) : options.legacy.handle(request);
  };
}

/**
 * Refuse tout recouvrement entre les chemins des deux facades.
 *
 * Levee au DEMARRAGE, pas a la premiere requete : une route historique rendue
 * injoignable par une route E10 homonyme est une panne silencieuse, du genre
 * qu on ne decouvre qu en production quand un client se plaint.
 */
export function assertNoFacadeCollision(
  gescomRoutes: readonly GescomRoute[],
  legacyRoutes: readonly ApiRoute[],
): void {
  const collisions: string[] = [];
  for (const gescom of uniquePaths(gescomRoutes)) {
    for (const legacy of uniquePaths(legacyRoutes)) {
      if (pathTemplatesOverlap(gescom, legacy)) {
        collisions.push(`${gescom} (E10) recouvre ${legacy} (historique)`);
      }
    }
  }

  if (collisions.length > 0) {
    throw new TypeError(
      `Collision entre les facades API : ${collisions.join(' ; ')}. ` +
        'Un chemin appartient a une seule facade — renommer la ressource E10 ou ' +
        'retirer la route historique avant de monter les deux.',
    );
  }
}

/**
 * Deux gabarits se recouvrent s ils ont le meme nombre de segments et si,
 * pour chaque position, les deux segments peuvent designer la meme valeur.
 * Un parametre (`{id}`) recouvre n importe quel segment litteral.
 */
export function pathTemplatesOverlap(left: string, right: string): boolean {
  const leftSegments = normalize(left).split('/');
  const rightSegments = normalize(right).split('/');
  if (leftSegments.length !== rightSegments.length) return false;

  return leftSegments.every((segment, index) => {
    const other = rightSegments[index] ?? '';
    return isParameter(segment) || isParameter(other) || segment === other;
  });
}

function isParameter(segment: string): boolean {
  return /^\{[A-Za-z][A-Za-z0-9_]*\}$/.test(segment);
}

function normalize(path: string): string {
  return path.replace(/\/+$/, '');
}

function uniquePaths(routes: readonly Readonly<{ path: string }>[]): readonly string[] {
  return [...new Set(routes.map((route) => route.path))];
}
