import { useState } from 'react';
import { Columns2, Maximize2, Search, Sparkles } from 'lucide-react';
import { HopeStudioWorkspace } from '@/modules/hopstudio/ui';
import type { ConfiguratorViewMode, InitialConfiguratorRequest } from './configurator-workspace-state';
import { PimSearchPanel } from './PimSearchPanel';

export function DualToolWorkspace({
  mode,
  tenantId,
  userId,
  initialRequest,
  pimQuery,
  onPimQueryChange,
  onModeChange,
}: Readonly<{
  mode: Exclude<ConfiguratorViewMode, 'home'>;
  tenantId: string;
  userId: string;
  initialRequest: InitialConfiguratorRequest;
  pimQuery: string;
  onPimQueryChange: (query: string) => void;
  onModeChange: (mode: 'split' | 'studio' | 'pim') => void;
}>) {
  const [mobilePanel, setMobilePanel] = useState<'studio' | 'pim'>('studio');
  const studioVisible = mode !== 'pim';
  const pimVisible = mode !== 'studio';

  return (
    <main
      className="flex min-h-[calc(100vh-7rem)] flex-col overflow-hidden bg-bg"
      data-testid="dual-tool-workspace"
      data-mode={mode}
    >
      {mode === 'split' && (
        <div className="grid grid-cols-2 border-b border-line bg-white md:hidden" role="tablist" aria-label="Outils du configurateur">
          <MobileTab active={mobilePanel === 'studio'} icon={<Sparkles className="size-4" />} onClick={() => setMobilePanel('studio')}>
            Studio
          </MobileTab>
          <MobileTab active={mobilePanel === 'pim'} icon={<Search className="size-4" />} onClick={() => setMobilePanel('pim')}>
            Produits
          </MobileTab>
        </div>
      )}

      <div className={`grid min-h-0 flex-1 ${mode === 'split' ? 'md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]' : 'grid-cols-1'}`}>
        <WorkspacePanel
          title="Clariprint Studio"
          icon={<Sparkles className="size-4" />}
          visible={studioVisible && (mode !== 'split' || mobilePanel === 'studio')}
          desktopVisible={studioVisible}
          focused={mode === 'studio'}
          side="left"
          onFocus={() => onModeChange('studio')}
          onSplit={() => onModeChange('split')}
        >
          <HopeStudioWorkspace
            tenantId={tenantId}
            userId={userId}
            initialRequest={initialRequest}
          />
        </WorkspacePanel>

        <WorkspacePanel
          title="Recherche PIM"
          icon={<Search className="size-4" />}
          visible={pimVisible && (mode !== 'split' || mobilePanel === 'pim')}
          desktopVisible={pimVisible}
          focused={mode === 'pim'}
          side="right"
          onFocus={() => onModeChange('pim')}
          onSplit={() => onModeChange('split')}
        >
          <PimSearchPanel query={pimQuery} onQueryChange={onPimQueryChange} />
        </WorkspacePanel>
      </div>
    </main>
  );
}

function WorkspacePanel({
  title,
  icon,
  children,
  visible,
  desktopVisible,
  focused,
  side,
  onFocus,
  onSplit,
}: Readonly<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  visible: boolean;
  desktopVisible: boolean;
  focused: boolean;
  side: 'left' | 'right';
  onFocus: () => void;
  onSplit: () => void;
}>) {
  return (
    <section
      className={`${visible ? 'flex' : 'hidden'} ${desktopVisible ? 'md:flex' : 'md:hidden'} min-h-0 flex-col bg-white ${side === 'left' ? 'md:border-r md:border-line' : ''}`}
      aria-label={title}
      data-workspace-panel={side}
    >
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-line bg-white px-4">
        <h2 className="inline-flex items-center gap-2 text-sm font-medium text-ink">
          {icon}
          {title}
        </h2>
        <button
          type="button"
          onClick={focused ? onSplit : onFocus}
          className="inline-flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-bg hover:text-ink"
          aria-label={focused ? 'Afficher Studio et PIM' : `Agrandir ${title}`}
          title={focused ? 'Afficher les deux zones' : 'Plein écran'}
        >
          {focused ? <Columns2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}

function MobileTab({
  active,
  icon,
  children,
  onClick,
}: Readonly<{
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex min-h-12 items-center justify-center gap-2 border-b-2 px-4 text-sm ${active ? 'border-ink text-ink' : 'border-transparent text-ink-muted'}`}
    >
      {icon}
      {children}
    </button>
  );
}
