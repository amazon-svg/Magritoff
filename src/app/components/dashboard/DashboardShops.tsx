import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Plus, Store, Trash2, Copy, ExternalLink, X, Loader2 } from 'lucide-react';
import { useShops, NewShopInput } from '../../contexts/ShopsContext';
import { usePlan } from '../../hooks/usePlan';
import { useTenantPath } from '../../hooks/useTenantPath';
import { UpgradeCTA } from './UpgradeCTA';

export function DashboardShops() {
  const navigate = useNavigate();
  const { canUse } = usePlan();
  const tp = useTenantPath();
  const { shops, loading, createShop, deleteShop } = useShops();
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<NewShopInput>({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canUse('shops')) {
    return <UpgradeCTA feature="Boutiques en ligne" />;
  }

  const publicUrl = (slug: string) => `${window.location.origin}/shop/${slug}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const shop = await createShop(draft);
      setSaving(false);
      if (shop) {
        setModalOpen(false);
        setDraft({ name: '', description: '' });
        navigate(tp(`/dashboard/shops/${shop.id}`));
      }
    } catch (err: any) {
      setSaving(false);
      setError(err?.message || 'Erreur lors de la création de la boutique. As-tu bien appliqué la migration SQL shop_module ?');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Mes boutiques</h2>
          <p className="text-sm text-gray-600">{shops.length} boutique(s).</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Créer une boutique
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Chargement...</p>
      ) : shops.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Store className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Aucune boutique. Créez-en une pour démarrer.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shops.map((shop) => {
            const url = publicUrl(shop.slug);
            return (
              <div key={shop.id} className="border border-gray-200 rounded-xl bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        to={tp(`/dashboard/shops/${shop.id}`)}
                        className="font-semibold text-gray-900 hover:underline"
                      >
                        {shop.name}
                      </Link>
                      {!shop.active && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          Désactivée
                        </span>
                      )}
                    </div>
                    {shop.description && (
                      <p className="text-sm text-gray-600 mb-2">{shop.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <code className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded flex-1 truncate">
                        {url}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(url);
                          alert('URL copiée');
                        }}
                        className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded"
                        title="Copier l'URL"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded"
                        title="Ouvrir"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Supprimer la boutique "${shop.name}" ?`)) deleteShop(shop.id);
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
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
              <h3 className="text-xl font-bold text-gray-900">Nouvelle boutique</h3>
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
                  placeholder="ex: Boutique Imprimerie Dupont"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
              )}

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
                  Créer la boutique
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
