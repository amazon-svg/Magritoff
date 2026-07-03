/**
 * P4-VISUELS (2026-06-15) — UI admin tenant pour upload de mockups custom.
 *
 * Pour chaque type de produit (carteVisite / flyer / brochure / etiquette /
 * kakemono), permet à l'admin tenant de remplacer le mockup Magrit-brandé
 * par défaut par sa propre image. Use case Arnaud :
 *   "On conserve la possibilité pour le client de charger ses propres images
 *    pour que les produits soient personnalisés à sa guise."
 *
 * Flux upload :
 *   1. File input PNG/JPG/WebP/SVG (max 5 MB côté bucket)
 *   2. Upload bucket `shop_product_mockups` chemin `<shop_id>/<tpl>-front.<ext>`
 *   3. Upsert `shop_template_mockups` (mockup_image_url = public URL bucket)
 *   4. Reload state local
 *
 * Restauration :
 *   1. Delete row `shop_template_mockups`
 *   2. (Optionnel) delete fichier bucket — gardé en cache historique
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, RotateCcw, Loader2, Check, Image as ImageIcon } from 'lucide-react';
import { supabase } from '/utils/supabase/client';
import { projectId } from '/utils/supabase/info';
import {
  listShopCustomMockups,
  type CustomMockupRecord,
  type MockupTemplateType,
} from '../mockup/customMockup.helpers';
import { buildEdgeFunctionUrl } from '../mockup/MockupImage.helpers';

interface Props {
  shopId: string;
  tenantId: string;
}

interface TemplateDef {
  key: MockupTemplateType;
  label: string;
  // Specs deterministes pour preview du Magrit-brandé default
  width: number;
  height: number;
  productName: string;
}

const TEMPLATES: TemplateDef[] = [
  { key: 'carteVisite', label: 'Carte de visite', width: 85, height: 55, productName: 'Carte commerciale' },
  { key: 'flyer', label: 'Flyer / Tract', width: 148, height: 210, productName: 'Flyer A5' },
  { key: 'depliant', label: 'Dépliant 3 volets', width: 210, height: 297, productName: 'Dépliant A4' },
  { key: 'brochure', label: 'Brochure (livret)', width: 210, height: 297, productName: 'Brochure A4' },
  { key: 'packaging', label: 'Packaging / Boîte', width: 200, height: 150, productName: 'Boîte 200×150' },
  { key: 'etiquette', label: 'Étiquette adhésive', width: 60, height: 40, productName: 'Étiquette' },
  { key: 'kakemono', label: 'Roll-up / Kakémono', width: 850, height: 2000, productName: 'Roll-up' },
];

const ACCEPTED_MIME = 'image/png,image/jpeg,image/webp,image/svg+xml';
const BUCKET = 'shop_product_mockups';

export function ShopCustomMockups({ shopId, tenantId }: Props) {
  const [overrides, setOverrides] = useState<Record<string, CustomMockupRecord>>({});
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const records = await listShopCustomMockups(shopId);
    const map: Record<string, CustomMockupRecord> = {};
    for (const r of records) {
      map[`${r.template_type}-${r.view}`] = r;
    }
    setOverrides(map);
    setLoading(false);
  }, [shopId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Construit l'URL preview du Magrit-brandé par défaut (edge function)
  const buildDefaultPreviewUrl = (tpl: TemplateDef): string => {
    return buildEdgeFunctionUrl(projectId, {
      tenantId,
      shopId,
      productId: `preview-${tpl.key}`,
      width: tpl.width,
      height: tpl.height,
      productName: tpl.productName,
      primaryColor: '#1e3a8a',
      template: tpl.key,
      view: 'front',
    });
  };

  const handleUpload = async (tplKey: MockupTemplateType, file: File) => {
    setError(null);
    setUploadingKey(tplKey);
    try {
      // Extension à partir du MIME (sinon défaut .png)
      const ext = file.type === 'image/svg+xml' ? 'svg'
        : file.type === 'image/jpeg' ? 'jpg'
        : file.type === 'image/webp' ? 'webp'
        : 'png';
      const path = `${shopId}/${tplKey}-front.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '60' });
      if (uploadErr) {
        throw new Error(`Upload échoué : ${uploadErr.message}`);
      }

      // URL publique CDN
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = `${pub.publicUrl}?v=${Date.now()}`; // cache buster

      const { error: dbErr } = await supabase
        .from('shop_template_mockups')
        .upsert(
          {
            shop_id: shopId,
            template_type: tplKey,
            view: 'front',
            mockup_image_url: url,
            tenant_id: tenantId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'shop_id,template_type,view' },
        );
      if (dbErr) {
        throw new Error(`Sauvegarde échouée : ${dbErr.message}`);
      }
      await load();
    } catch (err) {
      setError((err as Error).message || 'Erreur inconnue');
    } finally {
      setUploadingKey(null);
    }
  };

  const handleRestore = async (tplKey: MockupTemplateType) => {
    setError(null);
    setUploadingKey(tplKey);
    try {
      const { error: delErr } = await supabase
        .from('shop_template_mockups')
        .delete()
        .eq('shop_id', shopId)
        .eq('template_type', tplKey)
        .eq('view', 'front');
      if (delErr) {
        throw new Error(`Restauration échouée : ${delErr.message}`);
      }
      await load();
    } catch (err) {
      setError((err as Error).message || 'Erreur inconnue');
    } finally {
      setUploadingKey(null);
    }
  };

  return (
    <section className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-blue-600" />
            Mockups custom de cette boutique
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Remplace le mockup Magrit-brandé par défaut par votre propre visuel pour chaque type de produit. Format : PNG, JPG, WebP ou SVG (5 Mo max).
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Chargement…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {TEMPLATES.map((tpl) => {
            const override = overrides[`${tpl.key}-front`];
            const isCustom = !!override;
            const previewUrl = isCustom ? override.mockup_image_url : buildDefaultPreviewUrl(tpl);
            const isUploading = uploadingKey === tpl.key;

            return (
              <div
                key={tpl.key}
                className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50"
              >
                <div className="px-3 py-2 bg-white border-b border-gray-200 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{tpl.label}</span>
                  {isCustom && (
                    <span
                      className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded"
                      title="Mockup custom actif"
                    >
                      personnalisé
                    </span>
                  )}
                </div>
                <div className="aspect-[4/3] bg-white relative">
                  <img
                    src={previewUrl}
                    alt={`Aperçu ${tpl.label}`}
                    className="w-full h-full object-cover"
                  />
                  {isUploading && (
                    <div className="absolute inset-0 bg-white/80 grid place-items-center">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
                    </div>
                  )}
                </div>
                <div className="p-2 flex items-center gap-1.5 bg-white">
                  <input
                    ref={(el) => (fileInputsRef.current[tpl.key] = el)}
                    type="file"
                    accept={ACCEPTED_MIME}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUpload(tpl.key, f);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputsRef.current[tpl.key]?.click()}
                    disabled={isUploading}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {isCustom ? 'Remplacer' : 'Téléverser'}
                  </button>
                  {isCustom && (
                    <button
                      type="button"
                      onClick={() => void handleRestore(tpl.key)}
                      disabled={isUploading}
                      title="Restaurer le mockup Magrit par défaut"
                      className="inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium border border-gray-300 rounded hover:bg-gray-50 text-gray-600 disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
