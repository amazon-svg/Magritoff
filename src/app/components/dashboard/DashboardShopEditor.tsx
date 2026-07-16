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
  Download, AlertTriangle, EyeOff, Eye, Upload,
} from 'lucide-react';
import { useShops, Shop, ShopProduct } from '../../contexts/ShopsContext';
import { FONT_PAIRINGS } from '../shop/fontPairings';
import { supabase } from '/utils/supabase/client';
import { useTenant } from '../../contexts/TenantContext';
import { useLibrary, LibraryProduct } from '../../contexts/LibraryContext';
import { usePIM } from '../../contexts/PIMContext';
import { usePlan } from '../../hooks/usePlan';
import { useTenantPath } from '../../hooks/useTenantPath';
import { UpgradeCTA } from './UpgradeCTA';
import { exportShopToShopifyCsv, exportShopToJson } from '../../utils/shopExport';
import { resolveShopProductScope } from '../../utils/resolveShopProductScope';
import { TEST_IDS } from '../../lib/testIds';
import { lazy, Suspense as ReactSuspense } from 'react';

// P4-VISUELS (2026-06-15) : lazy-load ShopCustomMockups (upload custom).
// P9-CLEANUP (2026-06-15) : ShopVisualSettings supprimé (remplacé par
// ShopCustomMockups qui couvre 100% du besoin per-shop).
const ShopCustomMockups = lazy(() =>
  import('./ShopCustomMockups').then((m) => ({ default: m.ShopCustomMockups })),
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
  // A4.5 — Prix négociés per-shop. Map clé = library_product_id, valeur = override
  // en number. Source de vérité locale, synchronisée à la DB sur blur.
  const [pricingOverrides, setPricingOverrides] = useState<Record<string, number>>({});
  const { currentTenant } = useTenant();

  // Dialog de confirmation suppression
  const [deleteDialog, setDeleteDialog] = useState<DisplayProduct | null>(null);

  // S2.32 — Gammes recensees du tenant (tenant_gamme_subscriptions), source
  // du depliage du mode PIM. On stocke les slugs ; le libelle vient de PIM
  // (`gammes`). pimExpanded = etat d'ouverture du bloc PIM.
  const [subscribedSlugs, setSubscribedSlugs] = useState<string[]>([]);
  const [pimExpanded, setPimExpanded] = useState(false);

  // ─── Upload branding (logo / fond du bandeau) — bucket public shop_backgrounds
  // (2026-07-08, refonte bandeau de marque). Réutilise le bucket + RLS
  // can_manage_catalog déjà en place (S-PIM-VISUELS-2). Path <shop_id>/<kind>-<uuid>.
  const [uploadingAsset, setUploadingAsset] = useState<null | 'logo' | 'hero'>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadBrandAsset = async (kind: 'logo' | 'hero', file: File) => {
    if (!shop) return;
    setUploadError(null);
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
    if (!ALLOWED.includes(file.type)) {
      setUploadError('Format non supporté — PNG, JPG ou WebP attendu.');
      return;
    }
    if (file.size > 5_242_880) {
      setUploadError('Fichier trop lourd — 5 Mo maximum.');
      return;
    }
    setUploadingAsset(kind);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${shop.id}/${kind}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('shop_backgrounds')
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
      if (upErr) throw new Error(upErr.message);
      const { data: pub } = supabase.storage.from('shop_backgrounds').getPublicUrl(path);
      setShop((prev) =>
        prev
          ? { ...prev, [kind === 'logo' ? 'logo_url' : 'hero_image_url']: pub.publicUrl }
          : prev,
      );
    } catch (e: any) {
      setUploadError(`Upload échoué : ${e?.message ?? 'erreur réseau'}.`);
    } finally {
      setUploadingAsset(null);
    }
  };

  useEffect(() => {
    const s = shops.find((s) => s.id === id) ?? null;
    setShop(s);
    if (s) {
      Promise.all([
        getShopProducts(s.id),
        // A4.5 — Charger les overrides de prix de cette boutique
        supabase
          .from('shop_product_pricing')
          .select('library_product_id, price_ht_override')
          .eq('shop_id', s.id)
          .then((res) => res.data ?? []),
      ]).then(([products, overrides]) => {
        setShopProducts(products);
        const map: Record<string, number> = {};
        for (const o of overrides as Array<{ library_product_id: string; price_ht_override: number }>) {
          map[o.library_product_id] = Number(o.price_ht_override);
        }
        setPricingOverrides(map);
        setLoading(false);
      });
    } else if (shops.length > 0) {
      setLoading(false);
    }
  }, [id, shops]);

  // S2.32 — Charge les gammes recensees du tenant (pour le depliage mode PIM).
  useEffect(() => {
    if (!currentTenant) {
      setSubscribedSlugs([]);
      return;
    }
    let cancelled = false;
    supabase
      .from('tenant_gamme_subscriptions')
      .select('gamme_slug')
      .eq('tenant_id', currentTenant.id)
      .eq('active', true)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('[S2.32] gammes recensees fetch failed', error.message);
          setSubscribedSlugs([]);
          return;
        }
        setSubscribedSlugs((data ?? []).map((r: any) => r.gamme_slug));
      });
    return () => {
      cancelled = true;
    };
  }, [currentTenant?.id]);

  // A4.5 — Upsert ou delete d'un override de prix sur blur d'un input
  // « Prix négocié ». Si nextValue est un nombre > 0 : upsert. Sinon : delete.
  const savePricingOverride = async (libraryProductId: string, nextValue: number | null) => {
    if (!shop || !currentTenant) return;
    if (nextValue === null || !Number.isFinite(nextValue) || nextValue <= 0) {
      // Suppression : on retire l'override (retour au prix biblio).
      const { error } = await supabase
        .from('shop_product_pricing')
        .delete()
        .eq('shop_id', shop.id)
        .eq('library_product_id', libraryProductId);
      if (error) {
        console.error('[A4.5] delete override failed', error.message);
        return;
      }
      setPricingOverrides((prev) => {
        const next = { ...prev };
        delete next[libraryProductId];
        return next;
      });
      return;
    }
    // Upsert : on insère ou remplace l'override existant.
    const { error } = await supabase
      .from('shop_product_pricing')
      .upsert(
        {
          shop_id: shop.id,
          library_product_id: libraryProductId,
          price_ht_override: nextValue,
          tenant_id: currentTenant.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'shop_id,library_product_id' },
      );
    if (error) {
      console.error('[A4.5] upsert override failed', error.message);
      return;
    }
    setPricingOverrides((prev) => ({ ...prev, [libraryProductId]: nextValue }));
  };

  // ─── Liste agregee des produits affichable dans la boutique ─────────────
  // IMPORTANT : le useMemo doit etre declare AVANT les early returns (regle
  // des hooks React). On gere le cas shop=null a l'interieur du callback.
  const displayProducts: DisplayProduct[] = useMemo(() => {
    if (!shop) return [];

    // 1. Produits exposes via product_library : bibliotheques liees OU mode
    //    PIM (catalogue tenant filtre par gamme). `library` (LibraryContext)
    //    contient deja tout le catalogue du tenant -> on delegue le perimetre
    //    au helper pur resolveShopProductScope (miroir exact du front public).
    const scoped = resolveShopProductScope(library, {
      libraryIds: shop.library_ids ?? [],
      pimCatalogMode: shop.pim_catalog_mode === true,
      pimGammeSlugs: shop.pim_gamme_slugs ?? [],
      excludedIds: shop.excluded_product_ids ?? [],
    });
    const fromLibraries: DisplayProduct[] = scoped.map((p) => ({
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

    // 2. Produits legacy shop_products (hors produits deja exposes ci-dessus)
    const scopedIds = new Set(scoped.map((p) => p.id));
    const fromShop: DisplayProduct[] = shopProducts
      .filter((sp) => !sp.product_id || !scopedIds.has(sp.product_id))
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
    // Recalcul quand library_ids, excluded_product_ids OU la config PIM change.
  }, [library, shopProducts, shop?.excluded_product_ids, shop?.library_ids, shop?.pim_catalog_mode, shop?.pim_gamme_slugs]);

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
        // S2.32 — mode PIM catalogue complet + gammes selectionnees
        pim_catalog_mode: shop.pim_catalog_mode === true,
        pim_gamme_slugs: shop.pim_gamme_slugs ?? [],
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

  // ─── S2.32 — Mode PIM catalogue complet ─────────────────────────────────

  // Radio maitre "PIM — Catalogue complet". A l'activation, pre-remplit
  // pim_gamme_slugs avec toutes les gammes recensees (sauf si une selection
  // existe deja -> on la restaure, decision #2 : decocher conserve la liste).
  const togglePimMode = () => {
    const turningOn = !(shop.pim_catalog_mode === true);
    if (turningOn) {
      const existing = shop.pim_gamme_slugs ?? [];
      const slugs = existing.length > 0 ? existing : subscribedSlugs;
      setShop({ ...shop, pim_catalog_mode: true, pim_gamme_slugs: slugs });
      setPimExpanded(true);
    } else {
      // Decocher : on coupe le mode mais on conserve pim_gamme_slugs.
      setShop({ ...shop, pim_catalog_mode: false });
    }
  };

  // Coche/decoche une gamme recensee dans le perimetre PIM.
  const togglePimGamme = (slug: string) => {
    const current = new Set(shop.pim_gamme_slugs ?? []);
    if (current.has(slug)) current.delete(slug);
    else current.add(slug);
    setShop({ ...shop, pim_gamme_slugs: Array.from(current) });
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
            <label className="block text-xs font-medium text-gray-700 mb-1">Logo du client</label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={shop.logo_url}
                onChange={(e) => setShop({ ...shop, logo_url: e.target.value })}
                placeholder="https://... ou importer un fichier"
                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg"
              />
              <label className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
                {uploadingAsset === 'logo' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Importer
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={uploadingAsset !== null}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadBrandAsset('logo', f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            {shop.logo_url && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5">
                <img src={shop.logo_url} alt="Logo" className="max-h-8 w-auto object-contain" />
                <button
                  type="button"
                  onClick={() => setShop({ ...shop, logo_url: '' })}
                  className="text-xs text-gray-500 hover:text-gray-800 underline"
                >
                  Retirer
                </button>
              </div>
            )}
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

      {/* ── Bandeau de marque (refonte 2026-07-08) ── */}
      <section className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
        <h3 className="font-semibold text-gray-900">Bandeau de marque</h3>
        <p className="text-xs text-gray-500">
          En-tête co-brandé de la boutique. Le <strong>logo du client</strong> (section Identité
          ci-dessus) est affiché proprement dans une plaque nette. Le fond utilise la
          <strong> couleur primaire de marque</strong> par défaut ; ajoutez une image de fond
          seulement si vous en avez une belle (photo panoramique) — le logo n'est jamais étiré.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Image de fond <span className="text-gray-400 font-normal">(optionnelle)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={shop.hero_image_url ?? ''}
                onChange={(e) =>
                  setShop({ ...shop, hero_image_url: e.target.value ? e.target.value : null })
                }
                placeholder="Vide = dégradé couleur de marque"
                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg"
              />
              <label className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
                {uploadingAsset === 'hero' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Importer
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={uploadingAsset !== null}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadBrandAsset('hero', f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
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
        {uploadError && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> {uploadError}
          </p>
        )}
        {/* Aperçu live du bandeau de marque (logo plaque + fond) */}
        <div className="mt-2">
          <p className="text-xs text-gray-500 mb-1">Aperçu</p>
          <div
            className="relative w-full h-[120px] rounded-lg overflow-hidden border border-gray-200 bg-cover bg-center"
            style={
              shop.hero_image_url
                ? { backgroundImage: `url(${shop.hero_image_url})` }
                : {
                    backgroundImage: `linear-gradient(120deg, ${shop.theme.primaryColor} 0%, rgba(2,6,23,0.72) 100%)`,
                  }
            }
          >
            {shop.hero_image_url && (
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(2,6,23,0.62) 0%, rgba(2,6,23,0.30) 55%, rgba(2,6,23,0.10) 100%)',
                }}
              />
            )}
            <div className="relative h-full flex items-center gap-4 px-4">
              {shop.logo_url ? (
                <div className="shrink-0 bg-white rounded-lg shadow-sm px-3 py-2 grid place-items-center max-w-[150px]">
                  <img src={shop.logo_url} alt="Logo" className="max-h-10 w-auto object-contain" />
                </div>
              ) : (
                <p className="text-white m-0 shrink-0 font-medium drop-shadow" style={{ fontSize: '20px' }}>
                  {shop.name || 'Nom boutique'}
                </p>
              )}
              {shop.tagline && (
                <p className="text-white/90 text-sm m-0 drop-shadow-md max-w-xs">{shop.tagline}</p>
              )}
            </div>
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

        {/* ── A4.2 — Palette élargie : secondaire / texte / fond ── */}
        <div className="pt-3 mt-2 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Couleur secondaire</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={shop.theme.secondaryColor ?? '#6b7280'}
                onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, secondaryColor: e.target.value } })}
                className="h-10 w-12 border border-gray-300 rounded"
              />
              <input
                type="text"
                value={shop.theme.secondaryColor ?? '#6b7280'}
                onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, secondaryColor: e.target.value } })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Couleur du texte</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={shop.theme.textColor ?? '#0f172a'}
                onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, textColor: e.target.value } })}
                className="h-10 w-12 border border-gray-300 rounded"
              />
              <input
                type="text"
                value={shop.theme.textColor ?? '#0f172a'}
                onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, textColor: e.target.value } })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Couleur de fond</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={shop.theme.bgColor ?? '#ffffff'}
                onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, bgColor: e.target.value } })}
                className="h-10 w-12 border border-gray-300 rounded"
              />
              <input
                type="text"
                value={shop.theme.bgColor ?? '#ffffff'}
                onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, bgColor: e.target.value } })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              />
            </div>
          </div>
        </div>

        {/* ── A4.2 — Pairing de fonts curated ── */}
        <div className="pt-3 mt-2 border-t border-gray-100">
          <label className="block text-xs font-medium text-gray-700 mb-1">Pairing de fonts</label>
          <select
            value={shop.theme.fontPairing ?? 'system'}
            onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, fontPairing: e.target.value } })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
          >
            {FONT_PAIRINGS.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Appliqué automatiquement à la boutique publique (titres + texte).
          </p>
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

        {/* S2.32 — PIM comme bibliotheque : verse tout le catalogue du tenant,
            filtrable par gamme recensee. Radio maitre + depliage des gammes. */}
        {(() => {
          const pimOn = shop.pim_catalog_mode === true;
          const selected = new Set(shop.pim_gamme_slugs ?? []);
          return (
            <div
              className={`mb-3 rounded-lg border-2 ${
                pimOn ? 'border-indigo-400 bg-indigo-50' : 'border-indigo-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 p-2">
                <input
                  type="radio"
                  data-testid={TEST_IDS.shopEditor.pimToggle}
                  checked={pimOn}
                  onClick={togglePimMode}
                  readOnly
                  className="w-4 h-4 cursor-pointer accent-indigo-600"
                />
                <span className="text-sm font-semibold text-gray-900 flex-1">
                  PIM — Catalogue complet
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    verse tout votre catalogue, filtrable par gamme
                  </span>
                </span>
                <button
                  type="button"
                  data-testid={TEST_IDS.shopEditor.pimExpandBtn}
                  onClick={() => setPimExpanded((v) => !v)}
                  className="text-xs text-indigo-700 hover:underline whitespace-nowrap"
                >
                  {pimExpanded ? 'Replier' : 'Déplier les gammes'}
                </button>
              </div>
              {pimExpanded && (
                <div className="border-t border-indigo-200 p-2 space-y-1">
                  {subscribedSlugs.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">
                      Aucune gamme recensée.{' '}
                      <Link to={tp('/dashboard/gammes')} className="text-indigo-600 hover:underline">
                        Recensez vos gammes
                      </Link>
                      .
                    </p>
                  ) : (
                    subscribedSlugs.map((slug) => {
                      const name = gammes.find((g) => g.slug === slug)?.name ?? slug;
                      const checked = selected.has(slug);
                      return (
                        <label
                          key={slug}
                          data-testid={`${TEST_IDS.shopEditor.pimGamme}-${slug}`}
                          className={`flex items-center gap-2 p-1.5 rounded ${
                            pimOn ? 'cursor-pointer hover:bg-white' : 'opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePimGamme(slug)}
                            disabled={!pimOn}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-gray-800">{name}</span>
                        </label>
                      );
                    })
                  )}
                  {pimOn && selected.size === 0 && subscribedSlugs.length > 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      Aucune gamme sélectionnée — la boutique n'exposera aucun produit du PIM.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })()}

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
              // S2.32 (decision #1) : en mode PIM, les cases biblio sont
              // grisees/desactivees (le PIM est un superset redondant).
              const pimOn = shop.pim_catalog_mode === true;
              return (
                <label
                  key={lib.id}
                  className={`flex items-center gap-2 p-2 rounded-lg ${
                    pimOn ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                  } ${linked && !pimOn ? 'bg-white border border-blue-300' : 'hover:bg-white/60'}`}
                >
                  <input
                    type="checkbox"
                    checked={linked}
                    onChange={() => toggleLinkedLibrary(lib.id)}
                    disabled={pimOn}
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
                {/* A4.5 — Prix négocié inline (uniquement pour sources library) */}
                {p.source === 'library' && p.libraryProductId && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <label className="text-[11px] text-gray-500 hidden md:block">
                      Prix négocié
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder="—"
                      defaultValue={
                        pricingOverrides[p.libraryProductId] !== undefined
                          ? pricingOverrides[p.libraryProductId].toFixed(2)
                          : ''
                      }
                      onBlur={(e) => {
                        const raw = e.target.value.trim();
                        const next = raw === '' ? null : Number(raw.replace(',', '.'));
                        const current = pricingOverrides[p.libraryProductId!];
                        // Pas de save inutile si valeur inchangée
                        if (
                          (next === null && current === undefined) ||
                          (next !== null && next === current)
                        ) {
                          return;
                        }
                        void savePricingOverride(p.libraryProductId!, next);
                      }}
                      className="w-20 px-2 py-1 text-xs font-mono border border-gray-300 rounded text-right"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    />
                    <span className="text-[11px] text-gray-500">€</span>
                    {pricingOverrides[p.libraryProductId] !== undefined && (
                      <span
                        className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded"
                        title="Tarif négocié actif"
                      >
                        négocié
                      </span>
                    )}
                  </div>
                )}
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

      {/* ── P4-VISUELS : Mockups custom per-shop (override Magrit-brandé) ── */}
      {shop && currentTenant && (
        <ReactSuspense fallback={null}>
          <ShopCustomMockups shopId={shop.id} tenantId={currentTenant.id} />
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
