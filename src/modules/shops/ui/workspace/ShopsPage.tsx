import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Plus, Store, Trash2, Copy, ExternalLink, X, Loader2 } from 'lucide-react';
import { useShops, NewShopInput } from '@/modules/shops/ui/runtime/ShopsContext';
import { usePlan } from '@/modules/plans/ui/hooks';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { UpgradeCTA } from '@/modules/plans/ui/components';

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

  const removeShop = async (shop: { id: string; name: string }) => {
    const confirmed = confirm(
      `Supprimer définitivement la boutique « ${shop.name} » ?\n\n` +
      'Ses produits, réglages, comptes clients et commandes non validées seront supprimés. ' +
      'Les commandes déjà validées seront conservées pour l’historique. Cette action est irréversible.',
    );
    if (!confirmed) return;
    try {
      await deleteShop(shop.id);
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : 'Suppression de la boutique impossible.');
    }
  };

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
          <h2 className="text-lg font-semibold text-ink mb-1">Mes boutiques</h2>
          <p className="text-sm text-ink-muted">{shops.length} boutique(s).</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Créer une boutique
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">Chargement...</p>
      ) : shops.length === 0 ? (
        <div className="text-center py-12 text-ink-mute-2">
          <Store className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Aucune boutique. Créez-en une pour démarrer.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shops.map((shop) => {
            const url = publicUrl(shop.slug);
            return (
              <div key={shop.id} className="border border-line rounded-xl bg-paper p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        to={tp(`/dashboard/shops/${shop.id}`)}
                        className="font-semibold text-ink hover:underline"
                      >
                        {shop.name}
                      </Link>
                      {!shop.active && (
                        <span className="text-xs bg-bg text-ink-muted px-2 py-0.5 rounded-full">
                          Désactivée
                        </span>
                      )}
                    </div>
                    {shop.description && (
                      <p className="text-sm text-ink-muted mb-2">{shop.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <code className="text-xs bg-bg text-ink-2 px-2 py-1 rounded flex-1 truncate">
                        {url}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(url);
                          alert('URL copiée');
                        }}
                        className="p-1.5 text-ink-muted hover:text-ink hover:bg-bg rounded"
                        title="Copier l'URL"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-ink-muted hover:text-ink hover:bg-bg rounded"
                        title="Ouvrir"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                  <button
                    onClick={() => void removeShop(shop)}
                    className="p-2 text-ink-mute-2 hover:text-err-fg hover:bg-err-bg rounded"
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
            className="bg-paper rounded-2xl shadow-2xl w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-ink">Nouvelle boutique</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-bg rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">Nom *</label>
                <input
                  type="text"
                  required
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="ex: Boutique Imprimerie Dupont"
                  className="w-full px-3 py-2 border border-line-2 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">Description</label>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-line-2 rounded-lg"
                />
              </div>
              {error && (
                <p className="text-sm text-err-fg bg-err-bg p-2 rounded">{error}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-line-2 rounded-lg hover:bg-bg font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
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
