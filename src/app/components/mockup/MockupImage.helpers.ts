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
}

/**
 * URL publique CDN du bucket product_mockups (pour <img src>).
 * Format : https://{projectId}.supabase.co/storage/v1/object/public/product_mockups/{tenant}/{shop}/{product}.png
 */
export function buildPublicMockupUrl(projectId: string, params: MockupParams): string {
  return `https://${projectId}.supabase.co/storage/v1/object/public/${BUCKET}/${params.tenantId}/${params.shopId}/${params.productId}.png`;
}

/**
 * URL edge function mockup-generator avec query params encodes.
 * Utilisee en fetch JS avec Authorization header (S4.1c).
 */
export function buildEdgeFunctionUrl(projectId: string, specs: MockupSpecs): string {
  const qs = new URLSearchParams({
    tenant: specs.tenantId,
    shop: specs.shopId,
    product: specs.productId,
    width: String(specs.width),
    height: String(specs.height),
    productName: specs.productName,
    primaryColor: specs.primaryColor,
  }).toString();
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
