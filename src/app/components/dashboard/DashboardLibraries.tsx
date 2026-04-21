import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Plus, Library as LibraryIcon, Pencil, Trash2, X, Loader2, Sparkles } from 'lucide-react';
import { useLibrary, Library } from '../../contexts/LibraryContext';
import { useClients } from '../../contexts/ClientsContext';
import { usePlan } from '../../hooks/usePlan';
import { UpgradeCTA } from './UpgradeCTA';

export function DashboardLibraries() {
  const { canUse } = usePlan();
  const {
    libraries,
    librariesLoading,
    createLibrary,
    updateLibrary,
    deleteLibrary,
    productsByLibrary,
  } = useLibrary();
  const { clients } = useClients();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Library | null>(null);
  const [draft, setDraft] = useState<{ name: string; description: string; client_id: string | null }>({
    name: '',
    description: '',
    client_id: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canUse('library')) return <UpgradeCTA feature="Bibliothèques" />;

  const openNew = () => {
    setEditing(null);
    setDraft({ name: '', description: '', client_id: null });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (lib: Library) => {
    setEditing(lib);
    setDraft({ name: lib.name, description: lib.description, client_id: lib.client_id });
    setError(null);
    setModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    if (editing) {
      await updateLibrary(editing.id, draft);
    } else {
      const created = await createLibrary(draft);
      if (!created) {
        setError("Création impossible. Vérifie que la migration SQL 'libraries' a bien été appliquée.");
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setModalOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Bibliothèques</h2>
          <p className="text-sm text-gray-600">
            {libraries.length} bibliothèque(s). Chaque produit est rangé dans une bibliothèque.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
          >
            <Sparkles className="w-4 h-4" />
            Calculer des produits
          </Link>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nouvelle bibliothèque
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
        💡 Depuis le chat, calcule tes produits puis clique <strong>"Ajouter à la bibliothèque"</strong> sur une carte pour l'enregistrer. Sélectionne plusieurs produits pour un ajout groupé.
      </div>

      {librariesLoading ? (
        <p className="text-sm text-gray-500">Chargement...</p>
      ) : libraries.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <LibraryIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Aucune bibliothèque. Crée-en une pour commencer.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {libraries.map((lib) => {
            const items = productsByLibrary(lib.id);
            const client = clients.find((c) => c.id === lib.client_id);
            return (
              <div
                key={lib.id}
                className="border border-gray-200 rounded-xl bg-white overflow-hidden hover:border-gray-400 transition-colors"
              >
                <Link to={`/dashboard/library/${lib.id}`} className="block p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <LibraryIcon className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 truncate">{lib.name}</p>
                      {client && <p className="text-xs text-blue-700 truncate">→ {client.company}</p>}
                    </div>
                  </div>
                  {lib.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 mb-2">{lib.description}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-3">
                    <span>{items.length} produit{items.length > 1 ? 's' : ''}</span>
                    <span>{new Date(lib.created_at!).toLocaleDateString('fr-FR')}</span>
                  </div>
                </Link>
                <div className="px-4 pb-3 flex gap-1 justify-end border-t border-gray-100 pt-2">
                  <button
                    onClick={() => openEdit(lib)}
                    className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Supprimer "${lib.name}" et tous ses produits ?`)) deleteLibrary(lib.id);
                    }}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {editing ? 'Modifier la bibliothèque' : 'Nouvelle bibliothèque'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <input
                  type="text"
                  required
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="ex: Carterie, Goodies Acme, Vœux 2026..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={2}
                  placeholder="Contexte de la bibliothèque (optionnel)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client associé</label>
                <select
                  value={draft.client_id ?? ''}
                  onChange={(e) => setDraft({ ...draft, client_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="">— Aucun —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company}
                    </option>
                  ))}
                </select>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editing ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
