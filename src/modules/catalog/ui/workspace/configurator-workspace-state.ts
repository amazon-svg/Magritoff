export type ConfiguratorViewMode = 'home' | 'studio';

export type InitialConfiguratorRequest = Readonly<{
  id: string;
  query: string;
  submittedAt: string;
}>;

export type ConfiguratorWorkspaceState = Readonly<{
  mode: ConfiguratorViewMode;
  initialRequest: InitialConfiguratorRequest | null;
  projectId: string | null;
  hopstudioSessionId: string | null;
  customerName: string | null;
  projectName: string | null;
}>;

export type ConfiguratorWorkspaceAction =
  | Readonly<{ type: 'submit'; request: InitialConfiguratorRequest }>
  | Readonly<{ type: 'select-project'; projectId: string; customerName: string; projectName: string; hopstudioSessionId: string | null }>
  | Readonly<{ type: 'rename-project'; projectName: string }>
  | Readonly<{ type: 'change-project' }>;

export const INITIAL_CONFIGURATOR_WORKSPACE_STATE: ConfiguratorWorkspaceState = {
  mode: 'home',
  initialRequest: null,
  projectId: null,
  hopstudioSessionId: null,
  customerName: null,
  projectName: null,
};

function createResumeConfiguratorRequest(
  projectId: string,
  sessionId: string,
): InitialConfiguratorRequest {
  return {
    id: `resume:${projectId}:${sessionId}`,
    query: '',
    submittedAt: '',
  };
}

export function createInitialConfiguratorWorkspaceState(
  tenantId: string,
): ConfiguratorWorkspaceState {
  if (typeof window === 'undefined') return INITIAL_CONFIGURATOR_WORKSPACE_STATE;
  try {
    const raw = window.sessionStorage.getItem(`magrit-configurator-selection:${tenantId}`);
    if (!raw) return INITIAL_CONFIGURATOR_WORKSPACE_STATE;
    const selection = JSON.parse(raw) as Partial<ConfiguratorWorkspaceState>;
    if (typeof selection.projectId !== 'string' || typeof selection.projectName !== 'string') {
      return INITIAL_CONFIGURATOR_WORKSPACE_STATE;
    }
    const hopstudioSessionId = typeof selection.hopstudioSessionId === 'string'
      ? selection.hopstudioSessionId
      : null;
    return {
      ...INITIAL_CONFIGURATOR_WORKSPACE_STATE,
      mode: hopstudioSessionId ? 'studio' : 'home',
      initialRequest: hopstudioSessionId
        ? createResumeConfiguratorRequest(selection.projectId, hopstudioSessionId)
        : null,
      projectId: selection.projectId,
      customerName: typeof selection.customerName === 'string' ? selection.customerName : null,
      projectName: selection.projectName,
      hopstudioSessionId,
    };
  } catch {
    return INITIAL_CONFIGURATOR_WORKSPACE_STATE;
  }
}

export function configuratorWorkspaceReducer(
  state: ConfiguratorWorkspaceState,
  action: ConfiguratorWorkspaceAction,
): ConfiguratorWorkspaceState {
  switch (action.type) {
    case 'submit':
      return {
        mode: 'studio',
        initialRequest: action.request,
        projectId: state.projectId,
        hopstudioSessionId: state.hopstudioSessionId,
        customerName: state.customerName,
        projectName: state.projectName,
      };
    case 'select-project':
      return {
        ...state,
        mode: action.hopstudioSessionId ? 'studio' : 'home',
        projectId: action.projectId,
        hopstudioSessionId: action.hopstudioSessionId,
        customerName: action.customerName,
        projectName: action.projectName,
        initialRequest: action.hopstudioSessionId
          ? createResumeConfiguratorRequest(action.projectId, action.hopstudioSessionId)
          : null,
      };
    case 'change-project':
      return INITIAL_CONFIGURATOR_WORKSPACE_STATE;
    case 'rename-project':
      return { ...state, projectName: action.projectName };
  }
}

export function createInitialConfiguratorRequest(query: string): InitialConfiguratorRequest {
  return {
    id: crypto.randomUUID(),
    query: query.trim(),
    submittedAt: new Date().toISOString(),
  };
}
