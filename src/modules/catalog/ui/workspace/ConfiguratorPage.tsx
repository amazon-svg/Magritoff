import { useEffect, useState } from 'react';
import { ChatInterface } from '@/modules/conversations/ui/components';
import { HopeStudioApiClient } from '@/modules/hopstudio';
import { HopeStudioWorkspace } from '@/modules/hopstudio/ui';
import { useWorkspaceApi, useWorkspaceUiRuntime } from '@/platform/runtime/workspace-ui-runtime';

export function ConfiguratorPage() {
  const api = useWorkspaceApi(HopeStudioApiClient);
  const { actor, tenant } = useWorkspaceUiRuntime();
  const [hopeStudioEnabled, setHopeStudioEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!tenant) {
      setHopeStudioEnabled(false);
      return;
    }
    const controller = new AbortController();
    setHopeStudioEnabled(null);
    api.getTenantSettings(tenant.id, controller.signal)
      .then((settings) => setHopeStudioEnabled(settings.enabled))
      .catch((error) => {
        if ((error as Error).name !== 'AbortError') {
          console.warn('[hopstudio] configuration inaccessible, fallback vers le chat Magrit', error);
          setHopeStudioEnabled(false);
        }
      });
    return () => controller.abort();
  }, [api, tenant?.id]);

  if (hopeStudioEnabled === null) {
    return <div className="p-6 text-sm text-ink-muted" role="status">Chargement de l’accueil…</div>;
  }

  if (hopeStudioEnabled && tenant && actor) {
    return <HopeStudioWorkspace tenantId={tenant.id} userId={actor.userId} />;
  }

  return (
    <ChatInterface
      onShowResults={() => {
        // Callback conservé pour compatibilité future (ex: analytics, routing)
        // mais ne déclenche plus de changement de vue — les ProductCards
        // s'affichent directement dans ChatInterface.
      }}
    />
  );
}
