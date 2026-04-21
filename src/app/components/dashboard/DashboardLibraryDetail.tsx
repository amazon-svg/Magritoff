import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Package, Pencil, Trash2, X, Loader2 } from 'lucide-react';
import { useLibrary, LibraryProduct } from '../../contexts/LibraryContext';
import { useClients } from '../../contexts/ClientsContext';
import { usePlan } from '../../hooks/usePlan';
import { UpgradeCTA } from './UpgradeCTA';

export function DashboardLibraryDetail() {
  const { id } = useParams<{ id: string }>();
  const { canUse } = usePlan();
  const { libraries, productsByLibrary, updateProduct, deleteProduct } = useLibrary();
  const { clients } = useClients();

  const [editing, setEditing] = useState<LibraryProduct | null>(null);
  const [saving, setSaving] = useState(false);

  const library = useMemo(() => libraries.find((l) => l.id === id) ?? null, [libraries, id]);
  const products = useMemo(() => (library ? productsByLibrary(library.id) : []), [library, productsByLibrary]);

  if (!canUse('library')) return <UpgradeCTA feature="Bibliothèques" />;

  if (!library) {
    return (
      <div className="space-y-3">
        <Link to="/dashboard/library" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" />
          Retour aux bibliothèques
        </Link>
        <p className="text-sm text-gray-500">Bibliothèque introuvable.</p>
      </div>
    );
  }

  const client = clients.find((c) => c.id === library.client_id);

  const grouped = products.reduce((map, p) => {
    const cat = p.category || 'Autres';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(p);
    return map;
  }, new Map<string, LibraryProduct[]>());

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    await updateProduct(editing.id, {
      name: editing.name,
      category: editing.category,
      description: editing.description,
      price_ht: editing.price_ht,
      image_url: editing.image_url,
      active: editing.active,
    });
    setSaving(false);
    setEditing(null);
  };

  return (
    <div className="space-y-5">
      <Link to="/dashboard/library" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" />
        Retour aux bibliothèques
      </Link>

      <div>
        <h2 className="text-xl font-bold text-gray-900">{library.name}</h2>
        {client && <p className="text-sm text-blue-700 mt-0.5">Client : {client.company}</p>}
        {library.description && <p className="text-sm text-gray-600 mt-1">{library.description}</p>}
        <p className="text-xs text-gray-500 mt-2">{products.length} produit(s)</p>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Bibliothèque vide.</p>
          <Link to="/" className="text-sm text-blue-600 hover:underline">
            Calcule des produits et ajoute-les ici depuis le chat
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {Array.from(grouped.entries()).map(([cat, items]) => (
            <section key={cat}>
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">
                {cat} ({items.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((p) => (
                  <div key={p.id} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-28 object-cover" />
                    ) : (
                      <div className="w-full h-28 bg-gray-100 flex items-center justify-center text-gray-300">
                        <Package className="w-8 h-8" />
                      </div>
                    )}
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => setEditing(p)}
                            className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Supprimer ${p.name} ?`)) deleteProduct(p.id);
                            }}
                            className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {p.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</p>
                      )}
                      <p className="text-sm font-bold text-gray-900 mt-2">{p.price_ht.toFixed(2)} € HT</p>
                      {!p.active && (
                        <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          Inactif
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Modifier le produit</h3>
              <button onClick={() => setEditing(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveEdit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                <input
                  type="text"
                  required
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                <input
                  type="text"
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix HT (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editing.price_ht}
                  onChange={(e) => setEditing({ ...editing, price_ht: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL de l'image</label>
                <input
                  type="url"
                  value={editing.image_url}
                  onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
                <span className="text-sm text-gray-700">Produit actif</span>
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
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
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
