import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { workspaceSurface } from '../../surfaces/workspace';

type PageModule = Readonly<{ default: ComponentType }>;
type LazyPageLoader = () => Promise<PageModule>;

const routeLoaders: Readonly<Record<string, LazyPageLoader>> = Object.freeze({
  'account.workspace.settings': () =>
    import('../components/dashboard/DashboardAccount').then((module) => ({
      default: module.DashboardAccount,
    })),
});

export type WorkspaceRuntimeRoute = Readonly<{
  id: string;
  path: string;
  Component: LazyExoticComponent<ComponentType>;
}>;

export const workspaceRuntimeRoutes: readonly WorkspaceRuntimeRoute[] = workspaceSurface.routes
  .filter((route) => route.mount === 'router')
  .map((route) => {
    const loader = routeLoaders[route.id];
    if (!loader) throw new Error(`Aucun loader lazy pour la route workspace ${route.id}.`);
    return Object.freeze({ id: route.id, path: route.path, Component: lazy(loader) });
  });
