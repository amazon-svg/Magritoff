/**
 * DashboardShopEditor v3 — refonte 2026-04-24
 * ────────────────────────────────────────────
 * Refonte suite aux retours Arnaud :
 *
 * 1. Modele unique pour peupler une boutique : bibliotheques associees.
 *    Plus d'import bulk, plus de picker produit par produit. L'admin
 *    associe 1..N bibliotheques a la boutique ; tous leurs produits
 *    apparaissent automatiquement dans la liste.
 *
 * 2. Liste "Produits dans cette boutique" est une vue agregee :
 *      - produits des bibliotheques liees (via product_library)
 *      - MINUS les excluded_product_ids (produits retires manuellement)
 *      - PLUS les shop_products legacy (pour compat avec d'anciennes
 *        boutiques qui avaient utilise le bulk import)
 *
 * 3. Sur delete d'un produit : dialog demandant si on veut aussi le
 *    retirer de la bibliotheque.
 *      - Non → push dans shops.excluded_product_ids (masque uniquement)
 *      - Oui → deleteProduct (library) → disparait de toutes les boutiques
 *
 * 4. Section "Exporter le catalogue" deplacee juste apres la liste des
 *    produits.
 *
 * 5. Bouton "Enregistrer les modifications" en bas a droite, sticky.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import {
  ArrowLeft, Save, Loader2, Trash2, Check, ExternalLink, Library as LibraryIcon,
  Download, AlertTriangle, EyeOff, Eye,
} from 'lucide-react';
import { useShops, Shop, ShopProduct } from '../../contexts/ShopsContext';
import { useLibrary, LibraryProduct } from '../../contexts/LibraryContext';
import { usePIM } from '../../contexts/PIMContext';
import { usePlan } from '../../hooks/usePlan';
import { useTenantPath } from '../../hooks/useTenantPath';
import { UpgradeCTA } from './UpgradeCTA';
import { exportShopToShopifyCsv, exportShopToJson } from '../../utils/shopExport';
import { lazy, Suspense as ReactSuspense } from 'react';

// S9 audit perf bundle (Sprint 9, 2026-06-01) : lazy-load ShopVisualSettings
// (V4 Sprint 7). Composant ~340 lignes + Storage SDK seulement utilise dans
// DashboardShopEditor. Suspense fallback = null (section visible apres scroll).
const ShopVisualSettings = lazy(() =>
  import('./ShopVisualSettings').then((m) => ({ default: m.ShopVisualSettings })),
);

/**
 * Produit affiche dans la liste agregee. On normalise deux sources :
 *   - library (product_library) via library_ids
 *   - shop_products legacy (bulk import)
 */
interface DisplayProduct {
  id: string;                  // id stable pour React key
  source: 'library' | 'shop';  // d'ou il vient
  sourceId: string;            // product_library.id OU shop_products.id
  libraryProductId?: string;   // uniquement si source=library
  name: string;
  category: string;
  description: string;
  price_ht: number;
  image_url: string;
}

export function DashboardShopEditor() {
  const { id } = useParams<{ id: string }>();
  const { canUse } = usePlan();
  const tp = useTenantPath();
  const {
    shops,
    updateShop,
    getShopProducts,
    removeShopProduct,
    excludeProduct,
    includeProduct,
  } = useShops();
  const { products: library, libraries, productsByLibrary, deleteProduct } = useLibrary();
  const { gammes, definitions } = usePIM();

  const [shop, setShop] = useState<Shop | null>(null);
  const [shopProducts, setShopProducts] = useState<ShopProduct[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  // Dialog de confirmation suppression
  const [deleteDialog, setDeleteDialog] = useState<DisplayProduct | null>(null);

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

  // ─── Liste agregee des produits affichable dans la boutique ─────────────
  // IMPORTANT : le useMemo doit etre declare AVANT les early returns (regle
  // des hooks React). On gere le cas shop=null a l'interieur du callback.
  const displayProducts: DisplayProduct[] = useMemo(() => {
    if (!shop) return [];
    const excluded = new Set(shop.excluded_product_ids ?? []);
    const libIds = new Set(shop.library_ids ?? []);

    // 1. Produits des bibliotheques liees
    const fromLibraries: DisplayProduct[] = library
      .filter((p) => p.active !== false)
      .filter((p) => p.library_id && libIds.has(p.library_id))
      .filter((p) => !excluded.has(p.id))
      .map((p) => ({
        id: `lib-${p.id}`,
        source: 'library' as const,
        sourceId: p.id,
        libraryProductId: p.id,
        name: p.name,
        category: p.category || 'Autres',
        description: p.description || '',
        price_ht: Number(p.price_ht) || 0,
        image_url: p.image_url || '',
      }));

    // 2. Produits legacy (shop_products sans lien library OU avec
    //    product_id qui n'est pas dans les libraries liees)
    const libProductIds = new Set(
      library.filter((p) => p.library_id && libIds.has(p.library_id)).map((p) => p.id)
    );
    const fromShop: DisplayProduct[] = shopProducts
      .filter((sp) => !sp.product_id || !libProductIds.has(sp.product_id))
      .map((sp) => ({
        id: `shop-${sp.id}`,
        source: 'shop' as const,
        sourceId: sp.id,
        name: sp.name,
        category: sp.category || 'Autres',
        description: sp.description || '',
        price_ht: Number(sp.price_ht) || 0,
        image_url: sp.image_url || '',
      }));

    return [...fromLibraries, ...fromShop];
    // On depend uniquement des champs primitifs du shop pour que la memo
    // se recalcule quand library_ids ou excluded_product_ids changent.
  }, [library, shopProducts, shop?.excluded_product_ids, shop?.library_ids]);

  if (!canUse('shops')) return <UpgradeCTA feature="Boutiques en ligne" />;
  if (loading) return <p className="text-sm text-gray-500">Chargement...</p>;
  if (!shop) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">Boutique introuvable.</p>
        <Link to={tp('/dashboard/shops')} className="text-sm text-blue-600 hover:underline">
          ← Retour aux boutiques
        </Link>
      </div>
    );
  }

  const publicUrl = `${window.location.origin}/shop/${shop.slug}`;

  // ─── Actions shop ────────────────────────────────────────────────────────

  const handleSaveShop = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      await updateShop(shop.id, {
        name: shop.name,
        description: shop.description,
        logo_url: shop.logo_url,
        address: shop.address,
        contact_email: shop.contact_email,
        theme: shop.theme,
        active: shop.active,
        library_ids: shop.library_ids ?? [],
        hero_image_url: shop.hero_image_url ?? null,
        tagline: shop.tagline ?? null,
      });
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (err: any) {
      setSaveError(err?.message || 'Erreur inconnue lors de la sauvegarde');
    }
    setSaving(false);
  };

  const toggleLinkedLibrary = (libraryId: string) => {
    const current = new Set(shop.library_ids ?? []);
    if (current.has(libraryId)) current.delete(libraryId);
    else current.add(libraryId);
    setShop({ ...shop, library_ids: Array.from(current) });
  };

  // ─── Gestion de la suppression produit (dialog) ─────────────────────────

  const handleRequestDelete = (product: DisplayProduct) => {
    if (product.source === 'shop') {
      // Legacy shop_product : pas de dialog, supprime direct.
      if (confirm(`Retirer "${product.name}" de la boutique ?`)) {
        void (async () => {
          await removeShopProduct(product.sourceId);
          setShopProducts((prev) => prev.filter((sp) => sp.id !== product.sourceId));
        })();
      }
      return;
    }
    // Source library → dialog avec choix
    setDeleteDialog(product);
  };

  const handleDeleteFromShopOnly = async () => {
    if (!deleteDialog || !deleteDialog.libraryProductId) return;
    await excludeProduct(shop.id, deleteDialog.libraryProductId);
    // On refresh le shop courant dans le state local
    const updated = shops.find((s) => s.id === shop.id);
    if (updated) setShop(updated);
    setDeleteDialog(null);
  };

  const handleDeleteFromBoth = async () => {
    if (!deleteDialog || !deleteDialog.libraryProductId) return;
    await deleteProduct(deleteDialog.libraryProductId);
    setDeleteDialog(null);
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-24">
      {/* Header : retour + voir boutique */}
      <div className="flex items-center justify-between">
        <Link
          to={tp('/dashboard/shops')}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
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

      {/* ── A4.1 — Bannière hero + tagline ── */}
      <section className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
        <h3 className="font-semibold text-gray-900">Bannière hero</h3>
        <p className="text-xs text-gray-500">
          Image visuelle affichée en tête de votre boutique publique. Laissez l'URL vide pour ne rien afficher.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Image hero (URL)</label>
            <input
              type="url"
              value={shop.hero_image_url ?? ''}
              onChange={(e) =>
                setShop({ ...shop, hero_image_url: e.target.value ? e.target.value : null })
              }
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Phrase d'accroche{' '}
              <span className="text-gray-400 font-normal">
                ({(shop.tagline ?? '').length}/120)
              </span>
            </label>
            <textarea
              value={shop.tagline ?? ''}
              onChange={(e) => {
                const next = e.target.value.slice(0, 120);
                setShop({ ...shop, tagline: next ? next : null });
              }}
              rows={2}
              maxLength={120}
              placeholder="Ex: Vos imprimés professionnels en 48h."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
        {/* Aperçu live : montré dès qu'une URL est saisie */}
        {shop.hero_image_url && (
          <div className="mt-2">
            <p className="text-xs text-gray-500 mb-1">Aperçu</p>
            <div
              className="relative w-full h-[120px] rounded-lg bg-cover bg-center overflow-hidden border border-gray-200"
              style={{ backgroundImage: `url(${shop.hero_image_url})` }}
            >
              {shop.tagline && (
                <div className="absolute inset-x-0 bottom-0 px-4 pb-3 pt-8 bg-gradient-to-t from-black/60 via-black/30 to-transparent">
                  <p className="text-white text-sm font-medium m-0 drop-shadow-md">
                    {shop.tagline}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
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

      {/* ── Activation + bouton biblio sous le toggle ── */}
      <section className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
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

        {/* Raccourci vers la gestion des bibliotheques (remplace l'item
            sidebar "Bibliotheque" qui est maintenant sub-item de Boutiques) */}
        <Link
          to={tp('/dashboard/library')}
          className="inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 hover:underline"
        >
          <LibraryIcon className="w-4 h-4" />
          Gérer mes bibliothèques
        </Link>
      </section>

      {/* ── Bibliothèques associées (unique mecanisme de peuplement) ── */}
      <section className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50">
        <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <LibraryIcon className="w-5 h-5 text-blue-600" />
          Bibliothèques associées à cette boutique
        </h3>
        <p className="text-sm text-gray-700 mb-3">
          Cochez une ou plusieurs bibliothèques. <strong>Tous leurs produits</strong> apparaissent
          automatiquement dans la boutique — pas d'import, pas de copie, toujours synchro.
        </p>
        {libraries.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            Aucune bibliothèque.{' '}
            <Link to={tp('/dashboard/library')} className="text-blue-600 hover:underline">
              Créez-en une
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
                  <span className="text-xs text-gray-500">
                    {count} produit{count > 1 ? 's' : ''}
                  </span>
                </label>
              );
            })}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-2">
          N'oubliez pas d'<strong>Enregistrer</strong> en bas de page après modification.
        </p>
      </section>

      {/* ── Produits dans cette boutique (vue agregee) ── */}
      <section className="border border-gray-200 rounded-xl p-4 bg-white">
        <h3 className="font-semibold text-gray-900 mb-3">
          Produits dans cette boutique ({displayProducts.length})
        </h3>
        {displayProducts.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            Aucun produit. Associez une bibliothèque ci-dessus pour les voir apparaître.
          </p>
        ) : (
          <div className="space-y-2">
            {displayProducts.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 p-2 border border-gray-100 rounded-lg"
              >
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-12 h-12 object-cover rounded" />
                ) : (
                  <div className="w-12 h-12 bg-gray-100 rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    {p.source === 'library' ? (
                      <>biblio · {p.category} · {p.price_ht.toFixed(2)} € HT</>
                    ) : (
                      <>legacy · {p.category} · {p.price_ht.toFixed(2)} € HT</>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => handleRequestDelete(p)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Retirer de la boutique"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* E9.11 — Exclusions actuelles : reintegration one-click. */}
        {shop.excluded_product_ids && shop.excluded_product_ids.length > 0 && (
          <details className="mt-4 text-xs text-gray-600">
            <summary className="cursor-pointer hover:text-gray-900">
              {shop.excluded_product_ids.length} produit
              {shop.excluded_product_ids.length > 1 ? 's' : ''} masqué
              {shop.excluded_product_ids.length > 1 ? 's' : ''} dans cette boutique
            </summary>
            <p className="mt-2 text-gray-500">
              Ces produits existent dans les bibliothèques liées mais ont été retirés manuellement
              de cette boutique. Cliquez sur « Réintégrer » pour les ré-afficher.
            </p>
            <ul className="mt-3 space-y-1">
              {shop.excluded_product_ids.map((libProductId) => {
                const p = library.find((lp) => lp.id === libProductId);
                const label = p?.name ?? `(produit supprimé · ${libProductId.slice(0, 8)})`;
                const stillInLinkedLibrary =
                  !!p &&
                  !!p.library_id &&
                  (shop.library_ids ?? []).includes(p.library_id);
                return (
                  <li
                    key={libProductId}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-gray-50"
                  >
                    <span className="text-gray-700 truncate">
                      {label}
                      {p && !stillInLinkedLibrary && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-700">
                          bibliothèque non liée
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        await includeProduct(shop.id, libProductId);
                        const updated = shops.find((s) => s.id === shop.id);
                        if (updated) setShop(updated);
                      }}
                      disabled={!stillInLinkedLibrary}
                      title={
                        stillInLinkedLibrary
                          ? 'Ré-afficher ce produit dans la boutique'
                          : "La bibliothèque source n est plus liée à cette boutique — re-cochez-la d abord"
                      }
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-[11px] font-medium text-gray-700"
                    >
                      <Eye className="w-3 h-3" />
                      Réintégrer
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </section>

      {/* ── S-PIM-VISUELS-4 : Visuels boutique (fond + couleur primaire) ── */}
      {/* Lazy-load S9 audit perf : composant ~340 lignes + Storage SDK */}
      {shop && (
        <ReactSuspense fallback={null}>
          <ShopVisualSettings
            shopId={shop.id}
            availableGammes={gammes.map((g) => ({ slug: g.slug, name: g.name }))}
          />
        </ReactSuspense>
      )}

      {/* ── Exporter le catalogue (deplace sous la liste des produits) ── */}
      <section className="border border-gray-200 rounded-xl p-4 bg-white">
        <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <Download className="w-5 h-5" />
          Exporter le catalogue
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Génère un fichier prêt à importer dans un CMS e-commerce.
          Les contenus enrichis PIM (descriptions, SEO, FAQ, mots-clés) sont inclus.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              exportShopToShopifyCsv(
                shop,
                displayProducts.map(toExportProduct),
                gammes,
                definitions
              )
            }
            disabled={displayProducts.length === 0}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Shopify (CSV)
          </button>
          <button
            onClick={() =>
              exportShopToJson(
                shop,
                displayProducts.map(toExportProduct),
                gammes,
                definitions
              )
            }
            disabled={displayProducts.length === 0}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export JSON (API-ready)
          </button>
        </div>
      </section>

      {/* ── Bouton Enregistrer : sticky en bas a droite ── */}
      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-2">
        {saveError && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded shadow-sm max-w-xs">
            {saveError}
          </p>
        )}
        {saveOk && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded shadow-sm flex items-center gap-2">
            <Check className="w-4 h-4" /> Sauvegardé
          </p>
        )}
        <button
          onClick={handleSaveShop}
          disabled={saving}
          className="px-5 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 font-medium flex items-center gap-2 shadow-lg"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer les modifications
        </button>
      </div>

      {/* ── Dialog : que faire quand on retire un produit lib ── */}
      {deleteDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">
                  Retirer "{deleteDialog.name}"
                </h4>
                <p className="text-sm text-gray-600">
                  Ce produit appartient à une bibliothèque associée à la boutique.
                  Voulez-vous aussi le retirer de la bibliothèque, ou seulement de cette
                  boutique ?
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleDeleteFromShopOnly}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-800"
              >
                <EyeOff className="w-4 h-4" />
                Juste de cette boutique
                <span className="text-xs text-gray-500">(reste dans la biblio)</span>
              </button>
              <button
                onClick={handleDeleteFromBoth}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                De la boutique ET de la bibliothèque
              </button>
              <button
                onClick={() => setDeleteDialog(null)}
                className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Adapte un DisplayProduct au shape attendu par exportShopToShopifyCsv /
// exportShopToJson (qui attend des ShopProduct).
function toExportProduct(p: {
  sourceId: string;
  libraryProductId?: string;
  name: string;
  category: string;
  description: string;
  price_ht: number;
  image_url: string;
}): ShopProduct {
  return {
    id: p.sourceId,
    shop_id: '',
    product_id: p.libraryProductId ?? null,
    name: p.name,
    category: p.category,
    description: p.description,
    price_ht: p.price_ht,
    image_url: p.image_url,
    config: {},
    display_order: 0,
  } as ShopProduct;
}
