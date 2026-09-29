import { useEffect, useMemo, useState } from 'react';
import { Check, CheckSquare2, FileText, Loader2, Pencil, Square, Trash2, X } from 'lucide-react';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { ProjectsApiClient, type ProjectDetailDto } from '@/modules/projects';
import { CommercialQuotesApiClient } from '@/modules/commercial-quotes';
import { SafeDescriptionHtml } from '@/shared/presentation/SafeDescriptionHtml';

type QuotePayloadShape = Readonly<{
  quantity?: number | string;
  format?: string;
  material?: string;
}>;

export function ActiveProjectItemsDrawer({
  projectId,
  projectName,
  onClose,
  onCreated,
  onProjectRenamed,
  onItemCountChanged,
}: Readonly<{
  projectId: string;
  projectName: string;
  onClose: () => void;
  onCreated: (quoteId: string) => void;
  onProjectRenamed: (name: string) => void;
  onItemCountChanged: (count: number) => void;
}>) {
  const projectsApi = useWorkspaceApi(ProjectsApiClient);
  const quotesApi = useWorkspaceApi(CommercialQuotesApiClient);
  const [detail, setDetail] = useState<ProjectDetailDto | null>(null);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projectEtag, setProjectEtag] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState(false);
  const [projectDraft, setProjectDraft] = useState(projectName);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemDraft, setItemDraft] = useState('');
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setDetail(null);
    setProjectEtag(null);
    setProjectDraft(projectName);
    setEditingProject(false);
    setEditingItemId(null);
    setDeletingItemId(null);
    setSelectedIds(new Set());
    void projectsApi.getForEdit(projectId)
      .then((result) => {
        if (!active) return;
        setDetail(result.data);
        setProjectEtag(result.etag);
        setProjectDraft(result.data.name);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Chargement du projet impossible.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [projectId, projectName, projectsApi]);

  const items = detail?.items ?? [];
  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );

  const toggleItem = (itemId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(items.map((item) => item.id)));
  };

  const createQuote = async () => {
    if (saving || selectedItems.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const quote = await quotesApi.createFromProject({
        project_id: projectId,
        item_ids: selectedItems.map((item) => item.id),
      });
      onCreated(quote.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Création du devis impossible.');
    } finally {
      setSaving(false);
    }
  };

  const renameProject = async () => {
    const name = projectDraft.trim();
    if (!detail || !projectEtag || !name || actionKey) return;
    if (name === detail.name) {
      setEditingProject(false);
      return;
    }
    setActionKey('project');
    setError(null);
    try {
      const updated = await projectsApi.update(projectId, { name }, projectEtag);
      setDetail((current) => current ? { ...current, name: updated.data.name, updated_at: updated.data.updated_at } : current);
      setProjectEtag(updated.etag);
      setProjectDraft(updated.data.name);
      setEditingProject(false);
      onProjectRenamed(updated.data.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Renommage du projet impossible.');
    } finally {
      setActionKey(null);
    }
  };

  const startItemRename = (itemId: string, label: string) => {
    setDeletingItemId(null);
    setEditingItemId(itemId);
    setItemDraft(label);
  };

  const renameItem = async (itemId: string) => {
    const label = itemDraft.trim();
    if (!detail || !label || actionKey) return;
    const current = detail.items.find((item) => item.id === itemId);
    if (!current) return;
    if (label === current.label) {
      setEditingItemId(null);
      return;
    }
    setActionKey(`rename:${itemId}`);
    setError(null);
    try {
      const currentForEdit = await projectsApi.getItemForEdit(projectId, itemId);
      if (!currentForEdit.etag) throw new Error('La version de l’élément est indisponible.');
      const updated = await projectsApi.updateItem(projectId, itemId, { label }, currentForEdit.etag);
      setDetail((value) => value ? {
        ...value,
        items: value.items.map((item) => item.id === itemId ? updated.data : item),
      } : value);
      setEditingItemId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Renommage de l’élément impossible.');
    } finally {
      setActionKey(null);
    }
  };

  const removeItem = async (itemId: string) => {
    if (!detail || actionKey) return;
    setActionKey(`delete:${itemId}`);
    setError(null);
    try {
      await projectsApi.removeItem(projectId, itemId);
      const nextItems = detail.items.filter((item) => item.id !== itemId);
      setDetail({ ...detail, items: nextItems });
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(itemId);
        return next;
      });
      setDeletingItemId(null);
      onItemCountChanged(nextItems.length);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Suppression de l’élément impossible.');
    } finally {
      setActionKey(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex justify-end bg-black/45"
      onClick={onClose}
      role="presentation"
    >
      <section
        className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="active-project-items-title"
        onClick={(event) => event.stopPropagation()}
        data-testid="active-project-items-drawer"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="active-project-items-title" className="text-lg font-semibold text-ink">
              Éléments du projet
            </h2>
            {editingProject ? (
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={projectDraft}
                  onChange={(event) => setProjectDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void renameProject();
                    if (event.key === 'Escape') {
                      setProjectDraft(detail?.name ?? projectName);
                      setEditingProject(false);
                    }
                  }}
                  maxLength={300}
                  autoFocus
                  aria-label="Nouveau nom du projet"
                  className="min-w-0 flex-1 rounded-md border border-line-2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                />
                <button type="button" onClick={() => void renameProject()} disabled={!projectDraft.trim() || actionKey === 'project'} className="rounded-md p-1.5 text-brand hover:bg-brand/10 disabled:opacity-40" aria-label="Enregistrer le nom du projet">
                  {actionKey === 'project' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                </button>
                <button type="button" onClick={() => { setProjectDraft(detail?.name ?? projectName); setEditingProject(false); }} className="rounded-md p-1.5 text-ink-muted hover:bg-bg" aria-label="Annuler le renommage du projet">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                <p className="truncate text-sm text-ink-muted">{detail?.name ?? projectName}</p>
                <button type="button" onClick={() => setEditingProject(true)} className="shrink-0 rounded-md p-1 text-ink-muted hover:bg-bg hover:text-ink" aria-label="Renommer le projet">
                  <Pencil className="size-3.5" />
                </button>
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-ink-muted hover:bg-bg hover:text-ink" aria-label="Fermer">
            <X className="size-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-muted" role="status">
              <Loader2 className="size-4 animate-spin" /> Chargement des éléments…
            </div>
          ) : items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-ink-muted">
              Ce projet ne contient encore aucun chiffrage.
            </p>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm text-ink-muted">
                  {items.length} élément{items.length > 1 ? 's' : ''} · {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
                </p>
                <button type="button" onClick={toggleAll} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-bg">
                  {allSelected ? <CheckSquare2 className="size-4" /> : <Square className="size-4" />}
                  {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              </div>
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                {items.map((item) => {
                  const payload = item.quote_payload as QuotePayloadShape;
                  const checked = selectedIds.has(item.id);
                  const details = [
                    payload.quantity ? `${payload.quantity} ex.` : null,
                    payload.format ?? null,
                    payload.material ?? null,
                  ].filter(Boolean).join(' · ');
                  return (
                    <li key={item.id} className={`px-4 py-3 transition ${checked ? 'bg-brand/10' : 'hover:bg-bg'}`}>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleItem(item.id)}
                          className="mt-1 size-4 shrink-0"
                          aria-label={`Sélectionner ${item.label}`}
                        />
                        <div className="min-w-0 flex-1">
                          {editingItemId === item.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                value={itemDraft}
                                onChange={(event) => setItemDraft(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') void renameItem(item.id);
                                  if (event.key === 'Escape') setEditingItemId(null);
                                }}
                                maxLength={300}
                                autoFocus
                                aria-label={`Nouveau nom de ${item.label}`}
                                className="min-w-0 flex-1 rounded-md border border-line-2 px-2 py-1 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                              />
                              <button type="button" onClick={() => void renameItem(item.id)} disabled={!itemDraft.trim() || actionKey === `rename:${item.id}`} className="rounded-md p-1.5 text-brand hover:bg-brand/10 disabled:opacity-40" aria-label={`Enregistrer le nom de ${item.label}`}>
                                {actionKey === `rename:${item.id}` ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                              </button>
                              <button type="button" onClick={() => setEditingItemId(null)} className="rounded-md p-1.5 text-ink-muted hover:bg-white" aria-label="Annuler le renommage">
                                <X className="size-4" />
                              </button>
                            </div>
                          ) : (
                            <strong className="block truncate text-sm font-medium text-ink">{item.label}</strong>
                          )}
                          <SafeDescriptionHtml
                            html={item.description_html}
                            className="mt-1 text-xs text-ink-muted"
                          />
                          <span className="mt-0.5 block text-xs text-ink-muted">
                            {details || 'Configuration non détaillée.'}
                          </span>
                        </div>
                        {editingItemId !== item.id && deletingItemId !== item.id && (
                          <div className="flex shrink-0 items-center gap-1">
                            <button type="button" onClick={() => startItemRename(item.id, item.label)} className="rounded-md p-1.5 text-ink-muted hover:bg-white hover:text-ink" aria-label={`Renommer ${item.label}`}>
                              <Pencil className="size-4" />
                            </button>
                            <button type="button" onClick={() => { setEditingItemId(null); setDeletingItemId(item.id); }} className="rounded-md p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-600" aria-label={`Supprimer ${item.label}`}>
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      {deletingItemId === item.id && (
                        <div className="mt-3 flex items-center justify-end gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                          <span className="mr-auto">Supprimer cet élément du projet ?</span>
                          <button type="button" onClick={() => setDeletingItemId(null)} className="rounded-md px-2 py-1 font-medium hover:bg-white">Annuler</button>
                          <button type="button" onClick={() => void removeItem(item.id)} disabled={actionKey === `delete:${item.id}`} className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 font-medium text-white disabled:opacity-50">
                            {actionKey === `delete:${item.id}` && <Loader2 className="size-3.5 animate-spin" />}
                            Supprimer
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {error && <p className="mt-3 text-sm text-err-fg" role="alert">{error}</p>}
        </div>

        <footer className="border-t border-line px-5 py-4">
          <button
            type="button"
            onClick={() => void createQuote()}
            disabled={loading || saving || selectedItems.length === 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
            Créer un devis avec {selectedItems.length || 0} élément{selectedItems.length > 1 ? 's' : ''}
          </button>
        </footer>
      </section>
    </div>
  );
}
