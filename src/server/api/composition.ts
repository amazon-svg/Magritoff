import { systemClock, type Clock } from '../../kernel/clock/index.ts';
import type {
  IdempotencyStore,
  PrincipalVerifier,
} from '../../modules/_shared/application/index.ts';
import { createApiV1Handler, type ActorResolver } from './api-v1-handler.ts';
import { createApiFacadeRouter, type ApiFacadeHandler } from './api-facade-router.ts';
import { createGescomApiHandler } from './gescom-middleware.ts';
import { gescomRoutes, type GescomServices } from './gescom-routes.ts';
import { createHealthRoute, type ApiRoute } from './routes.ts';

export type ApiV1ApplicationDependencies = Readonly<{
  actorResolver?: ActorResolver;
  clock?: Clock;
  requestIdFactory?: () => string;
  onUnexpectedError?: (error: unknown, requestId: string) => void;
  routes?: readonly ApiRoute[];
}>;

export function createApiV1Application(dependencies: ApiV1ApplicationDependencies = {}) {
  const clock = dependencies.clock ?? systemClock;
  return createApiV1Handler({
    routes: [createHealthRoute(clock), ...(dependencies.routes ?? [])],
    ...(dependencies.actorResolver === undefined
      ? {}
      : { actorResolver: dependencies.actorResolver }),
    ...(dependencies.requestIdFactory === undefined
      ? {}
      : { requestIdFactory: dependencies.requestIdFactory }),
    ...(dependencies.onUnexpectedError === undefined
      ? {}
      : { onUnexpectedError: dependencies.onUnexpectedError }),
  });
}

export type MagritApiApplicationDependencies = ApiV1ApplicationDependencies &
  Readonly<{
    /** Services metier des modules E10 montes sur la facade Gestion commerciale. */
    gescomServices: GescomServices;
    /** Resolution acteur + tenant depuis le jeton (CA4, CA5 du socle E10.0). */
    principalVerifier: PrincipalVerifier;
    /** Support des cles `Idempotency-Key` (CA8). */
    idempotencyStore: IdempotencyStore;
  }>;

/**
 * Point de composition UNIQUE de l API `/api/v1`, les deux facades montees.
 *
 * C est ce que l edge function appelle. Elle n a plus a savoir qu il existe
 * deux facades ni comment on aiguille entre elles : elle fournit ses services
 * et recoit un handler.
 *
 * Toute collision de chemin entre les deux facades fait echouer cet appel,
 * donc le demarrage de la fonction — voir `assertNoFacadeCollision`.
 */
export function createMagritApiApplication(
  dependencies: MagritApiApplicationDependencies,
): ApiFacadeHandler {
  const legacyRoutes = dependencies.routes ?? [];
  const legacyHandler = createApiV1Application(dependencies);
  const routes = gescomRoutes(dependencies.gescomServices);

  const gescomHandler = createGescomApiHandler({
    routes,
    principalVerifier: dependencies.principalVerifier,
    idempotencyStore: dependencies.idempotencyStore,
    ...(dependencies.clock === undefined ? {} : { clock: dependencies.clock }),
    ...(dependencies.requestIdFactory === undefined
      ? {}
      : { requestIdFactory: dependencies.requestIdFactory }),
    ...(dependencies.onUnexpectedError === undefined
      ? {}
      : { onUnexpectedError: dependencies.onUnexpectedError }),
  });

  return createApiFacadeRouter({
    gescom: { routes, handle: gescomHandler },
    // `createApiV1Application` ajoute /api/v1/health aux routes fournies : la
    // detection de collision doit voir la meme liste que le handler, sinon une
    // route E10 nommee /health passerait au travers.
    legacy: { routes: [createHealthRoute(dependencies.clock ?? systemClock), ...legacyRoutes], handle: legacyHandler },
  });
}
