/**
 * Helpers d'URL pour le composant MockupImage (Story S4.3, Epic 4).
 *
 * Extraits dans un module separe pour testabilite sans rendering React
 * (le projet n'a pas de @testing-library/react configure aujourd'hui).
 *
 * Helpers PURS : pas d'import top-level de projectId (sinon vitest doit
 * resoudre l'alias /utils/supabase/info qui n'est pas configure pour
 * le test environment node). Le composant React passe projectId aux
 * helpers via parametres.
 *
 * Pattern image (cf. story-S4.3) :
 *  1. buildPublicMockupUrl()    -> URL CDN publique directe (cache HIT)
 *  2. buildEdgeFunctionUrl()    -> URL edge function (fallback cache MISS)
 *  3. buildCacheBuster()        -> nonce pour forcer le re-fetch CDN apres
 *                                  generation server-side
 */

const BUCKET = "product_mockups";

/**
 * P3-VISUELS (2026-06-15) — Suffix de version du cache PNG.
 *
 * Quand on refond les templates SVG (mockup-generator côté Deno), il faut
 * invalider le cache PNG existant côté CDN. Plutôt que de purger le bucket
 * (lourd + risque de perdre des PNG legacy), on bump la cache key avec un
 * suffixe version. Les PNG nouvelle génération iront sous `<product>_v2.png`,
 * les anciens restent en place sans interférence.
 *
 * IMPORTANT : doit rester synchrone avec `CACHE_VERSION_SUFFIX` dans
 * `supabase/functions/mockup-generator/index.ts`. Modifier les 2 ensemble.
 *
 * Bump l'incrément à chaque refonte significative des templates SVG.
 */
const CACHE_VERSION_SUFFIX = "_v6";

export interface MockupParams {
  tenantId: string;
  shopId: string;
  productId: string;
}

export interface MockupSpecs extends MockupParams {
  width: number;
  height: number;
  productName: string;
  primaryColor: string;
  /**
   * Template SVG mockup-generator (S4.2). Optionnel : si absent ou vide,
   * l'edge function fallback sur "flyer" (retro-compat S4.3).
   */
  template?: string;
  /**
   * S-PRODUCT-VIEWS-MULTI (Sprint 7, 2026-06-01) : 'front' (défaut,
   * retro-compat path sans suffixe) ou 'back' (path suffixé __back).
   */
  view?: 'front' | 'back';
}

/**
 * URL publique CDN du bucket product_mockups (pour <img src>).
 * Format front : https://{projectId}.supabase.co/storage/v1/object/public/product_mockups/{tenant}/{shop}/{product}.png
 * Format back  : ...{product}__back.png (retro-compat front via path sans suffixe).
 */
export function buildPublicMockupUrl(
  projectId: string,
  params: MockupParams & { view?: 'front' | 'back' },
): string {
  const viewSuffix = params.view === 'back' ? '__back' : '';
  return `https://${projectId}.supabase.co/storage/v1/object/public/${BUCKET}/${params.tenantId}/${params.shopId}/${params.productId}${viewSuffix}${CACHE_VERSION_SUFFIX}.png`;
}

/**
 * URL edge function mockup-generator avec query params encodes.
 * Utilisee en fetch JS avec Authorization header (S4.1c).
 *
 * S4.2 : si specs.template est fourni et non-vide, ajoute au query params.
 * S-PRODUCT-VIEWS-MULTI : si specs.view='back', ajoute view=back.
 */
export function buildEdgeFunctionUrl(projectId: string, specs: MockupSpecs): string {
  const params: Record<string, string> = {
    tenant: specs.tenantId,
    shop: specs.shopId,
    product: specs.productId,
    width: String(specs.width),
    height: String(specs.height),
    productName: specs.productName,
    primaryColor: specs.primaryColor,
  };
  if (specs.template && specs.template.trim() !== "") {
    params.template = specs.template.trim();
  }
  if (specs.view === 'back') {
    params.view = 'back';
  }
  const qs = new URLSearchParams(params).toString();
  return `https://${projectId}.supabase.co/functions/v1/mockup-generator?${qs}`;
}

/**
 * Cache buster monotone court pour forcer le browser a re-fetch l'URL CDN
 * apres une generation server-side (sinon le browser cache le 404 initial).
 *
 * Date.now().toString(36) : ~8 chars, monotone, suffisant.
 */
export function buildCacheBuster(): string {
  return Date.now().toString(36);
}
