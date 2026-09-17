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
        onSubmit={(query) => dispatch({
          type: 'submit',
          request: createInitialConfiguratorRequest(query),
        })}
      />
    );
  }

  return (
    <DualToolWorkspace
      mode={state.mode}
      tenantId={tenantId}
      userId={userId}
      initialRequest={state.initialRequest}
      pimQuery={state.pimQuery}
      onPimQueryChange={(query) => dispatch({ type: 'search-pim', query })}
      onModeChange={(mode) => dispatch({
        type: mode === 'split' ? 'show-split' : mode === 'studio' ? 'focus-studio' : 'focus-pim',
      })}
    />
  );
}
