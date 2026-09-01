/**
 * ProjectsPage — liste des projets du tenant, triee par derniere
 * modification decroissante (CA2), et creation d un projet (CA3).
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { Plus, Search, FolderKanban } from 'lucide-react';
import { useAuth } from '@/modules/account/ui/runtime';
import { useTenant } from '@/modules/tenants/ui/runtime';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { useProjectsManagement } from '@/modules/projects/ui/hooks';
import { ProjectCreateModal } from './ProjectCreateModal';

const inputCls =
  'w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';
const btnPrimary =
  'px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium flex items-center gap-2';

export function DashboardProjects() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const tp = useTenantPath();
  const { items, loading, error, q, setQ, status, setStatus, create, refresh } =
    useProjectsManagement(Boolean(user && currentTenant));
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-5" data-testid={TEST_IDS.project.page}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Projets</h1>
          <p className="text-sm text-ink-muted mt-1">
            {items.length} projet{items.length > 1 ? 's' : ''}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className={btnPrimary}
          data-testid={TEST_IDS.project.createBtn}
        >
          <Plus className="w-4 h-4" />
          Nouveau projet
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Rechercher un projet..."
            className={`${inputCls} pl-9`}
          />
        </div>
        <select
          value={status ?? ''}
          onChange={(event) => setStatus(event.target.value ? (event.target.value as 'active' | 'archived') : null)}
          className={inputCls}
          style={{ maxWidth: 200 }}
        >
          <option value="">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="archived">Archivés</option>
        </select>
      </div>

      {error && <p className="text-sm text-err-fg">{error}</p>}

      {loading ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-muted py-8 text-center">Aucun projet pour l’instant.</p>
      ) : (
        <table className="w-full text-sm" data-testid={TEST_IDS.project.table}>
          <thead>
            <tr className="text-left text-ink-muted border-b border-line">
              <th className="py-2 pr-3 font-medium">Projet</th>
              <th className="py-2 pr-3 font-medium">Statut</th>
              <th className="py-2 pr-3 font-medium">Dernière modification</th>
            </tr>
          </thead>
          <tbody>
            {items.map((project) => (
              <tr
                key={project.id}
                data-testid={TEST_IDS.project.row}
                data-project-id={project.id}
                className="border-b border-line/60 hover:bg-bg cursor-pointer"
              >
                <td className="py-2 pr-3">
                  <Link
                    to={tp(`/dashboard/projects/${project.id}`)}
                    className="flex items-center gap-2 text-ink hover:text-brand hover:underline"
                  >
                    <FolderKanban className="w-4 h-4 text-ink-muted" />
                    {project.name}
                  </Link>
                </td>
                <td className="py-2 pr-3">
                  {project.status === 'active' ? (
                    <span className="text-xs text-ink-2">Actif</span>
                  ) : (
                    <span className="text-xs text-ink-muted">Archivé</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-ink-muted">
                  {new Date(project.updated_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreate && (
        <ProjectCreateModal
          onClose={() => {
            setShowCreate(false);
            void refresh();
          }}
          onCreate={create}
        />
      )}
    </div>
  );
}
