/**
 * MockupImage — composant React qui consomme l'edge function mockup-generator
 * (S4.1c) avec fallback graceful (Story S4.3, Epic 4).
 *
 * Pattern image (cf. story-S4.3) :
 *  1. Tente l'URL publique CDN directement (cache HIT < 50ms perçu user).
 *  2. onError → fetch JS edge function avec auth → declenche render+upload.
 *  3. Retry l'URL publique avec cache buster.
 *  4. Si tout fail → fallback ProductMockup (SVG schematic) ou inline.
 *
 * Tracking d'un compteur de retry (useRef) pour eviter les boucles infinies
 * en cas de double onError successif.
 *
 * A11y NFR18 : alt prop obligatoire, role/aria sur skeleton et fallback.
 */

import { useMemo, useRef, useState } from "react";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { TEST_IDS } from "../../lib/testIds";
import { ProductMockup } from "../brand/ProductMockup";
import {
  buildCacheBuster,
  buildEdgeFunctionUrl,
  buildPublicMockupUrl,
  type MockupSpecs,
} from "./MockupImage.helpers";

export interface MockupImageProps {
  tenantId: string;
  shopId: string;
  productId: string;
  /** Largeur produit en mm (specs Clariprint, ex: 148 pour A5 portrait). */
  width: number;
  /** Hauteur produit en mm. */
  height: number;
  /** Nom commercial du produit, affiché dans le mockup (a11y + render). */
  productName: string;
  /** Couleur primaire du theming boutique au format hex `#RRGGBB`. */
  primaryColor: string;
  /** Texte alternatif (NFR18 a11y). Requis. */
  alt: string;
  /** Classes CSS du wrapper. */
  className?: string;
  /**
   * Template SVG mockup-generator (S4.2 : flyer / carteVisite / brochure /
   * etiquette / kakemono). Optionnel : si absent, l'edge function fallback
   * sur flyer. Le caller (S2.3 ShopProductCard) le derive via
   * resolveMockupTemplate(product.config.kind).
   */
  template?: string;
  /**
   * S-PIM-VISUELS-5 : URL du fond shop résolu via resolveShopBackground(shopId, gammeSlug).
   * Si fourni, le composant wrap le PNG produit (transparent) dans un div avec
   * backgroundImage CSS — composition LAYERED (vs bake-in PNG, cf.
   * shopBackground.helpers commentaire détaillé). Optionnel : si absent ou null,
   * rendu actuel inchangé (rétro-compat).
   */
  backgroundUrl?: string | null;
  /**
   * S-PRODUCT-VIEWS-MULTI (Sprint 7) : 'front' (défaut, retro-compat) ou
   * 'back'. Sert à choisir le PNG cible côté CDN (path suffixé __back).
   */
  view?: 'front' | 'back';
  /**
   * P4-VISUELS (2026-06-15) : URL d'un mockup custom uploadé par l'admin
   * tenant via ShopVisualSettings. Si fourni, **bypass complètement** le
   * mécanisme edge function : on affiche directement l'image custom (le
   * client a personnalisé ce template pour SA boutique). Conserve le
   * backgroundUrl pour cohérence layered (fond + mockup custom).
   */
  customMockupUrl?: string | null;
}

type ImageState = "loading" | "loaded" | "fetching-edge" | "error";

const FETCH_TIMEOUT_MS = 10_000;

export function MockupImage(props: MockupImageProps): JSX.Element {
  // P4-VISUELS — Si un mockup custom est fourni par le caller, on l'affiche
  // direct sans passer par l'edge function (bypass complet du mécanisme
  // retry/CDN). Le fond shop reste appliqué via wrapper backgroundUrl pour
  // cohérence visuelle layered (fond + custom mockup transparent ou pas).
  if (props.customMockupUrl && props.customMockupUrl.trim().length > 0) {
    const wrapperStyleCustom: React.CSSProperties = {
      position: 'relative',
      ...(props.backgroundUrl
        ? {
            backgroundImage: `url("${props.backgroundUrl}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }
        : {}),
    };
    return (
      <div
        data-testid={TEST_IDS.mockup.productImage}
        data-has-bg={props.backgroundUrl ? 'true' : 'false'}
        data-custom-mockup="true"
        className={props.className}
        style={wrapperStyleCustom}
      >
        <img
          data-testid={TEST_IDS.mockup.productImageImg}
          src={props.customMockupUrl}
          alt={props.alt}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  const params = useMemo(
    () => ({
      tenantId: props.tenantId,
      shopId: props.shopId,
      productId: props.productId,
    }),
    [props.tenantId, props.shopId, props.productId],
  );
  const view = props.view ?? 'front';
  const initialSrc = useMemo(
    () => buildPublicMockupUrl(projectId, { ...params, view }),
    [params, view],
  );

  const [state, setState] = useState<ImageState>("loading");
  const [src, setSrc] = useState<string>(initialSrc);
  // Empeche les boucles infinies si le retry post-edge echoue aussi
  const hasRetriedRef = useRef<boolean>(false);

  const handleLoad = () => {
    setState("loaded");
  };

  const handleError = async () => {
    // Si on a deja tente le fallback edge function et que l'image echoue
    // toujours -> bascule en mode error final (pas de boucle).
    if (hasRetriedRef.current) {
      setState("error");
      return;
    }
    hasRetriedRef.current = true;
    setState("fetching-edge");

    const specs: MockupSpecs = {
      ...params,
      width: props.width,
      height: props.height,
      productName: props.productName,
      primaryColor: props.primaryColor,
      template: props.template,
      view,
    };
    const edgeUrl = buildEdgeFunctionUrl(projectId, specs);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const resp = await fetch(edgeUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${publicAnonKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!resp.ok) {
        setState("error");
        return;
      }
      // L'edge function a render + upload. On retry l'URL publique avec
      // cache buster pour forcer le browser a re-fetch (sinon il garde
      // le 404 cache).
      setSrc(`${initialSrc}?v=${buildCacheBuster()}`);
      setState("loading");
    } catch (_err) {
      // Network err, timeout, ou abort
      setState("error");
    }
  };

  // ─── Render fallback ultime (state === "error") ──────────────────────────
  if (state === "error") {
    return (
      <div
        data-testid={TEST_IDS.mockup.productImageFallback}
        role="img"
        aria-label={`Mockup indisponible pour ${props.productName}`}
        className={props.className}
      >
        <ProductMockup
          name={props.productName}
          className="w-full h-full"
        />
      </div>
    );
  }

  // ─── Render skeleton OU image ────────────────────────────────────────────
  const showSkeleton = state === "loading" || state === "fetching-edge";

  // S-PIM-VISUELS-5 : composition LAYERED via CSS si backgroundUrl fourni.
  // Le PNG produit (transparent) s'affiche par-dessus le fond shop résolu.
  const wrapperStyle: React.CSSProperties = {
    position: "relative",
    ...(props.backgroundUrl
      ? {
          backgroundImage: `url("${props.backgroundUrl}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }
      : {}),
  };

  return (
    <div
      data-testid={TEST_IDS.mockup.productImage}
      data-has-bg={props.backgroundUrl ? "true" : "false"}
      className={props.className}
      style={wrapperStyle}
    >
      {showSkeleton && (
        <div
          data-testid={TEST_IDS.mockup.productImageSkeleton}
          role="status"
          aria-busy="true"
          aria-label="Chargement du mockup"
          className="absolute inset-0 bg-line animate-pulse rounded-lg"
        />
      )}
      <img
        data-testid={TEST_IDS.mockup.productImageImg}
        src={src}
        alt={props.alt}
        loading="lazy"
        onLoad={handleLoad}
        onError={handleError}
        className={`w-full h-full object-cover ${showSkeleton ? "opacity-0" : "opacity-100"}`}
        style={{ transition: "opacity 200ms" }}
      />
    </div>
  );
}
