import { useEffect, useReducer } from 'react';
import { useNavigate } from 'react-router';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { DualToolWorkspace } from './DualToolWorkspace';
import { MagritConfiguratorHome } from './MagritConfiguratorHome';
import {
  configuratorWorkspaceReducer,
  createInitialConfiguratorWorkspaceState,
  createInitialConfiguratorRequest,
} from './configurator-workspace-state';

export function ConfiguratorWorkspace({
  tenantId,
  userId,
}: Readonly<{
  tenantId: string;
  userId: string;
}>) {
  const navigate = useNavigate();
  const tenantPath = useTenantPath();
  const [state, dispatch] = useReducer(
    configuratorWorkspaceReducer,
    tenantId,
    createInitialConfiguratorWorkspaceState,
  );

  useEffect(() => {
    const key = `magrit-configurator-selection:${tenantId}`;
    if (!state.projectId || !state.projectName) {
      sessionStorage.removeItem(key);
      return;
    }
    sessionStorage.setItem(key, JSON.stringify({
      projectId: state.projectId,
      projectName: state.projectName,
      customerName: state.customerName,
      hopstudioSessionId: state.hopstudioSessionId,
    }));
  }, [state.customerName, state.hopstudioSessionId, state.projectId, state.projectName, tenantId]);

  if (state.mode === 'home' || !state.initialRequest) {
    return (
      <MagritConfiguratorHome
        selectedCustomerName={state.customerName}
        selectedProjectId={state.projectId}
        selectedProjectName={state.projectName}
        onProjectSelect={(selection) => dispatch({ type: 'select-project', ...selection })}
        onProjectRenamed={(projectName) => dispatch({ type: 'rename-project', projectName })}
        onChangeProject={() => dispatch({ type: 'change-project' })}
        onQuoteCreated={(quoteId) => navigate(tenantPath(`/dashboard/commercial-quotes/${quoteId}`))}
        onSubmit={(query) => dispatch({
          type: 'submit',
          request: createInitialConfiguratorRequest(query),
        })}
      />
    );
  }

  return (
    <DualToolWorkspace
      tenantId={tenantId}
      userId={userId}
      projectId={state.projectId}
      hopstudioSessionId={state.hopstudioSessionId}
      customerName={state.customerName}
      projectName={state.projectName}
      initialRequest={state.initialRequest}
      onQuoteCreated={(quoteId) => navigate(tenantPath(`/dashboard/commercial-quotes/${quoteId}`))}
      onProjectRenamed={(projectName) => dispatch({ type: 'rename-project', projectName })}
      onChangeProject={() => dispatch({ type: 'change-project' })}
    />
  );
}
