import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import { ArrowLeft, Save, Loader2, Trash2, Check, ExternalLink, Library as LibraryIcon, PackagePlus, Download } from 'lucide-react';
import { useShops, Shop, ShopProduct } from '../../contexts/ShopsContext';
import { useLibrary } from '../../contexts/LibraryContext';
import { useClients } from '../../contexts/ClientsContext';
import { usePIM } from '../../contexts/PIMContext';
import { usePlan } from '../../hooks/usePlan';
import { UpgradeCTA } from './UpgradeCTA';
import { exportShopToShopifyCsv, exportShopToJson } from '../../utils/shopExport';

export function DashboardShopEditor() {
  const { id } = useParams<{ id: string }>();
  const { canUse } = usePlan();
  const { shops, updateShop, getShopProducts, addShopProduct, removeShopProduct } = useShops();
  const { products: library, libraries, productsByLibrary } = useLibrary();
  const { clients } = useClients();
  const { gammes, definitions } = usePIM();

  const [shop, setShop] = useState<Shop | null>(null);
  const [shopProducts, setShopProducts] = useState<ShopProduct[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bulkLibraryId, setBulkLibraryId] = useState<string>('');
  const [bulkAdding, setBulkAdding] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    const s = shops.find((s) => s.id === id) ?? null;
    setShop(s);
    if (s) {
      getShopProducts(s.id).then((list) => {
        setShopProducts(list);
        setLoading(false);
      });
    } else if (shops.length > 0) {
      setLoading(false);
    }
  }, [id, shops]);

  if (!canUse('shops')) return <UpgradeCTA feature="Boutiques en ligne" />;

  if (loading) return <p className="text-sm text-gray-500">Chargement...</p>;
  if (!shop) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">Boutique introuvable.</p>
        <Link to="/dashboard/shops" className="text-sm text-blue-600 hover:underline">
          ← Retour aux boutiques
        </Link>
      </div>
    );
  }

  const publicUrl = `${window.location.origin}/shop/${shop.slug}`;
  const inShopLibraryIds = new Set(shopProducts.map((sp) => sp.product_id).filter(Boolean) as string[]);

  const handleSaveShop = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      await updateShop(shop.id, {
        name: shop.name,
        description: shop.description,
        client_id: shop.client_id,
        logo_url: shop.logo_url,
        address: shop.address,
        contact_email: shop.contact_email,
        theme: shop.theme,
        active: shop.active,
        library_ids: shop.library_ids ?? [],
      });
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (err: any) {
      setSaveError(
        err?.message?.includes('library_ids')
          ? `Erreur : la colonne "library_ids" n'existe pas. Applique la migration SQL indiquée.`
          : err?.message || 'Erreur inconnue lors de la sauvegarde'
      );
    }
    setSaving(false);
  };

  const toggleLinkedLibrary = (libraryId: string) => {
    if (!shop) return;
    const current = new Set(shop.library_ids ?? []);
    if (current.has(libraryId)) current.delete(libraryId);
    else current.add(libraryId);
    setShop({ ...shop, library_ids: Array.from(current) });
  };

  const handleAddFromLibrary = async (libProductId: string) => {
    const p = library.find((x) => x.id === libProductId);
    if (!p) return;
    await addShopProduct(shop.id, {
      product_id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      price_ht: p.price_ht,
      image_url: p.image_url,
      config: p.config,
      display_order: shopProducts.length,
    });
    const fresh = await getShopProducts(shop.id);
    setShopProducts(fresh);
  };

  const handleBulkAddLibrary = async () => {
    if (!bulkLibraryId || !shop) return;
    setBulkAdding(true);
    const libProducts = productsByLibrary(bulkLibraryId).filter((p) => p.active);
    const existingIds = new Set(shopProducts.map((sp) => sp.product_id).filter(Boolean) as string[]);
    const toAdd = libProducts.filter((p) => !existingIds.has(p.id));
    let order = shopProducts.length;
    for (const p of toAdd) {
      await addShopProduct(shop.id, {
        product_id: p.id,
        name: p.name,
        category: p.category,
        description: p.description,
        price_ht: p.price_ht,
        image_url: p.image_url,
        config: p.config,
        display_order: order++,
      });
    }
    const fresh = await getShopProducts(shop.id);
    setShopProducts(fresh);
    setBulkAdding(false);
    setBulkLibraryId('');
    if (toAdd.length === 0) {
      alert('Tous les produits de cette bibliothèque sont déjà dans la boutique.');
    } else {
      alert(`${toAdd.length} produit(s) ajouté(s) à la boutique.`);
    }
  };

  const handleRemove = async (id: string) => {
    await removeShopProduct(id);
    setShopProducts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/dashboard/shops" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          <ExternalLink className="w-4 h-4" />
          Voir la boutique publique
        </a>
      </div>

      <h2 className="text-xl font-bold text-gray-900">Éditeur — {shop.name}</h2>

      {/* ── Infos de base ── */}
      <section className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
        <h3 className="font-semibold text-gray-900">Informations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nom</label>
            <input
              type="text"
              value={shop.name}
              onChange={(e) => setShop({ ...shop, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Client associé</label>
            <select
              value={shop.client_id ?? ''}
              onChange={(e) => setShop({ ...shop, client_id: e.target.value || null })}
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
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={shop.description}
              onChange={(e) => setShop({ ...shop, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Logo (URL)</label>
            <input
              type="url"
              value={shop.logo_url}
              onChange={(e) => setShop({ ...shop, logo_url: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email de contact</label>
            <input
              type="email"
              value={shop.contact_email}
              onChange={(e) => setShop({ ...shop, contact_email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Adresse (affichée sur la boutique)</label>
            <textarea
              value={shop.address}
              onChange={(e) => setShop({ ...shop, address: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
      </section>

      {/* ── Thème ── */}
      <section className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
        <h3 className="font-semibold text-gray-900">Apparence</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Couleur primaire</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={shop.theme.primaryColor}
                onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, primaryColor: e.target.value } })}
                className="h-10 w-12 border border-gray-300 rounded"
              />
              <input
                type="text"
                value={shop.theme.primaryColor}
                onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, primaryColor: e.target.value } })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Couleur d'accent</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={shop.theme.accentColor}
                onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, accentColor: e.target.value } })}
                className="h-10 w-12 border border-gray-300 rounded"
              />
              <input
                type="text"
                value={shop.theme.accentColor}
                onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, accentColor: e.target.value } })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Mode</label>
            <select
              value={shop.theme.mode}
              onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, mode: e.target.value as 'light' | 'dark' } })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
            >
              <option value="light">Clair</option>
              <option value="dark">Sombre</option>
            </select>
          </div>
        </div>
      </section>

      {/* ── Activation ── */}
      <section className="border border-gray-200 rounded-xl p-4 bg-white">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={shop.active}
            onChange={(e) => setShop({ ...shop, active: e.target.checked })}
            className="w-4 h-4"
          />
          <div>
            <p className="text-sm font-medium text-gray-900">Boutique active</p>
            <p className="text-xs text-gray-500">Accessible publiquement via l'URL. Désactivez pour masquer.</p>
          </div>
        </label>
      </section>

      {/* ── Sauvegarde ── */}
      <div className="space-y-2">
        <button
          onClick={handleSaveShop}
          disabled={saving}
          className="px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 font-medium flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer les modifications
        </button>
        {saveOk && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded flex items-center gap-2">
            <Check className="w-4 h-4" /> Sauvegardé
          </p>
        )}
        {saveError && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">{saveError}</p>
        )}
      </div>

      {/* ── Export ── */}
      <section className="border border-gray-200 rounded-xl p-4 bg-white">
        <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <Download className="w-5 h-5" />
          Exporter le catalogue
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Génère un fichier prêt à importer dans un CMS e-commerce. Les contenus enrichis PIM (descriptions, SEO, FAQ, mots-clés) sont inclus.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => exportShopToShopifyCsv(shop, shopProducts, gammes, definitions)}
            disabled={shopProducts.length === 0}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Shopify (CSV)
          </button>
          <button
            onClick={() => exportShopToJson(shop, shopProducts, gammes, definitions)}
            disabled={shopProducts.length === 0}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export JSON (API-ready)
          </button>
        </div>
      </section>

      {/* ── Produits du shop ── */}
      <section className="border border-gray-200 rounded-xl p-4 bg-white">
        <h3 className="font-semibold text-gray-900 mb-3">
          Produits dans cette boutique ({shopProducts.length})
        </h3>
        {shopProducts.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Aucun produit. Ajoutez-en depuis la bibliothèque ci-dessous.</p>
        ) : (
          <div className="space-y-2">
            {shopProducts.map((sp) => (
              <div key={sp.id} className="flex items-center gap-3 p-2 border border-gray-100 rounded-lg">
                {sp.image_url ? (
                  <img src={sp.image_url} alt={sp.name} className="w-12 h-12 object-cover rounded" />
                ) : (
                  <div className="w-12 h-12 bg-gray-100 rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{sp.name}</p>
                  <p className="text-xs text-gray-500">
                    {sp.category} · {sp.price_ht.toFixed(2)} € HT
                  </p>
                </div>
                <button
                  onClick={() => handleRemove(sp.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Bibliothèques liées (synchro automatique) ── */}
      <section className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50">
        <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <LibraryIcon className="w-5 h-5 text-blue-600" />
          Bibliothèques liées à cette boutique
        </h3>
        <p className="text-sm text-gray-700 mb-3">
          Les produits ajoutés à ces bibliothèques (depuis le chat) apparaissent <strong>automatiquement</strong> sur la boutique publique. Pas besoin de ré-importer.
        </p>
        {libraries.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            Aucune bibliothèque.{' '}
            <Link to="/dashboard/library" className="text-blue-600 hover:underline">
              Crée-en une
            </Link>
          </p>
        ) : (
          <div className="space-y-1">
            {libraries.map((lib) => {
              const linked = (shop.library_ids ?? []).includes(lib.id);
              const count = productsByLibrary(lib.id).length;
              return (
                <label
                  key={lib.id}
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${
                    linked ? 'bg-white border border-blue-300' : 'hover:bg-white/60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={linked}
                    onChange={() => toggleLinkedLibrary(lib.id)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-900 flex-1">{lib.name}</span>
                  <span className="text-xs text-gray-500">{count} produit{count > 1 ? 's' : ''}</span>
                </label>
              );
            })}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-2">
          N'oublie pas d'<strong>Enregistrer</strong> ci-dessus après modification.
        </p>
      </section>

      {/* ── Ajout groupé depuis une bibliothèque (one-shot, pour produits isolés) ── */}
      <section className="border border-gray-200 rounded-xl p-4 bg-white">
        <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <LibraryIcon className="w-5 h-5" />
          Importer une bibliothèque entière (copie figée)
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Ajoute tous les produits d'une bibliothèque en un clic (seuls les produits pas encore présents seront ajoutés).
        </p>
        {libraries.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            Aucune bibliothèque.{' '}
            <Link to="/dashboard/library" className="text-blue-600 hover:underline">
              Crée-en une
            </Link>
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkLibraryId}
              onChange={(e) => setBulkLibraryId(e.target.value)}
              className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg bg-white"
            >
              <option value="">— Choisir une bibliothèque —</option>
              {libraries.map((lib) => {
                const count = productsByLibrary(lib.id).length;
                return (
                  <option key={lib.id} value={lib.id}>
                    {lib.name} ({count} produit{count > 1 ? 's' : ''})
                  </option>
                );
              })}
            </select>
            <button
              onClick={handleBulkAddLibrary}
              disabled={!bulkLibraryId || bulkAdding}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 text-sm font-medium"
            >
              {bulkAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackagePlus className="w-4 h-4" />}
              Ajouter tous les produits
            </button>
          </div>
        )}
      </section>

      {/* ── Picker Bibliothèque (produit par produit) ── */}
      <section className="border border-gray-200 rounded-xl p-4 bg-white">
        <h3 className="font-semibold text-gray-900 mb-3">Ajouter produit par produit</h3>
        {library.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            Votre bibliothèque est vide.{' '}
            <Link to="/dashboard/library" className="text-blue-600 hover:underline">
              Ajouter des produits
            </Link>
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {library
              .filter((p) => p.active)
              .map((p) => {
                const added = inShopLibraryIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    disabled={added}
                    onClick={() => handleAddFromLibrary(p.id)}
                    className={`flex items-center gap-3 p-2 border rounded-lg text-left ${
                      added
                        ? 'bg-green-50 border-green-200 cursor-default'
                        : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-10 h-10 object-cover rounded" />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.price_ht.toFixed(2)} € HT</p>
                    </div>
                    {added && <Check className="w-4 h-4 text-green-600" />}
                  </button>
                );
              })}
          </div>
        )}
      </section>
    </div>
  );
}
