/**
 * Pipeline de rendu mockup paramantrique : SVG -> PNG (Story S4.1b, Epic 4).
 *
 * ⚠️ Pivot technique vs Architecture §4.3 d'origine :
 *   - Specifie initialement "sharp + svgdom" (Node native binding) qui ne
 *     fonctionne PAS dans Supabase Edge Functions (Deno Deploy, pas de native
 *     Node addons supportes).
 *   - Pivot vers `@resvg/resvg-wasm` (npm, pure WASM) :
 *     - Choix initial deno.land/x/resvg_wasm@0.2.0 abandonne (smoke test
 *       2026-05-10 a echoue : la lib fetch un CDN externe qui retourne 500).
 *     - Pivot final : npm:@resvg/resvg-wasm@2.6.2, plus fiable, maintenu
 *       activement par yisibl (https://github.com/yisibl/resvg-js).
 *   - svgdom retire car SVG generation = string templating direct.
 *
 * Init WASM : lazy au premier appel, fetch du binaire .wasm depuis unpkg
 * (CDN fiable). Cache au niveau module (module-level singleton promise).
 *
 * Usage (depuis l'edge function S4.1c future) :
 *
 *   import { renderSvgToPng } from "../_shared/mockup/renderer.ts";
 *
 *   const png = await renderSvgToPng(
 *     "flyer",
 *     { width: 148, height: 210, productName: "Flyer A5" },
 *     { primaryColor: "#FF6B35" },
 *   );
 *
 * Erreurs typees :
 *  - "unsupported_template" : template inconnu
 *  - "invalid_specs" : dimensions <= 0 ou productName manquant
 *  - "render_failed" : resvg a leve (rare, indique un SVG malforme ou WASM init fail)
 */

import { initWasm, Resvg } from "npm:@resvg/resvg-wasm@2.6.2";
import { flyerSvg } from "./templates/flyer.ts";
import {
  MockupRendererError,
  type MockupTemplate,
  type ProductSpecs,
  type ShopTheming,
} from "./types.ts";

const RESVG_WASM_URL =
  "https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm";

/** Init WASM lazy + cache. Premier appel ~1-2s, ensuite immediat. */
let wasmReady: Promise<void> | null = null;
function ensureWasmInitialized(): Promise<void> {
  if (!wasmReady) {
    wasmReady = (async () => {
      const resp = await fetch(RESVG_WASM_URL);
      if (!resp.ok) {
        throw new Error(
          `Telechargement WASM resvg-wasm a echoue : HTTP ${resp.status}`,
        );
      }
      await initWasm(resp);
    })();
  }
  return wasmReady;
}

/**
 * Genere les bytes PNG d'un mockup pour un produit donne.
 *
 * @param template Identifiant du template (ex: "flyer"). Etendu en S4.2.
 * @param specs Specs Clariprint minimales (width, height en mm + productName).
 * @param theming Theming boutique (primaryColor hex).
 * @returns Promise<Uint8Array> bytes PNG 1024x1024.
 * @throws MockupRendererError si template inconnu, specs invalides, ou render fail.
 */
export async function renderSvgToPng(
  template: MockupTemplate | string,
  specs: ProductSpecs,
  theming: ShopTheming,
): Promise<Uint8Array> {
  // Validation des specs (defense aux frontieres du module).
  if (
    !specs ||
    typeof specs.width !== "number" ||
    typeof specs.height !== "number" ||
    specs.width <= 0 ||
    specs.height <= 0 ||
    !specs.productName ||
    typeof specs.productName !== "string"
  ) {
    throw new MockupRendererError(
      "invalid_specs",
      `Specs invalides : width et height doivent etre > 0, productName non-vide. Recu : ${JSON.stringify(specs)}`,
    );
  }
  if (!theming || typeof theming.primaryColor !== "string") {
    throw new MockupRendererError(
      "invalid_specs",
      `Theming invalide : primaryColor string requis. Recu : ${JSON.stringify(theming)}`,
    );
  }

  // Dispatch sur le template demande. Etendu en S4.2 (4 templates supplementaires MVP).
  let svgString: string;
  switch (template) {
    case "flyer":
      svgString = flyerSvg(specs, theming);
      break;
    default:
      throw new MockupRendererError(
        "unsupported_template",
        `Template "${template}" non supporte. Supportes : flyer.`,
      );
  }

  // Conversion SVG -> PNG via @resvg/resvg-wasm.
  let pngBytes: Uint8Array;
  try {
    await ensureWasmInitialized();
    const resvg = new Resvg(svgString);
    const rendered = resvg.render();
    pngBytes = rendered.asPng();
  } catch (err) {
    throw new MockupRendererError(
      "render_failed",
      `resvg a leve une exception. SVG malforme ou WASM init/render echec.`,
      err,
    );
  }

  // Verification basique : bytes non-vides + magic number PNG.
  if (!pngBytes || pngBytes.length < 8) {
    throw new MockupRendererError(
      "render_failed",
      `resvg a retourne un buffer trop court (${pngBytes?.length ?? 0} bytes).`,
    );
  }
  // Magic PNG : 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    pngBytes[0] === 0x89 &&
    pngBytes[1] === 0x50 &&
    pngBytes[2] === 0x4e &&
    pngBytes[3] === 0x47 &&
    pngBytes[4] === 0x0d &&
    pngBytes[5] === 0x0a &&
    pngBytes[6] === 0x1a &&
    pngBytes[7] === 0x0a;
  if (!isPng) {
    throw new MockupRendererError(
      "render_failed",
      `resvg a retourne des bytes sans magic PNG. Premiers bytes : ${Array.from(pngBytes.slice(0, 8)).map((b) => b.toString(16)).join(" ")}`,
    );
  }

  return pngBytes;
}
