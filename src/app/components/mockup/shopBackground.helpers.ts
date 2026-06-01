/**
 * Helpers S-PIM-VISUELS-5 (Sprint 7, 2026-06-01).
 *
 * Récupère le background résolu pour un shop + gamme via RPC
 * resolve_shop_background. Cascade gamme > shop > default (1e3a8a sans bg).
 *
 * Pattern composition LAYERED (vs bake-in dans le PNG) :
 *   - Le PNG mockup-generator reste juste le produit (transparent)
 *   - MockupImage wrap dans un div avec backgroundImage CSS
 *   - Le background est invalidable indépendamment du cache PNG (CDN
 *     Storage product_mockups n'a pas besoin d'être purgé quand le fond
 *     change — seul le composant React re-render avec nouveau bg URL)
 *
 * Alternative écartée : bake-in du background dans le PNG (cf. spec Q7
 * "Cache key étendue avec background_url"). Raisons du choix layered :
 *   - PNG plus petit (~30 KB shape transparent vs 200 KB avec photo bg)
 *   - Pas de fetch/conversion base64 dans l'edge function (perf)
 *   - Changement de fond instantané côté UI (pas d'attente render)
 *   - Cache PNG inchangé (cache key stable, durée de vie longue)
 */

import { supabase } from '/utils/supabase/client';

export interface ResolvedShopBackground {
  backgroundUrl: string | null;
  primaryColor: string;
  source: 'gamme' | 'shop' | 'default';
}

const DEFAULT_BACKGROUND: ResolvedShopBackground = {
  backgroundUrl: null,
  primaryColor: '#1e3a8a',
  source: 'default',
};

export async function resolveShopBackground(
  shopId: string,
  gammeSlug: string,
): Promise<ResolvedShopBackground> {
  if (!shopId) return DEFAULT_BACKGROUND;
  const { data, error } = await supabase.rpc('resolve_shop_background', {
    p_shop_id: shopId,
    p_gamme_slug: gammeSlug ?? '',
  });
  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return DEFAULT_BACKGROUND;
  }
  const row = data[0] as { background_url: string | null; primary_color: string; source: string };
  return {
    backgroundUrl: row.background_url,
    primaryColor: row.primary_color || '#1e3a8a',
    source: (row.source === 'gamme' || row.source === 'shop') ? row.source : 'default',
  };
}
