export type ConfiguratorViewMode = 'home' | 'split' | 'studio' | 'pim';

export type InitialConfiguratorRequest = Readonly<{
  id: string;
  query: string;
  submittedAt: string;
}>;

export type ConfiguratorWorkspaceState = Readonly<{
  mode: ConfiguratorViewMode;
  initialRequest: InitialConfiguratorRequest | null;
  pimQuery: string;
}>;

export type ConfiguratorWorkspaceAction =
  | Readonly<{ type: 'submit'; request: InitialConfiguratorRequest }>
  | Readonly<{ type: 'focus-studio' }>
  | Readonly<{ type: 'focus-pim' }>
  | Readonly<{ type: 'show-split' }>
  | Readonly<{ type: 'search-pim'; query: string }>;

export const INITIAL_CONFIGURATOR_WORKSPACE_STATE: ConfiguratorWorkspaceState = {
  mode: 'home',
  initialRequest: null,
  pimQuery: '',
};

export function configuratorWorkspaceReducer(
  state: ConfiguratorWorkspaceState,
  action: ConfiguratorWorkspaceAction,
): ConfiguratorWorkspaceState {
  switch (action.type) {
    case 'submit':
      return {
        mode: 'split',
        initialRequest: action.request,
        pimQuery: action.request.query,
      };
    case 'focus-studio':
      return state.initialRequest ? { ...state, mode: 'studio' } : state;
    case 'focus-pim':
      return state.initialRequest ? { ...state, mode: 'pim' } : state;
    case 'show-split':
      return state.initialRequest ? { ...state, mode: 'split' } : state;
    case 'search-pim':
      return { ...state, pimQuery: action.query };
  }
}

export function createInitialConfiguratorRequest(query: string): InitialConfiguratorRequest {
  return {
    id: crypto.randomUUID(),
    query: query.trim(),
    submittedAt: new Date().toISOString(),
  };
}
