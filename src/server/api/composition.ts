import { systemClock, type Clock } from '../../kernel';
import { createApiV1Handler, type ActorResolver } from './api-v1-handler';
import { createHealthRoute } from './routes';

export type ApiV1ApplicationDependencies = Readonly<{
  actorResolver?: ActorResolver;
  clock?: Clock;
  requestIdFactory?: () => string;
  onUnexpectedError?: (error: unknown, requestId: string) => void;
}>;

export function createApiV1Application(dependencies: ApiV1ApplicationDependencies = {}) {
  const clock = dependencies.clock ?? systemClock;
  return createApiV1Handler({
    routes: [createHealthRoute(clock)],
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
