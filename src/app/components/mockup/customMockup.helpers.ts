/**
 * P4-VISUELS (2026-06-15) — Résolution des mockups custom per-shop.
 *
 * Lecture sur `shop_template_mockups` : si l'admin tenant a uploadé un
 * mockup custom pour ce shop x template-type x view, on l'utilise au lieu
 * du mockup Magrit-brandé généré par `mockup-generator` edge function.
 *
 * RLS lecture publique autorisée si shop.active=true (cf. migration
 * 20260615000300_shop_template_mockups.sql).
 *
 * Pattern composition : helpers purs séparés pour testabilité vitest sans
 * @testing-library/react (cf. shopBackground.helpers.ts).
 */

import { supabase } from '/utils/supabase/client';

export type MockupTemplateType =
  | 'carteVisite'
  | 'flyer'
  | 'brochure'
  | 'etiquette'
  | 'kakemono'
  | 'packaging'
  | 'depliant';

export type MockupView = 'front' | 'back';

export interface CustomMockupRecord {
  shop_id: string;
  template_type: MockupTemplateType;
  view: MockupView;
  mockup_image_url: string;
}

/**
 * Résout l'URL du mockup custom pour un shop + template + view.
 * Retourne null si pas d'override en DB (le caller doit alors fallback sur
 * l'edge function mockup-generator).
 */
export async function resolveCustomMockup(
  shopId: string,
  templateType: MockupTemplateType,
  view: MockupView = 'front',
): Promise<string | null> {
  if (!shopId || !templateType) return null;
  const { data, error } = await supabase
    .from('shop_template_mockups')
    .select('mockup_image_url')
    .eq('shop_id', shopId)
    .eq('template_type', templateType)
    .eq('view', view)
    .maybeSingle();
  if (error || !data) return null;
  const url = (data as { mockup_image_url?: string | null }).mockup_image_url;
  return typeof url === 'string' && url.trim().length > 0 ? url : null;
}

/**
 * Liste tous les overrides d'un shop (utilisée par l'UI admin tenant pour
 * afficher l'état actuel des 5 templates x 2 views = jusqu'à 10 overrides).
 */
export async function listShopCustomMockups(
  shopId: string,
): Promise<CustomMockupRecord[]> {
  if (!shopId) return [];
  const { data, error } = await supabase
    .from('shop_template_mockups')
    .select('shop_id, template_type, view, mockup_image_url')
    .eq('shop_id', shopId);
  if (error || !data) return [];
  return data as CustomMockupRecord[];
}
