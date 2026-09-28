import { useEffect, useMemo, useState } from 'react';
import { CheckSquare2, FileText, Loader2, Square, X } from 'lucide-react';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { ProjectsApiClient, type ProjectDetailDto } from '@/modules/projects';
import { CommercialQuotesApiClient } from '@/modules/commercial-quotes';

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
}: Readonly<{
  projectId: string;
  projectName: string;
  onClose: () => void;
  onCreated: (quoteId: string) => void;
}>) {
  const projectsApi = useWorkspaceApi(ProjectsApiClient);
  const quotesApi = useWorkspaceApi(CommercialQuotesApiClient);
  const [detail, setDetail] = useState<ProjectDetailDto | null>(null);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setDetail(null);
    setSelectedIds(new Set());
    void projectsApi.getDetail(projectId)
      .then((result) => {
        if (active) setDetail(result);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Chargement du projet impossible.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [projectId, projectsApi]);

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
          <div className="min-w-0">
            <h2 id="active-project-items-title" className="text-lg font-semibold text-ink">
              Éléments du projet
            </h2>
            <p className="truncate text-sm text-ink-muted">{projectName}</p>
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
                    <li key={item.id}>
                      <label className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition ${checked ? 'bg-brand/10' : 'hover:bg-bg'}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleItem(item.id)}
                          className="mt-1 size-4 shrink-0"
                          aria-label={`Sélectionner ${item.label}`}
                        />
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-sm font-medium text-ink">{item.label}</strong>
                          <span className="mt-0.5 block text-xs text-ink-muted">
                            {details || 'Configuration non détaillée.'}
                          </span>
                        </span>
                      </label>
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
