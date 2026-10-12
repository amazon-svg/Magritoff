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

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useSearchParams, useBlocker } from 'react-router';
import {
  ArrowLeft, Save, Loader2, Trash2, Check, ExternalLink, Library as LibraryIcon,
  Download, AlertTriangle, EyeOff, Eye, Upload,
} from 'lucide-react';
import { useShops, type Shop } from '@/modules/shops/ui/runtime/ShopsContext';
import type { ShopProduct } from '@/modules/shops';
import { FONT_PAIRINGS } from '@/modules/shops/ui/storefront/fontPairings';
import { useTenant } from '@/modules/tenants/ui/runtime';
import { useLibrary, LibraryProduct } from '@/modules/libraries/ui/runtime';
import { usePIM } from '@/modules/catalog/ui/runtime';
import { usePlan } from '@/modules/plans/ui/hooks';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { UpgradeCTA } from '@/modules/plans/ui/components';
import { exportShopToShopifyCsv, exportShopToJson } from '@/modules/shops/ui/helpers/shopExport';
import { resolveShopProductScope } from '@/modules/shops/ui/helpers/resolveShopProductScope';
import { isFixedPriceProduct } from '@/modules/libraries';
import { Button } from '@/shared/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui/tabs';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel } from '@/shared/ui/alert-dialog';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/shared/ui/dialog';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { lazy, Suspense as ReactSuspense } from 'react';
import { ShopCustomerAccountsSection } from '@/modules/shop-customers/ui/workspace';
import { useShopEditorOperations } from '@/modules/shops/ui/hooks/useShopEditorOperations';

// P4-VISUELS (2026-06-15) : lazy-load ShopCustomMockups (upload custom).
// P9-CLEANUP (2026-06-15) : ShopVisualSettings supprimé (remplacé par
// ShopCustomMockups qui couvre 100% du besoin per-shop).
const ShopCustomMockups = lazy(() =>
  import('@/modules/mockups/ui/workspace').then((m) => ({ default: m.ShopCustomMockups })),
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
  fixedUnit?: boolean;
}

export function DashboardShopEditor() {
  const { id } = useParams<{ id: string }>();
  const { canUse } = usePlan();
  const tp = useTenantPath();
  const {
    shops,
    loading: shopsLoading,
    error: shopsError,
    refresh: refreshShops,
    updateShop,
    removeShopProduct,
    excludeProduct,
    includeProduct,
  } = useShops();
  const { products: library, libraries, productsByLibrary, deleteProduct } = useLibrary();
  const { gammes, definitions } = usePIM();

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSection = searchParams.get('section');
  const editorSection = ['catalogue', 'clients', 'informations', 'apparence'].includes(selectedSection ?? '') ? selectedSection! : 'catalogue';
  const changeSection = (value: string) => setSearchParams(previous => { const next = new URLSearchParams(previous); next.set('section', value); return next; }, { replace: true });
  const savedSnapshot = useRef<Shop | null>(null);
  const acceptSavedShop = useRef(false);
  const [shop, setShop] = useState<Shop | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  // A4.5 — Prix négociés per-shop. Map clé = library_product_id, valeur = override
  // en number. Source de vérité locale, synchronisée à la DB sur blur.
  const { currentTenant } = useTenant();
  const {
    products: shopProducts,
    pricingOverrides,
    loading,
    loadError,
    refresh: refreshOperations,
    uploadingAsset,
    uploadError,
    pricingError,
    uploadBrandAsset,
    savePricingOverride,
    forgetProduct,
  } = useShopEditorOperations({
    tenantId: currentTenant?.id ?? null,
    shopId: id ?? null,
  });

  // Dialog de confirmation suppression
  const [deleteDialog, setDeleteDialog] = useState<DisplayProduct | null>(null);
  const [reintegratingProductId, setReintegratingProductId] = useState<string | null>(null);
  const [reintegrationFeedback, setReintegrationFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  // S2.32 — pimExpanded = etat d'ouverture du bloc PIM. Les gammes proposees
  // au depliage sont derivees du catalogue reel du tenant (catalogGammeSlugs),
  // pas des abonnements formels.
  const [pimExpanded, setPimExpanded] = useState(false);
  // REFONTE-UX (2026-08-08, point 6) — catalogue unifie : les trois sections
  // du domaine produit (sources PIM/bibliotheques, vue agregee, visuels)
  // deviennent les onglets d une section unique "Catalogue de la boutique".
  const [catalogTab, setCatalogTab] = useState<'sources' | 'products' | 'visuals'>('sources');

  useEffect(() => {
    const s = shops.find((s) => s.id === id) ?? null;
    const previousSnapshot = savedSnapshot.current;
    const acceptedSave = acceptSavedShop.current;
    acceptSavedShop.current = false;
    setShop(previous => !acceptedSave && previous?.id === s?.id && JSON.stringify(previous) !== JSON.stringify(previousSnapshot) ? previous : s);
    savedSnapshot.current = s;
  }, [id, shops]);

  // S2.32 — Le depliage liste TOUTE la taxonomie PIM (product_gammes via
  // usePIM), decision Arnaud 2026-07-24. `gammes` est deja ordonne par
  // display_order. On calcule aussi le nb de produits du catalogue par gamme
  // (badge) pour signaler celles qui exposeront reellement des produits.
  const allPimGammeSlugs = useMemo(() => gammes.map((g) => g.slug), [gammes]);
  const productCountByGamme = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of library) {
      if (p.active === false || !p.gamme_slug) continue;
      m.set(p.gamme_slug, (m.get(p.gamme_slug) ?? 0) + 1);
    }
    return m;
  }, [library]);

  // ─── Liste agregee des produits affichable dans la boutique ─────────────
  // IMPORTANT : le useMemo doit etre declare AVANT les early returns (regle
  // des hooks React). On gere le cas shop=null a l'interieur du callback.
  const displayProducts: DisplayProduct[] = useMemo(() => {
    if (!shop) return [];

    // 1. Produits exposes via product_library : bibliotheques liees OU mode
    //    PIM (catalogue tenant filtre par gamme). `library` (LibraryContext)
    //    contient deja tout le catalogue du tenant -> on delegue le perimetre
    //    au helper pur resolveShopProductScope (miroir exact du front public).
    const scoped = resolveShopProductScope<LibraryProduct>(library, {
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
      fixedUnit: isFixedPriceProduct(p),
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

  const savedShop = shops.find(value => value.id === id);
  const dirty = shop !== null && savedShop !== undefined && JSON.stringify(shop) !== JSON.stringify(savedShop);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !saving && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!canUse('shops')) return <UpgradeCTA feature="Boutiques en ligne" />;
  if (shopsLoading || loading) return <p className="text-sm text-ink-muted">Chargement...</p>;
  if (!shop) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-ink">Boutique indisponible</h1>
        <p role={shopsError ? 'alert' : undefined} className="text-sm text-ink-muted">{shopsError ?? 'Cette boutique est introuvable ou vous n’y avez pas accès.'}</p>
        {shopsError && <Button variant="outline" className="min-h-11" onClick={() => void refreshShops()}>Réessayer</Button>}
        <Link to={tp('/dashboard/shops')} className="text-sm text-brand hover:underline">
          ← Retour aux boutiques
        </Link>
      </div>
    );
  }

  const publicUrl = `${window.location.origin}/shop/${shop.slug}`;

  // ─── Actions shop ────────────────────────────────────────────────────────

  const handleSaveShop = async () => {
    if (!shop.name.trim()) { setSaveError('Renseignez le nom de la boutique dans Informations.'); changeSection('informations'); return; }
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      acceptSavedShop.current = true;
      await updateShop(shop.id, {
        name: shop.name.trim(),
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
        // S7.11 (ADR 4.20) — mode d acces acheteurs
        access_mode: shop.access_mode ?? 'invite_only',
      });
      setSaveOk(true);

    } catch (err: any) {
      acceptSavedShop.current = false;
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
      const slugs = existing.length > 0 ? existing : allPimGammeSlugs;
      setShop({ ...shop, pim_catalog_mode: true, pim_gamme_slugs: slugs });
      setPimExpanded(true);
    } else {
      // Decocher : on coupe le mode mais on conserve pim_gamme_slugs.
      setShop({ ...shop, pim_catalog_mode: false });
    }
  };

  // Coche/decoche une gamme dans le perimetre PIM.
  const togglePimGamme = (slug: string) => {
    const current = new Set(shop.pim_gamme_slugs ?? []);
    if (current.has(slug)) current.delete(slug);
    else current.add(slug);
    setShop({ ...shop, pim_gamme_slugs: Array.from(current) });
  };

  // Tout selectionner / tout deselectionner les gammes du catalogue en un clic.
  const toggleAllPimGammes = () => {
    const selected = shop.pim_gamme_slugs ?? [];
    const allSelected =
      allPimGammeSlugs.length > 0 && allPimGammeSlugs.every((s) => selected.includes(s));
    setShop({ ...shop, pim_gamme_slugs: allSelected ? [] : [...allPimGammeSlugs] });
  };

  // ─── Gestion de la suppression produit (dialog) ─────────────────────────

  const handleRequestDelete = (product: DisplayProduct) => {
    if (product.source === 'shop') {
      // Legacy shop_product : pas de dialog, supprime direct.
      if (confirm(`Retirer "${product.name}" de la boutique ?`)) {
        void (async () => {
          await removeShopProduct(shop.id, product.sourceId);
          forgetProduct(product.sourceId);
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
    const removedId = deleteDialog.libraryProductId;
    setShop(previous => previous ? { ...previous, excluded_product_ids: Array.from(new Set([...(previous.excluded_product_ids ?? []), removedId])) } : previous);
    setDeleteDialog(null);
  };

  const handleDeleteFromBoth = async () => {
    if (!deleteDialog || !deleteDialog.libraryProductId) return;
    await deleteProduct(deleteDialog.libraryProductId);
    setDeleteDialog(null);
  };

  const handleReintegrateProduct = async (libraryProductId: string, label: string) => {
    if (!shop || reintegratingProductId) return;
    setReintegratingProductId(libraryProductId);
    setReintegrationFeedback(null);
    try {
      await includeProduct(shop.id, libraryProductId);
      setShop(previous => previous ? { ...previous, excluded_product_ids: (previous.excluded_product_ids ?? []).filter(value => value !== libraryProductId) } : previous);
      setReintegrationFeedback({
        tone: 'success',
        message: `« ${label} » est de nouveau visible dans la boutique.`,
      });
    } catch (cause) {
      setReintegrationFeedback({
        tone: 'error',
        message: cause instanceof Error
          ? cause.message
          : `La réintégration de « ${label} » a échoué.`,
      });
    } finally {
      setReintegratingProductId(null);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-6">
      <header className="sticky top-0 z-20 space-y-3 border-b border-line bg-bg py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to={tp('/dashboard/shops')} className="inline-flex min-h-11 items-center gap-2 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="size-4" />Toutes les boutiques</Link>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm text-brand hover:underline"><ExternalLink className="size-4" />Voir la boutique</a>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><h1 className="break-words text-2xl font-semibold tracking-tight text-ink">{shop.name}</h1><p className="mt-1 text-sm text-ink-muted">{shop.active ? 'Boutique active' : 'Boutique désactivée'} · {shop.access_mode === 'self_signup' ? 'Inscription libre' : 'Accès sur invitation'}</p></div>
          <Button onClick={handleSaveShop} disabled={saving || !dirty} className="min-h-11 bg-brand text-brand-ink hover:bg-brand/90">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{saving ? 'Enregistrement…' : 'Enregistrer les modifications'}</Button>
        </div>
        <p role="status" className="text-sm text-ink-muted">{dirty ? 'Modifications non enregistrées' : saveOk ? 'Modifications enregistrées.' : 'Les réglages sont enregistrés.'}</p>
        {saveError && <p role="alert" className="rounded-lg bg-err-bg p-3 text-sm text-err-fg">{saveError}</p>}
      </header>
      <fieldset disabled={saving} className="min-w-0">
      <Tabs value={editorSection} onValueChange={changeSection} className="space-y-4">
        <TabsList aria-label="Réglages de la boutique" className="grid h-auto w-full grid-cols-2 gap-1 bg-bg sm:grid-cols-4">
          {[['catalogue', 'Catalogue'], ['clients', 'Clients'], ['informations', 'Informations générales'], ['apparence', 'Apparence']].map(([value, label]) => <TabsTrigger key={value} value={value!} className="min-h-11 whitespace-normal">{label}</TabsTrigger>)}
        </TabsList>
      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-err-bg p-3 text-sm text-err-fg"><p>{loadError}</p><Button variant="outline" className="min-h-11" onClick={() => void refreshOperations()}>Réessayer</Button></div>
      )}

      <TabsContent value="informations" forceMount hidden={editorSection !== 'informations'} className="space-y-4">
      {/* ── Infos de base ── */}
      <section className="border border-line rounded-xl p-4 bg-paper space-y-3">
        <h2 className="font-semibold text-ink">Informations générales</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="shop-setting-1" className="block text-xs font-medium text-ink-2 mb-1">Nom</label>
            <input id="shop-setting-1"
              type="text"
              required maxLength={120}
              value={shop.name}
              onChange={(e) => setShop({ ...shop, name: e.target.value })}
              className="w-full min-h-11 px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="shop-setting-2" className="block text-xs font-medium text-ink-2 mb-1">Description</label>
            <textarea id="shop-setting-2"
              value={shop.description}
              onChange={(e) => setShop({ ...shop, description: e.target.value })}
              rows={2}
              className="w-full min-h-11 px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink"
            />
          </div>
          <div>
            <label htmlFor="shop-setting-3" className="block text-xs font-medium text-ink-2 mb-1">Logo du client</label>
            <div className="flex items-center gap-2">
              <input id="shop-setting-3"
                type="url"
                value={shop.logo_url}
                onChange={(e) => setShop({ ...shop, logo_url: e.target.value })}
                placeholder="https://... ou importer un fichier"
                className="flex-1 min-h-11 min-w-0 px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink"
              />
              <label className="min-h-11 focus-within:ring-2 focus-within:ring-brand shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line-2 bg-paper hover:bg-bg cursor-pointer text-sm text-ink-2">
                {uploadingAsset === 'logo' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Importer
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={uploadingAsset !== null}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      void uploadBrandAsset('logo', f).then((assetUrl) => {
                        if (assetUrl) setShop((previous) => previous ? { ...previous, logo_url: assetUrl } : previous);
                      });
                    }
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            {shop.logo_url && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-line bg-bg px-2.5 py-1.5">
                <img src={shop.logo_url} alt="Logo" className="max-h-8 w-auto object-contain" />
                <button
                  type="button"
                  onClick={() => setShop({ ...shop, logo_url: '' })}
                  className="text-xs text-ink-muted hover:text-ink underline"
                >
                  Retirer
                </button>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="shop-setting-4" className="block text-xs font-medium text-ink-2 mb-1">Email de contact</label>
            <input id="shop-setting-4"
              type="email"
              value={shop.contact_email}
              onChange={(e) => setShop({ ...shop, contact_email: e.target.value })}
              className="w-full min-h-11 px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="shop-setting-5" className="block text-xs font-medium text-ink-2 mb-1">Adresse (affichée sur la boutique)</label>
            <textarea id="shop-setting-5"
              value={shop.address}
              onChange={(e) => setShop({ ...shop, address: e.target.value })}
              rows={2}
              className="w-full min-h-11 px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink"
            />
          </div>
        </div>
      </section>

      {/* ── Activation + bouton biblio sous le toggle ── */}
      <section className="border border-line rounded-xl p-4 bg-paper space-y-3">
        <h2 className="font-semibold text-ink">Publication et accès</h2>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={shop.active}
            onChange={(e) => setShop({ ...shop, active: e.target.checked })}
            className="w-4 h-4"
          />
          <div>
            <p className="text-sm font-medium text-ink">Boutique active</p>
            <p className="text-xs text-ink-muted">Accessible selon le mode d’accès choisi. Une boutique désactivée reste conservée et peut être réactivée.</p>
          </div>
        </label>

        {/* S7.11 (ADR 4.20) — Mode d'accès acheteurs */}
        <label className="block">
          <p className="text-sm font-medium text-ink mb-1">
            Accès des acheteurs
          </p>
          <select
            data-testid={TEST_IDS.shop.accessModeSelect}
            value={shop.access_mode ?? 'invite_only'}
            onChange={(e) =>
              setShop({ ...shop, access_mode: e.target.value as 'invite_only' | 'self_signup' })
            }
            className="min-h-11 w-full max-w-sm border border-line-2 rounded-md px-3 py-2 text-sm"
          >
            <option value="invite_only">Sur invitation uniquement (défaut)</option>
            <option value="self_signup">Inscription libre au moment de commander</option>
          </select>
          <p className="text-xs text-ink-muted mt-1">
            Sur invitation, seuls les clients invités peuvent accéder à la boutique.
            En inscription libre, un visiteur peut consulter les produits et créer
            son compte au moment de commander. La boutique peut alors être indexée
            par les moteurs de recherche.
          </p>
        </label>

        {/* Raccourci vers la gestion des bibliotheques (remplace l'item
            sidebar "Bibliotheque" qui est maintenant sub-item de Boutiques) */}
        <Link
          to={tp('/dashboard/library')}
          className="inline-flex items-center gap-2 text-sm text-brand hover:text-brand hover:underline"
        >
          <LibraryIcon className="w-4 h-4" />
          Gérer mes bibliothèques
        </Link>
      </section>

      </TabsContent>
      <TabsContent value="apparence" forceMount hidden={editorSection !== 'apparence'}>
      {/* ── Bandeau de marque (refonte 2026-07-08) ── */}
      <section className="border border-line rounded-xl p-4 bg-paper space-y-3">
        <h2 className="font-semibold text-ink">Bandeau de marque</h2>
        <p className="text-xs text-ink-muted">
          En-tête co-brandé de la boutique. Le <strong>logo du client</strong> (onglet Informations générales) est affiché proprement dans une plaque nette. Le fond utilise la
          <strong> couleur primaire de marque</strong> par défaut ; ajoutez une image de fond
          seulement si vous en avez une belle (photo panoramique) — le logo n'est jamais étiré.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="shop-setting-6" className="block text-xs font-medium text-ink-2 mb-1">
              Image de fond <span className="text-ink-muted font-normal">(optionnelle)</span>
            </label>
            <div className="flex items-center gap-2">
              <input id="shop-setting-6"
                type="url"
                value={shop.hero_image_url ?? ''}
                onChange={(e) =>
                  setShop({ ...shop, hero_image_url: e.target.value ? e.target.value : null })
                }
                placeholder="Vide = dégradé couleur de marque"
                className="flex-1 min-h-11 min-w-0 px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink"
              />
              <label className="min-h-11 focus-within:ring-2 focus-within:ring-brand shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line-2 bg-paper hover:bg-bg cursor-pointer text-sm text-ink-2">
                {uploadingAsset === 'hero' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Importer
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={uploadingAsset !== null}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      void uploadBrandAsset('hero', f).then((assetUrl) => {
                        if (assetUrl) setShop((previous) => previous ? { ...previous, hero_image_url: assetUrl } : previous);
                      });
                    }
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
          <div>
            <label htmlFor="shop-setting-7" className="block text-xs font-medium text-ink-2 mb-1">
              Phrase d'accroche{' '}
              <span className="text-ink-muted font-normal">
                ({(shop.tagline ?? '').length}/120)
              </span>
            </label>
            <textarea id="shop-setting-7"
              value={shop.tagline ?? ''}
              onChange={(e) => {
                const next = e.target.value.slice(0, 120);
                setShop({ ...shop, tagline: next ? next : null });
              }}
              rows={2}
              maxLength={120}
              placeholder="Ex: Vos imprimés professionnels en 48h."
              className="w-full min-h-11 px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink"
            />
          </div>
        </div>
        {uploadError && (
          <p className="text-xs text-err-fg flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> {uploadError}
          </p>
        )}
        {/* Aperçu live du bandeau de marque (logo plaque + fond) */}
        <div className="mt-2">
          <p className="text-xs text-ink-muted mb-1">Aperçu</p>
          <div
            className="relative w-full h-[120px] rounded-lg overflow-hidden border border-line bg-cover bg-center"
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
                <div className="shrink-0 bg-paper rounded-lg shadow-sm px-3 py-2 grid place-items-center max-w-[150px]">
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
      <section className="border border-line rounded-xl p-4 bg-paper space-y-3">
        <h2 className="font-semibold text-ink">Apparence</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div>
            <label htmlFor="shop-setting-8" className="block text-xs font-medium text-ink-2 mb-1">Couleur primaire</label>
            <div className="flex items-center gap-2">
              <input id="shop-setting-8"
                type="color"
                value={shop.theme.primaryColor}
                onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, primaryColor: e.target.value } })}
                className="h-11 w-12 shrink-0 border border-line-2 rounded"
              />
              <input aria-label="Code couleur primaire"
                type="text"
                value={shop.theme.primaryColor}
                onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, primaryColor: e.target.value } })}
                className="min-w-0 flex-1 px-3 py-2 border border-line-2 rounded-lg font-mono text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="shop-setting-9" className="block text-xs font-medium text-ink-2 mb-1">Couleur d'accent</label>
            <div className="flex items-center gap-2">
              <input id="shop-setting-9"
                type="color"
                value={shop.theme.accentColor}
                onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, accentColor: e.target.value } })}
                className="h-11 w-12 shrink-0 border border-line-2 rounded"
              />
              <input aria-label="Code couleur d’accent"
                type="text"
                value={shop.theme.accentColor}
                onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, accentColor: e.target.value } })}
                className="min-w-0 flex-1 px-3 py-2 border border-line-2 rounded-lg font-mono text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="shop-setting-10" className="block text-xs font-medium text-ink-2 mb-1">Mode</label>
            <select id="shop-setting-10"
              value={shop.theme.mode}
              onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, mode: e.target.value as 'light' | 'dark' } })}
              className="w-full px-3 py-2 border border-line-2 rounded-lg bg-paper"
            >
              <option value="light">Clair</option>
              <option value="dark">Sombre</option>
            </select>
          </div>
        </div>

        {/* ── A4.2 — Palette élargie : secondaire / texte / fond ── */}
        <div className="pt-3 mt-2 border-t border-line grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div>
            <label htmlFor="shop-setting-11" className="block text-xs font-medium text-ink-2 mb-1">Couleur secondaire</label>
            <div className="flex items-center gap-2">
              <input id="shop-setting-11"
                type="color"
                value={shop.theme.secondaryColor ?? '#6b7280'}
                onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, secondaryColor: e.target.value } })}
                className="h-11 w-12 shrink-0 border border-line-2 rounded"
              />
              <input aria-label="Code couleur secondaire"
                type="text"
                value={shop.theme.secondaryColor ?? '#6b7280'}
                onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, secondaryColor: e.target.value } })}
                className="min-w-0 flex-1 px-3 py-2 border border-line-2 rounded-lg font-mono text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="shop-setting-12" className="block text-xs font-medium text-ink-2 mb-1">Couleur du texte</label>
            <div className="flex items-center gap-2">
              <input id="shop-setting-12"
                type="color"
                value={shop.theme.textColor ?? '#0f172a'}
                onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, textColor: e.target.value } })}
                className="h-11 w-12 shrink-0 border border-line-2 rounded"
              />
              <input aria-label="Code couleur du texte"
                type="text"
                value={shop.theme.textColor ?? '#0f172a'}
                onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, textColor: e.target.value } })}
                className="min-w-0 flex-1 px-3 py-2 border border-line-2 rounded-lg font-mono text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="shop-setting-13" className="block text-xs font-medium text-ink-2 mb-1">Couleur de fond</label>
            <div className="flex items-center gap-2">
              <input id="shop-setting-13"
                type="color"
                value={shop.theme.bgColor ?? '#ffffff'}
                onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, bgColor: e.target.value } })}
                className="h-11 w-12 shrink-0 border border-line-2 rounded"
              />
              <input aria-label="Code couleur du fond"
                type="text"
                value={shop.theme.bgColor ?? '#ffffff'}
                onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, bgColor: e.target.value } })}
                className="min-w-0 flex-1 px-3 py-2 border border-line-2 rounded-lg font-mono text-sm"
              />
            </div>
          </div>
        </div>

        {/* ── A4.2 — Association de polices curated ── */}
        <div className="pt-3 mt-2 border-t border-line">
          <label htmlFor="shop-setting-14" className="block text-xs font-medium text-ink-2 mb-1">Association de polices</label>
          <select id="shop-setting-14"
            value={shop.theme.fontPairing ?? 'system'}
            onChange={(e) => setShop({ ...shop, theme: { ...shop.theme, fontPairing: e.target.value } })}
            className="w-full px-3 py-2 border border-line-2 rounded-lg bg-paper"
          >
            {FONT_PAIRINGS.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
          <p className="text-xs text-ink-muted mt-1">
            Appliqué automatiquement à la boutique publique (titres + texte).
          </p>
        </div>
      </section>

      </TabsContent>
      <TabsContent value="clients" forceMount hidden={editorSection !== 'clients'}>

      {currentTenant && (
        <ShopCustomerAccountsSection tenantId={currentTenant.id} shopId={shop.id} />
      )}

      </TabsContent>
      <TabsContent value="catalogue" forceMount hidden={editorSection !== 'catalogue'}>
      {/* ══ REFONTE-UX (2026-08-08, point 6) — CATALOGUE DE LA BOUTIQUE ══
          Section unique du domaine produit, a onglets :
            Sources  = d ou viennent les produits (PIM / bibliotheques)
            Produits = ce que la boutique expose (vue agregee, prix negocies,
                       exclusions, exports)
            Visuels  = mockups custom par boutique (P4-VISUELS, PRD E8.3)
          Remplace les 3 sections empilees redondantes. */}
      <Tabs value={catalogTab} onValueChange={value => setCatalogTab(value as typeof catalogTab)}>
      <section className="border border-line rounded-xl bg-paper overflow-hidden">
        <div className="px-4 pt-4">
          <h2 className="font-medium text-ink flex items-center gap-2">
            <LibraryIcon className="w-5 h-5" strokeWidth={1.5} />
            Catalogue de la boutique
          </h2>
          <TabsList aria-label="Catalogue de la boutique" className="mt-3 grid h-auto w-full grid-cols-3 bg-bg">
            {(
              [
                ['sources', 'Sources'],
                ['products', `Produits (${displayProducts.length})`],
                ['visuals', 'Visuels'],
              ] as const
            ).map(([key, label]) => (
              <TabsTrigger key={key} value={key} className="min-h-11 whitespace-normal">{label}</TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="sources">
        <div className="p-4">
        <p className="text-sm text-ink-2 mb-3">
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
                pimOn ? 'border-brand bg-brand-soft' : 'border-line-2 bg-paper'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 p-3">
                <input
                  type="checkbox"
                  aria-label="Utiliser le catalogue PIM"
                  data-testid={TEST_IDS.shopEditor.pimToggle}
                  checked={pimOn}
                  onChange={togglePimMode}
                  className="w-4 h-4 cursor-pointer accent-brand"
                />
                <span className="text-sm font-medium text-ink flex-1 min-w-0">
                  PIM — Catalogue complet
                  <span className="ml-2 text-xs font-normal text-ink-muted">
                    verse tout votre catalogue, filtrable par catégorie
                  </span>
                </span>
                <button
                  type="button"
                  data-testid={TEST_IDS.shopEditor.pimExpandBtn}
                  onClick={() => setPimExpanded((v) => !v)}
                  className="min-h-11 w-full sm:w-auto text-xs text-ink hover:underline"
                >
                  {pimExpanded ? 'Replier' : 'Déplier les catégories'}
                </button>
              </div>
              {pimExpanded && (
                <div className="border-t border-line-2 p-2">
                  {gammes.length === 0 ? (
                    <p className="text-xs text-ink-muted italic">Chargement des catégories du PIM…</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between pb-1 mb-1 border-b border-line">
                        <span className="text-xs font-medium text-ink-muted">
                          Catégories du PIM ({allPimGammeSlugs.length})
                        </span>
                        <button
                          type="button"
                          data-testid={TEST_IDS.shopEditor.pimSelectAllBtn}
                          onClick={toggleAllPimGammes}
                          disabled={!pimOn}
                          className="text-xs text-ink hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                        >
                          {allPimGammeSlugs.length > 0 && allPimGammeSlugs.every((s) => selected.has(s))
                            ? 'Tout désélectionner'
                            : 'Tout sélectionner'}
                        </button>
                      </div>
                      <div className="max-h-64 overflow-y-auto space-y-0.5 pr-1">
                        {gammes.map((g) => {
                          const checked = selected.has(g.slug);
                          const count = productCountByGamme.get(g.slug) ?? 0;
                          return (
                            <label
                              key={g.slug}
                              data-testid={`${TEST_IDS.shopEditor.pimGamme}-${g.slug}`}
                              className={`flex items-center gap-2 p-1.5 rounded ${
                                pimOn ? 'cursor-pointer hover:bg-paper' : 'opacity-50 cursor-not-allowed'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePimGamme(g.slug)}
                                disabled={!pimOn}
                                className="w-4 h-4"
                              />
                              <span className="text-sm text-ink flex-1">{g.name}</span>
                              <span
                                className={`text-xs ${count > 0 ? 'text-ink-muted' : 'text-ink-muted'}`}
                                title="Produits de votre catalogue dans cette catégorie"
                              >
                                {count} produit{count > 1 ? 's' : ''}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      {pimOn && selected.size === 0 && (
                        <p className="text-xs text-warn-fg mt-1">
                          Aucune catégorie sélectionnée — la boutique n'exposera aucun produit du PIM.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {libraries.length === 0 ? (
          <p className="text-sm text-ink-muted italic">
            Aucune bibliothèque.{' '}
            <Link to={tp('/dashboard/library')} className="text-brand hover:underline">
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
                  } ${linked && !pimOn ? 'bg-paper border border-line-2' : 'hover:bg-paper/60'}`}
                >
                  <input
                    type="checkbox"
                    checked={linked}
                    onChange={() => toggleLinkedLibrary(lib.id)}
                    disabled={pimOn}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-ink flex-1">{lib.name}</span>
                  <span className="text-xs text-ink-muted">
                    {count} produit{count > 1 ? 's' : ''}
                  </span>
                </label>
              );
            })}
          </div>
        )}
        <p className="text-xs text-ink-muted mt-2">
          N'oubliez pas d'<strong>Enregistrer</strong> en bas de page après modification.
        </p>
        </div>
        </TabsContent>

        {/* ── Onglet Produits : vue agregee + exclusions + export ── */}
        <TabsContent value="products">
        <div className="p-4">
        {pricingError && (
          <p className="mb-3 text-xs text-err-fg rounded-lg border border-err-fg/20 bg-err-bg px-3 py-2">
            {pricingError}
          </p>
        )}
        {displayProducts.length === 0 ? (
          <p className="text-sm text-ink-muted italic">
            Aucun produit. Associez une bibliothèque dans l'onglet Sources pour les voir apparaître.
          </p>
        ) : (
          <div className="space-y-2">
            {displayProducts.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[48px_minmax(0,1fr)_44px] items-start gap-3 p-2 border border-line rounded-lg lg:flex lg:items-center"
              >
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-12 h-12 object-cover rounded" />
                ) : (
                  <div className="w-12 h-12 bg-bg rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink break-words lg:truncate">{p.name}</p>
                  <p className="text-xs text-ink-muted">
                    {p.source === 'library' ? (
                      <>Bibliothèque · {p.category} · {p.fixedUnit ? 'Coût ' : ''}{p.price_ht.toFixed(2)} € HT{p.fixedUnit ? ' / unité' : ''}</>
                    ) : (
                      <>Catalogue existant · {p.category} · {p.price_ht.toFixed(2)} € HT</>
                    )}
                  </p>
                </div>
                {/* A4.5 — Prix négocié inline (uniquement pour sources library) */}
                {p.source === 'library' && p.libraryProductId && (
                  <div className="col-start-2 col-span-2 row-start-2 flex flex-wrap items-center gap-1.5 shrink-0">
                    <label htmlFor={`shop-price-${p.id}`} className="text-xs text-ink-muted">
                      Prix négocié
                    </label>
                    <input id={`shop-price-${p.id}`} aria-label={`Prix de vente négocié HT de ${p.name}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder="—"
                      defaultValue={
                        pricingOverrides[p.libraryProductId] !== undefined
                          ? pricingOverrides[p.libraryProductId]!.toFixed(2)
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
                      className="w-20 px-2 py-1 text-xs font-mono border border-line-2 rounded text-right"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    />
                    <span className="text-[11px] text-ink-muted">€</span>
                    {pricingOverrides[p.libraryProductId] !== undefined && (
                      <span
                        className="text-[10px] font-medium text-warn-fg bg-warn-bg px-1.5 py-0.5 rounded"
                        title="Tarif négocié actif"
                      >
                        négocié
                      </span>
                    )}
                  </div>
                )}
                <button
                  onClick={() => handleRequestDelete(p)}
                  className="col-start-3 row-start-1 min-h-11 min-w-11 p-2 text-ink-muted hover:text-err-fg hover:bg-err-bg rounded"
                  aria-label={`Retirer ${p.name} de la boutique`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {reintegrationFeedback && (
          <p
            className={`mt-4 rounded border px-3 py-2 text-xs ${reintegrationFeedback.tone === 'success' ? 'border-ok-fg/30 bg-ok-bg text-ok-fg' : 'border-err-fg/30 bg-err-bg text-err-fg'}`}
            role={reintegrationFeedback.tone === 'success' ? 'status' : 'alert'}
          >
            {reintegrationFeedback.message}
          </p>
        )}

        {/* E9.11 — Exclusions actuelles : reintegration one-click. */}
        {shop.excluded_product_ids && shop.excluded_product_ids.length > 0 && (
          <details className="mt-4 text-xs text-ink-muted">
            <summary className="cursor-pointer hover:text-ink">
              {shop.excluded_product_ids.length} produit
              {shop.excluded_product_ids.length > 1 ? 's' : ''} masqué
              {shop.excluded_product_ids.length > 1 ? 's' : ''} dans cette boutique
            </summary>
            <p className="mt-2 text-ink-muted">
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
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-bg"
                  >
                    <span className="text-ink-2 truncate">
                      {label}
                      {p && !stillInLinkedLibrary && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-warn-fg">
                          bibliothèque non liée
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleReintegrateProduct(libProductId, label)}
                      disabled={!stillInLinkedLibrary || reintegratingProductId !== null}
                      title={
                        stillInLinkedLibrary
                          ? 'Ré-afficher ce produit dans la boutique'
                          : "La bibliothèque source n est plus liée à cette boutique — re-cochez-la d abord"
                      }
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-line-2 bg-paper hover:bg-bg disabled:opacity-50 disabled:cursor-not-allowed text-[11px] font-medium text-ink-2"
                    >
                      {reintegratingProductId === libProductId
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Eye className="w-3 h-3" />}
                      {reintegratingProductId === libProductId ? 'Réintégration…' : 'Réintégrer'}
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        )}

        {/* Export du catalogue — reste dans l onglet Produits */}
        <div className="mt-5 pt-4 border-t border-line">
          <p className="text-sm font-medium text-ink mb-1 flex items-center gap-2">
            <Download className="w-4 h-4" strokeWidth={1.5} />
            Exporter le catalogue
          </p>
          <p className="text-sm text-ink-muted mb-3">
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
              className="px-3 py-2 border border-line-2 rounded-lg hover:bg-bg disabled:opacity-50 text-sm font-medium flex items-center gap-2"
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
              className="px-3 py-2 border border-line-2 rounded-lg hover:bg-bg disabled:opacity-50 text-sm font-medium flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export JSON (API-ready)
            </button>
          </div>
        </div>
        </div>
        </TabsContent>

        {/* ── Onglet Visuels : mockups custom per-shop (P4-VISUELS, PRD E8.3) ── */}
        <TabsContent value="visuals">
        <div className="p-4">
          {shop && currentTenant && (
            <ReactSuspense fallback={null}>
              <ShopCustomMockups shopId={shop.id} tenantId={currentTenant.id} />
            </ReactSuspense>
          )}
        </div>
        </TabsContent>
      </section>
      </Tabs>

      </TabsContent>
      </Tabs>
      </fieldset>
      <AlertDialog open={blocker.state === 'blocked'} onOpenChange={open => { if (!open && blocker.state === 'blocked') blocker.reset(); }}>
        <AlertDialogContent className="bg-paper text-ink">
          <AlertDialogTitle>Quitter sans enregistrer ?</AlertDialogTitle>
          <AlertDialogDescription>Les modifications des réglages de cette boutique ne sont pas enregistrées. Restez ici pour les enregistrer ou quittez en les abandonnant.</AlertDialogDescription>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><AlertDialogCancel className="min-h-11">Rester sur la boutique</AlertDialogCancel><Button variant="outline" className="min-h-11" onClick={() => { if (blocker.state === 'blocked') blocker.proceed(); }}>Quitter sans enregistrer</Button></div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialog : que faire quand on retire un produit lib ── */}
      {deleteDialog && (
        <Dialog open onOpenChange={open => { if (!open) setDeleteDialog(null); }}>
          <DialogContent className="bg-paper text-ink">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-warn-fg shrink-0" />
              <div>
                <DialogTitle>Retirer « {deleteDialog.name} »</DialogTitle>
                <DialogDescription>
                  Ce produit appartient à une bibliothèque associée à la boutique.
                  Voulez-vous aussi le retirer de la bibliothèque, ou seulement de cette
                  boutique ?
                </DialogDescription>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleDeleteFromShopOnly}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-line-2 rounded-lg hover:bg-bg text-sm font-medium text-ink"
              >
                <EyeOff className="w-4 h-4" />
                Juste de cette boutique
                <span className="text-xs text-ink-muted">(reste dans la biblio)</span>
              </button>
              <button
                onClick={handleDeleteFromBoth}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-err-fg text-paper rounded-lg hover:bg-err-fg/90 text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                De la boutique ET de la bibliothèque
              </button>
              <button
                onClick={() => setDeleteDialog(null)}
                className="w-full px-4 py-2 text-sm text-ink-muted hover:text-ink"
              >
                Annuler
              </button>
            </div>
          </DialogContent>
        </Dialog>
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
