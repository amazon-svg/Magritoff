import { useCallback, useEffect, useState } from 'react';
import { ListChecks, Sparkles } from 'lucide-react';
import { HopeStudioWorkspace } from '@/modules/hopstudio/ui';
import { ProjectsApiClient } from '@/modules/projects';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import type { InitialConfiguratorRequest } from './configurator-workspace-state';
import { ActiveProjectItemsDrawer } from './ActiveProjectItemsDrawer';

export function DualToolWorkspace({
  tenantId,
  userId,
  initialRequest,
  projectId,
  hopstudioSessionId,
  customerName,
  projectName,
  onQuoteCreated,
  onChangeProject,
}: Readonly<{
  tenantId: string;
  userId: string;
  initialRequest: InitialConfiguratorRequest;
  projectId: string | null;
  hopstudioSessionId: string | null;
  customerName: string | null;
  projectName: string | null;
  onQuoteCreated: (quoteId: string) => void;
  onChangeProject: () => void;
}>) {
  const projectsApi = useWorkspaceApi(ProjectsApiClient);
  const [showProjectItems, setShowProjectItems] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(projectId);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(hopstudioSessionId);
  const [projectItemCount, setProjectItemCount] = useState<number | null>(null);
  const [projectItemsRevision, setProjectItemsRevision] = useState(0);
  useEffect(() => {
    setActiveProjectId(projectId);
  }, [projectId]);
  useEffect(() => {
    setActiveSessionId(hopstudioSessionId);
  }, [hopstudioSessionId]);
  useEffect(() => {
    setProjectItemCount(null);
  }, [activeProjectId]);
  useEffect(() => {
    let active = true;
    if (!activeProjectId) return () => { active = false; };
    void projectsApi.getDetail(activeProjectId)
      .then((project) => {
        if (active) setProjectItemCount(project.items.length);
      })
      .catch(() => {
        if (active) setProjectItemCount(null);
      });
    return () => { active = false; };
  }, [activeProjectId, projectItemsRevision, projectsApi]);
  const handleProjectItemsAdded = useCallback((count: number) => {
    setProjectItemCount((current) => current === null ? count : current + count);
    setProjectItemsRevision((current) => current + 1);
  }, []);
  const handleSessionId = useCallback(async (sessionId: string) => {
    // Une fois associee, la session du projet est immuable. Un changement
    // observe dans le runtime global HopeStudio ne doit donc jamais remplacer
    // la session du projet courant.
    if (!activeProjectId || activeSessionId !== null) return;
    const current = await projectsApi.getForEdit(activeProjectId);
    if (!current.etag || current.data.hopstudio_session_id !== null) {
      setActiveSessionId(current.data.hopstudio_session_id);
      return;
    }
    await projectsApi.update(activeProjectId, { hopstudio_session_id: sessionId }, current.etag);
    setActiveSessionId(sessionId);
  }, [activeProjectId, activeSessionId, projectsApi]);
  return (
    <main
      className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col overflow-hidden bg-bg"
      data-testid="dual-tool-workspace"
      data-mode="studio"
    >
      <div className="flex items-center gap-3 border-b border-line bg-white px-4 py-2 text-sm">
        <div className="min-w-0 flex-1 truncate text-ink">
          <span className="font-medium">{customerName ?? 'Client'}</span>
          <span className="mx-2 text-ink-muted">·</span>
          <span className="text-ink-muted">{projectName ?? 'Projet'}</span>
          <span className="mx-2 text-ink-muted">·</span>
          <span className="truncate text-xs text-ink-muted" title={activeSessionId ?? 'Nouvelle session'}>
            Session: {activeSessionId ?? 'Nouvelle session'}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {activeProjectId && projectName && (
            <button
              type="button"
              onClick={() => setShowProjectItems(true)}
              className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-bg"
            >
              <ListChecks className="size-4" />
              Éléments du projet
              {projectItemCount !== null && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-ink px-1.5 py-0.5 text-xs leading-none text-white" aria-label={`${projectItemCount} éléments`}>
                  {projectItemCount}
                </span>
              )}
            </button>
          )}
          <button type="button" onClick={onChangeProject} className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-bg">
            Changer
          </button>
        </div>
      </div>
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden p-3 md:p-4">
        <WorkspacePanel
          title="Clariprint Studio"
          icon={<Sparkles className="size-4" />}
        >
          <HopeStudioWorkspace
            tenantId={tenantId}
            userId={userId}
            initialRequest={initialRequest}
            projectId={activeProjectId}
            sessionId={activeSessionId}
            onSessionId={handleSessionId}
            onProjectItemsAdded={handleProjectItemsAdded}
            compact={false}
          />
        </WorkspacePanel>
      </div>
      {showProjectItems && activeProjectId && projectName && (
        <ActiveProjectItemsDrawer
          projectId={activeProjectId}
          projectName={projectName}
          onClose={() => setShowProjectItems(false)}
          onCreated={(quoteId) => {
            setShowProjectItems(false);
            onQuoteCreated(quoteId);
          }}
        />
      )}
    </main>
  );
}

function WorkspacePanel({
  title,
  icon,
  children,
}: Readonly<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}>) {
  return (
    <section
      className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_8px_30px_rgba(15,23,42,0.07)]"
      aria-label={title}
      data-workspace-panel="studio"
    >
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-line bg-white px-4">
        <h2 className="inline-flex items-center gap-2 text-sm font-medium text-ink">
          {icon}
          {title}
        </h2>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}
