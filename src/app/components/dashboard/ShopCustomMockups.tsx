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
 *   1. File input PNG/JPG/WebP/SVG (max 5 MB)
 *   2. Upload multipart vers l'API Magrit
 *   3. L'adaptateur serveur synchronise Storage et l'override
 *   4. Reload state local via le client API
 *
 * Restauration :
 *   1. Commande API de restauration de l'override
 *   2. Le fichier est conservé en cache historique
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Upload, RotateCcw, Loader2, Image as ImageIcon } from 'lucide-react';
import { ShopsApiClient, type MockupTemplateType, type ShopCustomMockup } from '../../../modules/shops';
import { FetchApiClient } from '../../../platform/api';
import { useAuth } from '../../contexts/AuthContext';
import { resolveProductImage } from '../../utils/productImages';

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
export function ShopCustomMockups({ shopId, tenantId }: Props) {
  const { session } = useAuth();
  const shopsApi = useMemo(() => new ShopsApiClient(new FetchApiClient('', globalThis.fetch, () => session?.access_token ?? null)), [session?.access_token]);
  const [overrides, setOverrides] = useState<Record<string, ShopCustomMockup>>({});
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const records = await shopsApi.customMockups(tenantId, shopId);
      const map: Record<string, ShopCustomMockup> = {};
      for (const r of records) {
        map[`${r.templateType}-${r.view}`] = r;
      }
      setOverrides(map);
    } catch (loadError) {
      setError(`Chargement échoué : ${loadError instanceof Error ? loadError.message : 'erreur réseau'}`);
    } finally {
      setLoading(false);
    }
  }, [shopId, tenantId, shopsApi]);

  useEffect(() => {
    void load();
  }, [load]);

  // Même visuel Magrit par défaut que le portail public (résolveur P18).
  const buildDefaultPreviewUrl = (tpl: TemplateDef): string => {
    return resolveProductImage({ name: tpl.productName, kind: tpl.key });
  };

  const handleUpload = async (tplKey: MockupTemplateType, file: File) => {
    setError(null);
    setUploadingKey(tplKey);
    try {
      await shopsApi.uploadCustomMockup(tenantId, shopId, tplKey, 'front', file);
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
      await shopsApi.restoreCustomMockup(tenantId, shopId, tplKey, 'front');
      await load();
    } catch (err) {
      setError((err as Error).message || 'Erreur inconnue');
    } finally {
      setUploadingKey(null);
    }
  };

  return (
    <section className="border border-line rounded-xl p-4 bg-paper space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-brand" />
            Mockups custom de cette boutique
          </h3>
          <p className="text-xs text-ink-muted mt-1">
            Remplace le mockup Magrit-brandé par défaut par votre propre visuel pour chaque type de produit. Format : PNG, JPG, WebP ou SVG (5 Mo max).
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-err-fg bg-err-bg border border-err-fg/30 px-3 py-2 rounded">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {TEMPLATES.map((tpl) => {
            const override = overrides[`${tpl.key}-front`];
            const isCustom = !!override;
            const previewUrl = isCustom ? override.mockupImageUrl : buildDefaultPreviewUrl(tpl);
            const isUploading = uploadingKey === tpl.key;

            return (
              <div
                key={tpl.key}
                className="border border-line rounded-lg overflow-hidden bg-bg"
              >
                <div className="px-3 py-2 bg-paper border-b border-line flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{tpl.label}</span>
                  {isCustom && (
                    <span
                      className="text-[10px] font-medium text-warn-fg bg-warn-bg px-1.5 py-0.5 rounded"
                      title="Mockup custom actif"
                    >
                      personnalisé
                    </span>
                  )}
                </div>
                <div className="aspect-[4/3] bg-paper relative">
                  <img
                    src={previewUrl}
                    alt={`Aperçu ${tpl.label}`}
                    className="w-full h-full object-cover"
                  />
                  {isUploading && (
                    <div className="absolute inset-0 bg-paper/80 grid place-items-center">
                      <Loader2 className="w-6 h-6 animate-spin text-ink-muted" />
                    </div>
                  )}
                </div>
                <div className="p-2 flex items-center gap-1.5 bg-paper">
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
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium border border-line-2 rounded hover:bg-bg disabled:opacity-50"
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
                      className="inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium border border-line-2 rounded hover:bg-bg text-ink-muted disabled:opacity-50"
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
