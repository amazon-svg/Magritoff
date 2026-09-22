export type ConfiguratorViewMode = 'home' | 'split' | 'studio' | 'pim';

export type InitialConfiguratorRequest = Readonly<{
  id: string;
  query: string;
  submittedAt: string;
}>;

export type ConfiguratorWorkspaceState = Readonly<{
  mode: ConfiguratorViewMode;
  initialRequest: InitialConfiguratorRequest | null;
  projectId: string | null;
  customerName: string | null;
  projectName: string | null;
  pimQuery: string;
}>;

export type ConfiguratorWorkspaceAction =
  | Readonly<{ type: 'submit'; request: InitialConfiguratorRequest }>
  | Readonly<{ type: 'select-project'; projectId: string; customerName: string; projectName: string }>
  | Readonly<{ type: 'change-project' }>
  | Readonly<{ type: 'focus-studio' }>
  | Readonly<{ type: 'focus-pim' }>
  | Readonly<{ type: 'show-split' }>
  | Readonly<{ type: 'search-pim'; query: string }>;

export const INITIAL_CONFIGURATOR_WORKSPACE_STATE: ConfiguratorWorkspaceState = {
  mode: 'home',
  initialRequest: null,
  projectId: null,
  customerName: null,
  projectName: null,
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
        projectId: state.projectId,
        customerName: state.customerName,
        projectName: state.projectName,
        pimQuery: action.request.query,
      };
    case 'select-project':
      return {
        ...state,
        mode: 'home',
        projectId: action.projectId,
        customerName: action.customerName,
        projectName: action.projectName,
        initialRequest: createInitialConfiguratorRequest(''),
      };
    case 'change-project':
      return INITIAL_CONFIGURATOR_WORKSPACE_STATE;
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
