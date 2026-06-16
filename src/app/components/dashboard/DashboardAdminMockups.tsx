/**
 * P5-VISUELS (2026-06-15) — Page admin générale Magrit : référence visuelle
 * des 5 templates SVG Magrit-brandés (carteVisite / flyer / brochure /
 * etiquette / kakemono).
 *
 * Accès : isAdmin OU isSuperAdmin (membre du tenant `magrit-root`). Même
 * pattern que DashboardAdminPIM (qui gère le PIM partagé).
 *
 * Rôle : permet au superadmin de visualiser comment le rendu Magrit-brandé
 * apparaît sur chaque type de produit (référence pour onboarding / debug /
 * communication interne).
 *
 * Évolutions futures (placeholder V2) :
 *   - Édition des templates SVG via UI (aujourd'hui : code Deno seulement)
 *   - Galerie de variations alternatives
 *   - Stats d'usage par template (combien de boutiques l'utilisent)
 */

import { useMemo } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Image as ImageIcon, ShieldCheck, AlertCircle } from 'lucide-react';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { useTenant } from '../../contexts/TenantContext';
import { useTenantPath } from '../../hooks/useTenantPath';
import { projectId } from '/utils/supabase/info';
import { buildEdgeFunctionUrl } from '../mockup/MockupImage.helpers';

interface TemplateRef {
  key:
    | 'carteVisite'
    | 'flyer'
    | 'brochure'
    | 'etiquette'
    | 'kakemono'
    | 'packaging'
    | 'depliant';
  label: string;
  width: number;
  height: number;
  productName: string;
  description: string;
}

const TEMPLATES: TemplateRef[] = [
  {
    key: 'carteVisite',
    label: 'Carte de visite',
    width: 85,
    height: 55,
    productName: 'Carte commerciale',
    description:
      "Split 35/65 : bandeau bleu pastel + marguerite à gauche / Magrit italic + tagline + coordonnées simulées + référence à droite.",
  },
  {
    key: 'flyer',
    label: 'Flyer / Tract',
    width: 148,
    height: 210,
    productName: 'Flyer A5 promo',
    description:
      "3 zones verticales : bandeau tile + grande marguerite en haut / Magrit + tagline + 4 lignes corps / contact + référence.",
  },
  {
    key: 'depliant',
    label: 'Dépliant 3 volets',
    width: 210,
    height: 297,
    productName: 'Dépliant 3 volets A4',
    description:
      "3 volets côte à côte, volet central tile Magrit + marguerite, volets latéraux mock content avec lignes de texte simulées (P15).",
  },
  {
    key: 'brochure',
    label: 'Brochure (livret)',
    width: 210,
    height: 297,
    productName: 'Brochure 16 pages',
    description:
      "Couverture 3D perspective 3/4 avec tranche de pages internes empilées visible côté gauche (P15 refonte).",
  },
  {
    key: 'packaging',
    label: 'Packaging / Boîte',
    width: 200,
    height: 150,
    productName: 'Boîte expédition',
    description:
      "Boîte kraft 3D vue 3/4 ouverte avec rabats relevés. Marquage Magrit centré sur la face avant + liseré pollen (P15).",
  },
  {
    key: 'etiquette',
    label: 'Étiquette adhésive',
    width: 60,
    height: 40,
    productName: 'Étiquette produit',
    description: "Tile complète + marguerite + Magrit lockup + bordure dashed marquée (effet sticker découpé, P15 boost).",
  },
  {
    key: 'kakemono',
    label: 'Roll-up / Kakémono',
    width: 850,
    height: 2000,
    productName: 'Roll-up salon',
    description:
      "Format très portrait : bandeau tile + marguerite en haut / Magrit énorme + tagline / contact + référence + pied gris du roll-up.",
  },
];

export function DashboardAdminMockups() {
  const isAdmin = useIsAdmin();
  const { isSuperAdmin } = useTenant();
  const tp = useTenantPath();
  const hasAccess = isAdmin || isSuperAdmin;

  // Specs deterministes pour la preview (= identique aux snapshots tests Deno)
  const previewUrls = useMemo(
    () =>
      TEMPLATES.map((tpl) => ({
        ...tpl,
        url: buildEdgeFunctionUrl(projectId, {
          tenantId: 'magrit-admin-preview',
          shopId: 'magrit-admin-preview',
          productId: `preview-${tpl.key}`,
          width: tpl.width,
          height: tpl.height,
          productName: tpl.productName,
          primaryColor: '#1e3a8a',
          template: tpl.key,
          view: 'front',
        }),
      })),
    [],
  );

  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto pt-8 space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-medium mb-1">Accès réservé</p>
            <p>
              Cette page est réservée aux administrateurs Magrit (membres du
              tenant système{' '}
              <code className="bg-amber-100 px-1.5 py-0.5 rounded">magrit-root</code>
              ).
            </p>
          </div>
        </div>
        <Link
          to={tp('/dashboard')}
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au tableau de bord
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <Link
          to={tp('/dashboard')}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>
        <span
          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full"
          title="Page admin réservée au tenant magrit-root"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Admin Magrit
        </span>
      </div>

      <header>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ImageIcon className="w-6 h-6 text-blue-600" />
          Mockups Magrit-brandés (référence)
        </h2>
        <p className="text-sm text-gray-600 mt-1 max-w-3xl">
          Vue d'ensemble des 5 templates SVG appliqués par défaut sur tous les
          produits affichés en boutique B2B. Chaque tenant peut overrider ces
          mockups dans son éditeur boutique (section « Mockups custom »).
          Référence visuelle pour onboarding et communication interne.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {previewUrls.map((tpl) => (
          <article
            key={tpl.key}
            className="border border-gray-200 rounded-xl overflow-hidden bg-white"
          >
            <div className="aspect-[4/3] bg-gray-50">
              <img
                src={tpl.url}
                alt={`Preview ${tpl.label}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium text-gray-900 text-sm">{tpl.label}</h3>
                <code className="text-[10px] text-gray-500 font-mono">
                  {tpl.width}×{tpl.height} mm
                </code>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                {tpl.description}
              </p>
              <code className="block text-[10px] text-gray-400 font-mono pt-1">
                templates/{tpl.key}.ts
              </code>
            </div>
          </article>
        ))}
      </div>

      <section className="border border-gray-200 rounded-xl p-4 bg-gray-50">
        <h3 className="font-semibold text-gray-900 mb-2 text-sm">
          Évolution prévue (placeholder V2)
        </h3>
        <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
          <li>Édition des templates SVG via UI (aujourd'hui : code Deno seulement)</li>
          <li>Galerie de variations alternatives par template</li>
          <li>Statistiques d'usage par template (boutiques avec override custom)</li>
        </ul>
      </section>
    </div>
  );
}
