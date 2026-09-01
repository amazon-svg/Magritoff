/**
 * ProjectDetailPage — fiche projet complete (CA5, CA6, CA7).
 *
 * Affiche le client, le statut, et la liste des elements de chiffrage avec
 * leur configuration produit (CA5). Le nom, le client et le statut sont
 * modifiables (CA6) ; l archivage est un changement de statut, jamais une
 * suppression.
 *
 * Structure prevue pour accueillir sans refonte les testid d E10.3 (case a
 * cocher par element, bouton de creation de devis groupe depuis un projet) :
 * chaque ligne d element est un conteneur `project-item-row` isole, pret a
 * recevoir une case a cocher en tete de ligne.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Archive, ArchiveRestore, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { useTenant } from '@/modules/tenants/ui/runtime';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { CustomersApiClient, type CustomerDto } from '@/modules/customers';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { useProjectDetail, useProjectTagsCatalog } from '@/modules/projects/ui/hooks';
import type { ProjectItemDto } from '@/modules/projects/api/contracts';
import { customerDisplayName } from './ProjectCreateModal';
import { ProjectTagsEditor } from './ProjectTagsEditor';

const inputCls =
  'w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';
const btnGhost =
  'px-3 py-1.5 border border-line-2 rounded-lg text-sm text-ink-2 hover:bg-bg hover:text-ink flex items-center gap-2';

/** Champs communs aux payloads de chiffrage produits par l atelier (ChatInterface.parseConfigsToProducts). */
interface QuotePayloadShape {
  name?: string;
  quantity?: number | string;
  format?: string;
  material?: string;
  weight?: number;
  [key: string]: unknown;
}

export function DashboardProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const tp = useTenantPath();
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const { detail, loading, error, update, removeItem, replaceTags } = useProjectDetail(projectId ?? null);
  const { tags: allTags, createOrGet: createOrGetTag } = useProjectTagsCatalog(Boolean(currentTenant));

  const customersApi = useWorkspaceApi(CustomersApiClient);
  const [customers, setCustomers] = useState<readonly CustomerDto[]>([]);
  useEffect(() => {
    let cancelled = false;
    void customersApi
      .list({ pageSize: 200 })
      .then((response) => {
        if (!cancelled) setCustomers(response.items);
      })
      .catch(() => {
        if (!cancelled) setCustomers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [customersApi]);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingArchive, setSavingArchive] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);

  if (loading) return <p className="text-sm text-ink-muted">Chargement…</p>;

  if (!detail) {
    return (
      <div className="space-y-3">
        <Link
          to={tp('/dashboard/projects')}
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux projets
        </Link>
        <p className="text-sm text-ink-muted">{error ?? 'Projet introuvable.'}</p>
      </div>
    );
  }

  const customer = customers.find((candidate) => candidate.id === detail.customer_id) ?? null;

  const startEditingName = () => {
    setNameDraft(detail.name);
    setEditingName(true);
  };

  const submitName = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!nameDraft.trim()) return;
    setSavingName(true);
    try {
      await update({ name: nameDraft.trim() });
      setEditingName(false);
    } finally {
      setSavingName(false);
    }
  };

  const toggleArchive = async () => {
    setSavingArchive(true);
    try {
      await update({ status: detail.status === 'active' ? 'archived' : 'active' });
    } finally {
      setSavingArchive(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    setRemovingItemId(itemId);
    try {
      await removeItem(itemId);
    } finally {
      setRemovingItemId(null);
    }
  };

  /**
   * CA5 — reprend l iteration conversationnelle sur ce chiffrage : ouvre l
   * atelier (ChatInterface) avec la configuration produit de l element deja
   * chargee, sans rejouer Clariprint ni recalculer de prix (le payload est
   * restitue tel quel).
   */
  const resumeInAtelier = (item: ProjectItemDto) => {
    if (!currentTenant) return;
    navigate(`/t/${currentTenant.slug}`, { state: { resumeProject: { item } } });
  };

  return (
    <div className="space-y-6" data-testid={TEST_IDS.project.detailPage}>
      <Link
        to={tp('/dashboard/projects')}
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux projets
      </Link>

      <div className="flex items-start justify-between">
        <div className="flex-1">
          {editingName ? (
            <form onSubmit={submitName} className="flex items-center gap-2">
              <input
                type="text"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                className={inputCls}
                autoFocus
              />
              <button type="submit" disabled={savingName} className={btnGhost}>
                {savingName && <Loader2 className="w-4 h-4 animate-spin" />}
                Enregistrer
              </button>
              <button type="button" onClick={() => setEditingName(false)} className={btnGhost}>
                Annuler
              </button>
            </form>
          ) : (
            <h1
              className="text-xl font-bold text-ink cursor-pointer"
              onClick={startEditingName}
              title="Renommer le projet"
            >
              {detail.name}
            </h1>
          )}
          <p className="text-sm text-ink-muted mt-1">
            Client :{' '}
            {customer ? (
              <Link to={tp(`/dashboard/customers/${customer.id}`)} className="hover:underline">
                {customerDisplayName(customer)}
              </Link>
            ) : (
              '—'
            )}
            {' · '}
            {detail.status === 'active' ? 'Actif' : 'Archivé'}
          </p>
          <div className="mt-2">
            <ProjectTagsEditor
              tags={detail.tags}
              allTags={allTags}
              onCreateOrGet={createOrGetTag}
              onChange={replaceTags}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => void toggleArchive()}
          disabled={savingArchive}
          className={btnGhost}
        >
          {savingArchive && <Loader2 className="w-4 h-4 animate-spin" />}
          {detail.status === 'active' ? (
            <>
              <Archive className="w-4 h-4" /> Archiver
            </>
          ) : (
            <>
              <ArchiveRestore className="w-4 h-4" /> Réactiver
            </>
          )}
        </button>
      </div>

      {error && <p className="text-sm text-err-fg">{error}</p>}

      <section className="border border-line rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-bold text-ink-2 uppercase tracking-wider">
          Chiffrages ({detail.items.length})
        </h2>

        {detail.items.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Aucun chiffrage pour l’instant. Ajoutez-en depuis l’atelier via « Ajouter au projet ».
          </p>
        ) : (
          <ul className="divide-y divide-line/60">
            {detail.items.map((item) => {
              const payload = item.quote_payload as QuotePayloadShape;
              return (
                <li
                  key={item.id}
                  data-testid={TEST_IDS.project.itemRow}
                  data-item-id={item.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink font-medium">{item.label}</p>
                    <p className="text-xs text-ink-muted">
                      {[
                        payload.quantity ? `${payload.quantity} ex.` : null,
                        payload.format ?? null,
                        payload.material ? `${payload.material}${payload.weight ? ` ${payload.weight}g` : ''}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Configuration non détaillée.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => resumeInAtelier(item)}
                      className={btnGhost}
                      title="Reprendre l’itération conversationnelle sur ce chiffrage"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reprendre
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRemoveItem(item.id)}
                      disabled={removingItemId === item.id}
                      className="p-2 text-err-fg hover:bg-err-bg rounded-lg transition-colors"
                      data-testid={TEST_IDS.project.itemRemoveBtn}
                      aria-label="Retirer du projet"
                    >
                      {removingItemId === item.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
