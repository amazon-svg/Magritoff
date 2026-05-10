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
}

type ImageState = "loading" | "loaded" | "fetching-edge" | "error";

const FETCH_TIMEOUT_MS = 10_000;

export function MockupImage(props: MockupImageProps): JSX.Element {
  const params = useMemo(
    () => ({
      tenantId: props.tenantId,
      shopId: props.shopId,
      productId: props.productId,
    }),
    [props.tenantId, props.shopId, props.productId],
  );
  const initialSrc = useMemo(
    () => buildPublicMockupUrl(projectId, params),
    [params],
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

  return (
    <div
      data-testid={TEST_IDS.mockup.productImage}
      className={props.className}
      style={{ position: "relative" }}
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
