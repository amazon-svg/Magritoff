import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, Loader2, LockKeyhole } from 'lucide-react';
import { TEST_IDS } from '../../../../app/lib/testIds';
import type { AccessManagementApi, ModuleAvailability } from '../../../access-management';

export type ClariprintDataHomeProps = Readonly<{
  tenantId: string;
  accessApi: Pick<AccessManagementApi, 'getMyTenantAccess'>;
}>;

type AccessState =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'ready'; module: ModuleAvailability }>
  | Readonly<{ kind: 'error' }>;

export function ClariprintDataHome({ tenantId, accessApi }: ClariprintDataHomeProps) {
  const [accessState, setAccessState] = useState<AccessState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    setAccessState({ kind: 'loading' });
    accessApi.getMyTenantAccess(tenantId).then(
      (access) => {
        if (!active) return;
        const module = access.modules.find((item) => item.moduleKey === 'clariprint_data');
        setAccessState(module ? { kind: 'ready', module } : { kind: 'error' });
      },
      () => {
        if (active) setAccessState({ kind: 'error' });
      },
    );
    return () => {
      active = false;
    };
  }, [accessApi, tenantId]);

  return (
    <section data-testid={TEST_IDS.clariprintData.page} className="max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-line text-ink">
          <Database className="h-5 w-5" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-2xl font-medium text-ink">Clariprint Data</h1>
          <p className="text-sm text-ink-muted">Données techniques et coûts de production</p>
        </div>
      </div>

      {accessState.kind === 'loading' && (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-bg p-6" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-ink-muted" aria-hidden="true" />
          <p className="text-sm text-ink-muted">Vérification de l’accès au module…</p>
        </div>
      )}

      {accessState.kind === 'error' && (
        <div className="rounded-lg border border-line bg-bg p-6" role="alert">
          <div className="mb-2 flex items-center gap-2 text-ink">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            <h2 className="text-base font-medium">Service d’accès indisponible</h2>
          </div>
          <p className="text-sm leading-6 text-ink-muted">
            L’état du module ne peut pas être vérifié actuellement. Réessayez dans quelques instants.
          </p>
        </div>
      )}

      {accessState.kind === 'ready' && !accessState.module.enabled && (
        <div className="rounded-lg border border-line bg-bg p-6">
          <div className="mb-2 flex items-center gap-2 text-ink">
            <Database className="h-5 w-5" aria-hidden="true" />
            <h2 className="text-base font-medium">Module non activé</h2>
          </div>
          <p className="text-sm leading-6 text-ink-muted">
            Clariprint Data n’est pas encore activé pour cette organisation.
          </p>
        </div>
      )}

      {accessState.kind === 'ready' && accessState.module.enabled && !accessState.module.accessible && (
        <div className="rounded-lg border border-line bg-bg p-6">
          <div className="mb-2 flex items-center gap-2 text-ink">
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            <h2 className="text-base font-medium">Accès non attribué</h2>
          </div>
          <p className="text-sm leading-6 text-ink-muted">
            Le module est actif, mais votre rôle ne possède pas la capability requise.
          </p>
        </div>
      )}

      {accessState.kind === 'ready' && accessState.module.accessible && (
        <div className="rounded-lg border border-line bg-bg p-6">
          <div className="mb-2 flex items-center gap-2 text-ink">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            <h2 className="text-base font-medium">Module accessible</h2>
          </div>
          <p className="text-sm leading-6 text-ink-muted">
            Le socle de sécurité est opérationnel. Les premiers parcours métier peuvent maintenant
            être raccordés à cette surface.
          </p>
        </div>
      )}
    </section>
  );
}
