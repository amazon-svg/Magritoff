import { useReducer } from 'react';
import { DualToolWorkspace } from './DualToolWorkspace';
import { MagritConfiguratorHome } from './MagritConfiguratorHome';
import {
  INITIAL_CONFIGURATOR_WORKSPACE_STATE,
  configuratorWorkspaceReducer,
  createInitialConfiguratorRequest,
} from './configurator-workspace-state';

export function ConfiguratorWorkspace({
  tenantId,
  userId,
}: Readonly<{
  tenantId: string;
  userId: string;
}>) {
  const [state, dispatch] = useReducer(
    configuratorWorkspaceReducer,
    INITIAL_CONFIGURATOR_WORKSPACE_STATE,
  );

  if (state.mode === 'home' || !state.initialRequest) {
    return (
      <MagritConfiguratorHome
        onProjectSelect={(selection) => dispatch({ type: 'select-project', ...selection })}
      />
    );
  }

  return (
    <DualToolWorkspace
      mode={state.mode}
      tenantId={tenantId}
      userId={userId}
      projectId={state.projectId}
      customerName={state.customerName}
      projectName={state.projectName}
      initialRequest={state.initialRequest}
      pimQuery={state.pimQuery}
      onPimQueryChange={(query) => dispatch({ type: 'search-pim', query })}
      onModeChange={(mode) => dispatch({
        type: mode === 'split' ? 'show-split' : mode === 'studio' ? 'focus-studio' : 'focus-pim',
      })}
      onChangeProject={() => dispatch({ type: 'change-project' })}
    />
  );
}
