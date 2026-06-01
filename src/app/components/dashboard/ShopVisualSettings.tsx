/**
 * ShopVisualSettings — S-PIM-VISUELS-4 (Sprint 7, 2026-06-01).
 *
 * Page admin boutique pour gérer les préférences visuelles :
 *   - Sélection d'un fond depuis la bibliothèque Magrit (V1)
 *   - Upload d'un fond custom (V2, bucket shop_backgrounds)
 *   - Override par gamme (V3 shop_gamme_visual_preferences)
 *   - Couleur primaire shop (--shop-primary CSS dans templates SVG)
 *
 * Pattern : composant React standalone, importable depuis DashboardShopEditor
 * (section Visuels) ou dans une page admin dédiée future.
 */

import { useCallback, useEffect, useState } from 'react';
import { Image as ImageIcon, Loader2, Upload } from 'lucide-react';
import { supabase } from '/utils/supabase/client';

interface BackgroundLibraryItem {
  id: string;
  name: string;
  description: string;
  url: string;
  thumbnail_url: string | null;
  tags: string[];
  ordering_index: number;
}

interface ShopVisualPref {
  shop_id: string;
  background_url: string | null;
  background_source: 'default' | 'library' | 'upload';
  background_library_id: string | null;
  primary_color: string;
}

interface GammeVisualPref {
  shop_id: string;
  gamme_slug: string;
  background_url: string | null;
  background_source: 'default' | 'library' | 'upload';
  background_library_id: string | null;
  primary_color: string | null;
}

interface Props {
  shopId: string;
  /** Liste des gammes disponibles du tenant (slug + nom affiché). */
  availableGammes: Array<{ slug: string; name: string }>;
}

export function ShopVisualSettings({ shopId, availableGammes }: Props) {
  const [library, setLibrary] = useState<BackgroundLibraryItem[]>([]);
  const [shopPref, setShopPref] = useState<ShopVisualPref | null>(null);
  const [gammePrefs, setGammePrefs] = useState<Record<string, GammeVisualPref>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingGamme, setUploadingGamme] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [libRes, prefRes, gammeRes] = await Promise.all([
      supabase
        .from('magrit_background_library')
        .select('*')
        .is('archived_at', null)
        .order('ordering_index'),
      supabase.from('shop_visual_preferences').select('*').eq('shop_id', shopId).maybeSingle(),
      supabase.from('shop_gamme_visual_preferences').select('*').eq('shop_id', shopId),
    ]);
    if (libRes.error || prefRes.error || gammeRes.error) {
      setError(
        libRes.error?.message || prefRes.error?.message || gammeRes.error?.message || 'Erreur chargement',
      );
      setLoading(false);
      return;
    }
    setLibrary((libRes.data as BackgroundLibraryItem[]) ?? []);
    setShopPref((prefRes.data as ShopVisualPref) ?? null);
    const gMap: Record<string, GammeVisualPref> = {};
    for (const g of (gammeRes.data as GammeVisualPref[]) ?? []) {
      gMap[g.gamme_slug] = g;
    }
    setGammePrefs(gMap);
    setLoading(false);
  }, [shopId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveShopPref = async (patch: Partial<ShopVisualPref>) => {
    setSaving(true);
    setError(null);
    const next: Partial<ShopVisualPref> = {
      shop_id: shopId,
      background_url: shopPref?.background_url ?? null,
      background_source: shopPref?.background_source ?? 'default',
      background_library_id: shopPref?.background_library_id ?? null,
      primary_color: shopPref?.primary_color ?? '#1e3a8a',
      ...patch,
    };
    const { error: upsertErr } = await supabase
      .from('shop_visual_preferences')
      .upsert(next, { onConflict: 'shop_id' });
    setSaving(false);
    if (upsertErr) {
      setError(upsertErr.message);
      return;
    }
    setShopPref(next as ShopVisualPref);
  };

  const saveGammePref = async (gammeSlug: string, patch: Partial<GammeVisualPref>) => {
    setSaving(true);
    setError(null);
    const current = gammePrefs[gammeSlug];
    const next: Partial<GammeVisualPref> = {
      shop_id: shopId,
      gamme_slug: gammeSlug,
      background_url: current?.background_url ?? null,
      background_source: current?.background_source ?? 'default',
      background_library_id: current?.background_library_id ?? null,
      primary_color: current?.primary_color ?? null,
      ...patch,
    };
    const { error: upsertErr } = await supabase
      .from('shop_gamme_visual_preferences')
      .upsert(next, { onConflict: 'shop_id,gamme_slug' });
    setSaving(false);
    if (upsertErr) {
      setError(upsertErr.message);
      return;
    }
    setGammePrefs((prev) => ({ ...prev, [gammeSlug]: next as GammeVisualPref }));
  };

  const clearGammePref = async (gammeSlug: string) => {
    setSaving(true);
    const { error: delErr } = await supabase
      .from('shop_gamme_visual_preferences')
      .delete()
      .eq('shop_id', shopId)
      .eq('gamme_slug', gammeSlug);
    setSaving(false);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    setGammePrefs((prev) => {
      const copy = { ...prev };
      delete copy[gammeSlug];
      return copy;
    });
  };

  const uploadCustomBackground = async (file: File, gammeSlug: string | null) => {
    setError(null);
    const target = gammeSlug ?? 'shop';
    setUploadingGamme(target);

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${shopId}/${gammeSlug ?? 'shop'}-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('shop_backgrounds')
      .upload(path, file, { contentType: file.type, upsert: true });

    setUploadingGamme(null);
    if (uploadErr) {
      setError(`Upload échec : ${uploadErr.message}`);
      return;
    }
    const { data } = supabase.storage.from('shop_backgrounds').getPublicUrl(path);
    if (gammeSlug) {
      await saveGammePref(gammeSlug, {
        background_source: 'upload',
        background_url: data.publicUrl,
        background_library_id: null,
      });
    } else {
      await saveShopPref({
        background_source: 'upload',
        background_url: data.publicUrl,
        background_library_id: null,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Chargement des visuels…
      </div>
    );
  }

  return (
    <section
      data-testid="shop-visual-settings"
      className="border border-gray-200 rounded-xl p-4 bg-white space-y-6"
    >
      <div>
        <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <ImageIcon className="w-5 h-5" />
          Visuels de la boutique
        </h3>
        <p className="text-sm text-gray-600">
          Fond et couleur primaire utilisés pour les mockups produits. Override
          possible par gamme.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">
          {error}
        </p>
      )}

      {/* ── Section fond global shop ─────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-900">Fond global de la boutique</h4>
          {shopPref?.background_url && (
            <button
              onClick={() => void saveShopPref({
                background_source: 'default',
                background_url: null,
                background_library_id: null,
              })}
              className="text-xs text-gray-500 hover:text-gray-900 underline"
              disabled={saving}
            >
              Réinitialiser
            </button>
          )}
        </div>

        {/* Aperçu courant */}
        <div className="flex items-center gap-3">
          <div
            className="w-24 h-24 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-xs text-gray-500"
            style={
              shopPref?.background_url
                ? {
                    backgroundImage: `url("${shopPref.background_url}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : {}
            }
            data-testid="shop-bg-preview"
          >
            {!shopPref?.background_url && 'Aucun fond'}
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs text-gray-600">Couleur primaire</label>
            <input
              type="color"
              value={shopPref?.primary_color ?? '#1e3a8a'}
              onChange={(e) => void saveShopPref({ primary_color: e.target.value })}
              className="h-8 w-16 border border-gray-300 rounded cursor-pointer"
              disabled={saving}
              data-testid="shop-primary-color-input"
            />
          </div>
        </div>

        {/* Bibliothèque Magrit */}
        <details className="border border-gray-200 rounded">
          <summary className="px-3 py-2 cursor-pointer text-sm font-medium text-gray-700">
            Bibliothèque Magrit ({library.length} fonds)
          </summary>
          <div className="p-3 grid grid-cols-5 gap-2">
            {library.map((bg) => {
              const active = shopPref?.background_library_id === bg.id;
              return (
                <button
                  key={bg.id}
                  onClick={() => void saveShopPref({
                    background_source: 'library',
                    background_url: bg.url,
                    background_library_id: bg.id,
                  })}
                  className={`relative rounded overflow-hidden border-2 ${active ? 'border-blue-500' : 'border-transparent hover:border-gray-300'}`}
                  disabled={saving}
                  title={bg.name}
                  data-testid={`shop-bg-library-${bg.id}`}
                >
                  <img
                    src={bg.thumbnail_url ?? bg.url}
                    alt={bg.name}
                    className="w-full h-16 object-cover"
                    loading="lazy"
                  />
                </button>
              );
            })}
          </div>
        </details>

        {/* Upload custom */}
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadCustomBackground(f, null);
              e.target.value = '';
            }}
            disabled={uploadingGamme !== null}
            data-testid="shop-bg-upload-input"
          />
          <span className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded hover:bg-gray-50">
            {uploadingGamme === 'shop' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Uploader un fond personnalisé (max 5 MB, JPG/PNG/WebP)
          </span>
        </label>
      </div>

      {/* ── Section overrides par gamme ──────────────────────────────────── */}
      {availableGammes.length > 0 && (
        <details className="border border-gray-200 rounded">
          <summary className="px-3 py-2 cursor-pointer text-sm font-semibold text-gray-900">
            Overrides par gamme ({Object.keys(gammePrefs).length} actif·s)
          </summary>
          <div className="divide-y divide-gray-100">
            {availableGammes.map((gamme) => {
              const pref = gammePrefs[gamme.slug];
              return (
                <div key={gamme.slug} className="px-3 py-3 flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded border border-gray-200 bg-gray-50"
                    style={
                      pref?.background_url
                        ? {
                            backgroundImage: `url("${pref.background_url}")`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }
                        : {}
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{gamme.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {pref ? `Override actif (${pref.background_source})` : 'Hérite du fond global'}
                    </p>
                  </div>
                  <select
                    value={pref?.background_library_id ?? ''}
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) {
                        void clearGammePref(gamme.slug);
                      } else {
                        const bg = library.find((b) => b.id === id);
                        if (bg) {
                          void saveGammePref(gamme.slug, {
                            background_source: 'library',
                            background_url: bg.url,
                            background_library_id: bg.id,
                          });
                        }
                      }
                    }}
                    className="text-xs border border-gray-300 rounded px-2 py-1"
                    disabled={saving}
                    data-testid={`gamme-bg-select-${gamme.slug}`}
                  >
                    <option value="">Hérite global</option>
                    {library.map((bg) => (
                      <option key={bg.id} value={bg.id}>
                        {bg.name}
                      </option>
                    ))}
                  </select>
                  <label className="cursor-pointer text-gray-500 hover:text-gray-900" title="Uploader un fond pour cette gamme">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadCustomBackground(f, gamme.slug);
                        e.target.value = '';
                      }}
                      disabled={uploadingGamme !== null}
                    />
                    {uploadingGamme === gamme.slug ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                  </label>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </section>
  );
}
