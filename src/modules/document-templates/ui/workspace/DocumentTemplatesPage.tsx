/**
 * DocumentTemplatesPage — ecran de parametrage MINIMAL des gabarits PDF de
 * documents du tenant (E10.10b-4a) : lister, importer, nommer, defaut,
 * activer/desactiver, supprimer. AUCUN editeur de coordonnees (positionnement
 * a la souris) : c est l objet d E10.10b-4b, hors perimetre de ce lot.
 *
 * L ecran n est monte que sous une route `requiredCapabilities:
 * ['can_manage_document_templates']` (voir `../../surface-contributions.ts`) :
 * garde d ergonomie, pas d autorisation — celle-ci est tenue par la RLS
 * (`document_pdf_templates_write`, migration 20260909020000).
 *
 * Le depot du fichier se fait par un `fetch(url, { method: 'PUT' })` NU sur
 * l URL signee du billet d import (`DocumentTemplatesApiClient.uploadPdfFile`),
 * JAMAIS par le SDK Supabase : `modular-ui-boundaries.test.ts` interdit tout
 * import `@supabase/*` dans une UI de module (contrat §8.18 §0 point 8).
 *
 * Aucun controle metier evalue ici (type MIME reel, poids, geometrie) :
 * l unique verite est le serveur, a la confirmation (`confirmUpload`). Le
 * `accept="application/pdf"` du champ fichier est un CONFORT de saisie, pas
 * une barriere.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Loader2, MapPin, Plus, Trash2, UploadCloud } from 'lucide-react';
import { useAuth } from '@/modules/account/ui/runtime';
import { useTenant } from '@/modules/tenants/ui/runtime';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { DocumentTemplatesApiClient } from '@/modules/document-templates/api/client';
import type { DocumentPdfTemplateDto } from '@/modules/document-templates/api/contracts';

const inputCls =
  'w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';
const btnPrimary =
  'px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium flex items-center gap-2';
const btnGhost =
  'px-3 py-1.5 border border-line-2 rounded-lg text-sm text-ink-2 hover:bg-bg hover:text-ink disabled:opacity-50';

function formatByteSize(byteSize: number | null): string {
  if (byteSize === null) return '—';
  if (byteSize < 1024) return `${byteSize} o`;
  return `${(byteSize / 1024 / 1024).toFixed(2)} Mo`;
}

function statusLabel(status: DocumentPdfTemplateDto['status']): string {
  return status === 'ready' ? 'Prêt' : 'En attente d’import';
}

export function DashboardDocumentTemplates() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const api = useWorkspaceApi(DocumentTemplatesApiClient);
  const tenantPath = useTenantPath();
  const enabled = Boolean(user && currentTenant);

  const [templates, setTemplates] = useState<readonly DocumentPdfTemplateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newIsDefault, setNewIsDefault] = useState(false);
  const [creating, setCreating] = useState(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.list();
      setTemplates(data);
      setDrafts(Object.fromEntries(data.map((template) => [template.id, template.name])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Lecture des gabarits PDF impossible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      await api.create({ name, is_default: newIsDefault });
      setNewName('');
      setNewIsDefault(false);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Création du gabarit impossible.');
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async (template: DocumentPdfTemplateDto) => {
    const name = drafts[template.id]?.trim();
    if (!name || name === template.name) return;
    setBusyId(template.id);
    setError(null);
    try {
      const { etag } = await api.getForEdit(template.id);
      if (!etag) throw new Error('ETag du gabarit indisponible.');
      await api.update(template.id, { name }, etag);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Renommage du gabarit impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSetDefault = async (template: DocumentPdfTemplateDto) => {
    setBusyId(template.id);
    setError(null);
    try {
      const { etag } = await api.getForEdit(template.id);
      if (!etag) throw new Error('ETag du gabarit indisponible.');
      await api.update(template.id, { is_default: true }, etag);
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Ce gabarit doit être importé et prêt avant de devenir le défaut.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleActive = async (template: DocumentPdfTemplateDto) => {
    setBusyId(template.id);
    setError(null);
    try {
      const { etag } = await api.getForEdit(template.id);
      if (!etag) throw new Error('ETag du gabarit indisponible.');
      await api.update(template.id, { is_active: !template.is_active }, etag);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Changement d’état du gabarit impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (template: DocumentPdfTemplateDto) => {
    setBusyId(template.id);
    setError(null);
    try {
      await api.remove(template.id);
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `${cause.message} — un gabarit ayant déjà produit un document ne peut pas être supprimé.`
          : 'Suppression du gabarit impossible.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleImport = async (template: DocumentPdfTemplateDto, file: File) => {
    setBusyId(template.id);
    setError(null);
    try {
      // Toujours un billet NEUF (reprise d import interrompu OU remplacement
      // d un fond deja `ready`) : contrat, jamais un billet memorise.
      const ticket = await api.issueUploadUrl(template.id);
      await api.uploadPdfFile(ticket, file);
      await api.confirmUpload(template.id);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Import du fichier PDF impossible.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5" data-testid={TEST_IDS.documentTemplate.page}>
      <div>
        <h1 className="text-xl font-bold text-ink">Gabarits PDF</h1>
        <p className="text-sm text-ink-muted mt-1">
          Fonds PDF apportés par l’imprimeur (export InDesign, Illustrator ou Canva), sur lesquels Magrit
          écrit les valeurs d’un devis. Une fois un fond importé, positionnez les champs depuis « Positionner
          les champs ».
        </p>
      </div>

      {error && (
        <p className="text-sm text-err-fg" data-testid={TEST_IDS.documentTemplate.errorBanner}>
          {error}
        </p>
      )}

      <form onSubmit={handleCreate} className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="Nom du gabarit (ex. Papier à en-tête 2026)"
          maxLength={120}
          className={`${inputCls} max-w-sm`}
          data-testid={TEST_IDS.documentTemplate.addNameInput}
        />
        <label className="flex items-center gap-1.5 text-xs text-ink-2 whitespace-nowrap">
          <input
            type="checkbox"
            checked={newIsDefault}
            onChange={(event) => setNewIsDefault(event.target.checked)}
            data-testid={TEST_IDS.documentTemplate.addDefaultCheckbox}
          />
          En faire le défaut dès l’import terminé
        </label>
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className={btnPrimary}
          data-testid={TEST_IDS.documentTemplate.addBtn}
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Créer
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-ink-muted py-8 text-center">Aucun gabarit pour l’instant.</p>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => {
            const busy = busyId === template.id;
            const draft = drafts[template.id] ?? template.name;
            return (
              <div
                key={template.id}
                data-testid={TEST_IDS.documentTemplate.row}
                data-template-id={template.id}
                data-status={template.status}
                className={`flex flex-wrap items-center gap-3 border border-line-2 rounded-lg p-3 bg-paper ${
                  template.is_active ? '' : 'opacity-60'
                }`}
              >
                <span
                  className="text-xs px-2 py-0.5 rounded-full border border-line-2 text-ink-2 whitespace-nowrap"
                  data-testid={TEST_IDS.documentTemplate.statusBadge}
                >
                  {statusLabel(template.status)}
                  {template.is_default ? ' · Défaut' : ''}
                </span>

                <input
                  type="text"
                  value={draft}
                  onChange={(event) => setDrafts((current) => ({ ...current, [template.id]: event.target.value }))}
                  maxLength={120}
                  disabled={busy}
                  className={`${inputCls} max-w-xs`}
                  data-testid={TEST_IDS.documentTemplate.nameInput}
                />

                <span className="text-xs text-ink-muted whitespace-nowrap">
                  {template.page_count ? `${template.page_count} page(s)` : 'Aucun fichier'} ·{' '}
                  {formatByteSize(template.byte_size)}
                </span>

                <input
                  ref={(element) => {
                    fileInputs.current[template.id] = element;
                  }}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  data-testid={TEST_IDS.documentTemplate.fileInput}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void handleImport(template, file);
                  }}
                />

                <div className="ml-auto flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => void handleRename(template)}
                    disabled={busy || draft.trim() === template.name}
                    className={btnGhost}
                    data-testid={TEST_IDS.documentTemplate.saveBtn}
                  >
                    Renommer
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputs.current[template.id]?.click()}
                    disabled={busy}
                    className={btnPrimary}
                    data-testid={TEST_IDS.documentTemplate.importBtn}
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                    {template.status === 'ready' ? 'Remplacer le fond' : 'Importer'}
                  </button>
                  {template.status === 'ready' && (
                    <Link
                      to={tenantPath(`/dashboard/document-templates/${template.id}/fields`)}
                      data-testid={TEST_IDS.documentTemplate.fieldsEditBtn}
                      className={btnGhost}
                    >
                      <MapPin className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                      Positionner les champs
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSetDefault(template)}
                    disabled={busy || template.is_default || template.status !== 'ready' || !template.is_active}
                    className={btnGhost}
                    data-testid={TEST_IDS.documentTemplate.defaultBtn}
                  >
                    Définir par défaut
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleActive(template)}
                    disabled={busy}
                    className={btnGhost}
                    data-testid={TEST_IDS.documentTemplate.deactivateBtn}
                  >
                    {template.is_active ? 'Désactiver' : 'Activer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(template)}
                    disabled={busy}
                    className="p-2 text-ink-muted hover:text-err-fg disabled:opacity-50"
                    aria-label="Supprimer"
                    data-testid={TEST_IDS.documentTemplate.deleteBtn}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
