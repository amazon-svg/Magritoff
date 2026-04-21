import { useState } from 'react';
import { X, Loader2, Plus, Library as LibraryIcon } from 'lucide-react';
import { useLibrary } from '../contexts/LibraryContext';
import { useClients } from '../contexts/ClientsContext';

interface Props {
  preferredClientId?: string | null;
  productCount?: number;
  onPick: (libraryId: string) => Promise<void> | void;
  onClose: () => void;
}

export function LibraryPickerModal({ preferredClientId, productCount = 1, onPick, onClose }: Props) {
  const { libraries, createLibrary } = useLibrary();
  const { clients } = useClients();
  const [selected, setSelected] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(libraries.length === 0);
  const [newName, setNewName] = useState('');
  const [newClientId, setNewClientId] = useState<string | null>(preferredClientId ?? null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setSaving(true);
    let libraryId = selected;
    if (showCreate) {
      if (!newName.trim()) {
        setError('Donne un nom à ta bibliothèque.');
        setSaving(false);
        return;
      }
      const lib = await createLibrary({ name: newName.trim(), client_id: newClientId });
      if (!lib) {
        setError('Création impossible. Migration SQL appliquée ?');
        setSaving(false);
        return;
      }
      libraryId = lib.id;
    } else if (!libraryId) {
      setError('Choisis une bibliothèque.');
      setSaving(false);
      return;
    }
    await onPick(libraryId);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">
            Ajouter {productCount > 1 ? `${productCount} produits` : 'ce produit'} à une bibliothèque
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!showCreate && libraries.length > 0 && (
          <div className="space-y-2 mb-3 max-h-80 overflow-y-auto">
            {libraries.map((lib) => {
              const client = clients.find((c) => c.id === lib.client_id);
              return (
                <label
                  key={lib.id}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                    selected === lib.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    checked={selected === lib.id}
                    onChange={() => setSelected(lib.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{lib.name}</p>
                    {client && <p className="text-xs text-blue-700 truncate">→ {client.company}</p>}
                    {lib.description && (
                      <p className="text-xs text-gray-500 line-clamp-1">{lib.description}</p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full mb-3 flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-700 hover:border-gray-400 hover:bg-gray-50"
          >
            <Plus className="w-4 h-4" />
            Créer une nouvelle bibliothèque
          </button>
        )}

        {showCreate && (
          <div className="space-y-3 mb-3 border border-gray-200 rounded-lg p-3 bg-gray-50">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <LibraryIcon className="w-4 h-4" />
              Nouvelle bibliothèque
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Nom *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ex: Carterie, Goodies Acme..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Client associé (optionnel)</label>
              <select
                value={newClientId ?? ''}
                onChange={(e) => setNewClientId(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">— Aucun —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company}
                  </option>
                ))}
              </select>
            </div>
            {libraries.length > 0 && (
              <button
                onClick={() => setShowCreate(false)}
                className="text-xs text-blue-600 hover:underline"
              >
                ← Choisir une bibliothèque existante
              </button>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
          >
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}
