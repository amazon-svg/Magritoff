/**
 * Edge Function `mockup-generator` (Story S4.1c, Epic 4 Mockup Engine).
 *
 * Endpoints exposes (sous /functions/v1/mockup-generator/*) :
 *   GET  /                  -> cache-aware mockup retrieval (HIT 302 / MISS render+upload)
 *   POST /invalidate?shop=Y -> admin tenant invalidation (suppression Storage)
 *   OPTIONS                 -> CORS preflight
 *   *                       -> 404
 *
 * Trade-off MVP (cf. story-S4.1c) : les specs (width, height, productName,
 * primaryColor) sont passees en query params par le caller. Pas de
 * ClariprintAdapter Deno (port a faire dans story future). Cache key =
 * {tenant}/{shop}/{product}.png ; invalidation explicite quand admin change
 * branding.
 *
 * Pattern routing : Deno.serve standalone (2 routes simples, Hono over-engineered).
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  renderSvgToPng,
  SUPPORTED_TEMPLATES,
  isMockupTemplate,
} from "../_shared/mockup/renderer.ts";
import {
  MockupRendererError,
  type MockupTemplate,
} from "../_shared/mockup/types.ts";
import { logLlmUsage } from "../_shared/llm_usage.ts";

const BUCKET = "product_mockups";
const PRIMARY_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const PRODUCT_NAME_MAX = 200;
const DEFAULT_TEMPLATE: MockupTemplate = "flyer";

const corsHeadersFull = {
  ...corsHeaders,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface ParsedSpecs {
  tenant: string;
  shop: string;
  product: string;
  width: number;
  height: number;
  productName: string;
  primaryColor: string;
  template: MockupTemplate;
}

type ParseResult =
  | { ok: true; specs: ParsedSpecs }
  | { ok: false; error: string; param: string };

function parseSpecs(url: URL): ParseResult {
  const tenant = (url.searchParams.get("tenant") ?? "").trim();
  const shop = (url.searchParams.get("shop") ?? "").trim();
  const product = (url.searchParams.get("product") ?? "").trim();
  if (!tenant) return { ok: false, error: "tenant query param required", param: "tenant" };
  if (!shop) return { ok: false, error: "shop query param required", param: "shop" };
  if (!product) return { ok: false, error: "product query param required", param: "product" };

  const widthRaw = url.searchParams.get("width");
  const heightRaw = url.searchParams.get("height");
  const width = Number(widthRaw);
  const height = Number(heightRaw);
  if (!Number.isFinite(width) || width <= 0) {
    return { ok: false, error: `width must be positive number, got "${widthRaw}"`, param: "width" };
  }
  if (!Number.isFinite(height) || height <= 0) {
    return { ok: false, error: `height must be positive number, got "${heightRaw}"`, param: "height" };
  }

  const productNameRaw = (url.searchParams.get("productName") ?? "").trim();
  if (!productNameRaw) {
    return { ok: false, error: "productName query param required", param: "productName" };
  }
  const productName = productNameRaw.slice(0, PRODUCT_NAME_MAX);

  const primaryColor = (url.searchParams.get("primaryColor") ?? "").trim();
  if (!PRIMARY_COLOR_REGEX.test(primaryColor)) {
    return {
      ok: false,
      error: `primaryColor must match #RRGGBB hex, got "${primaryColor}"`,
      param: "primaryColor",
    };
  }

  // S4.2 : template optionnel, default "flyer" pour retro-compat S4.3 MockupImage
  // qui ne le passe pas encore. Validation contre SUPPORTED_TEMPLATES si fourni.
  const templateRaw = url.searchParams.get("template");
  let template: MockupTemplate = DEFAULT_TEMPLATE;
  if (templateRaw !== null && templateRaw.trim() !== "") {
    const trimmed = templateRaw.trim();
    if (!isMockupTemplate(trimmed)) {
      return {
        ok: false,
        error: `template must be one of [${SUPPORTED_TEMPLATES.join(", ")}], got "${trimmed}"`,
        param: "template",
      };
    }
    template = trimmed;
  }

  return {
    ok: true,
    specs: {
      tenant,
      shop,
      product,
      width,
      height,
      productName,
      primaryColor,
      template,
    },
  };
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFull, "Content-Type": "application/json" },
  });
}

/**
 * Construit l'URL publique CDN du bucket product_mockups.
 * Format : {SUPABASE_URL}/storage/v1/object/public/product_mockups/{path}
 */
function publicMockupUrl(tenant: string, shop: string, product: string): string {
  const baseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  return `${baseUrl}/storage/v1/object/public/${BUCKET}/${tenant}/${shop}/${product}.png`;
}

function cacheKey(specs: { tenant: string; shop: string; product: string }): string {
  return `${specs.tenant}/${specs.shop}/${specs.product}.png`;
}

function getServiceRoleClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET handler : cache HIT 302 / cache MISS render+upload
// ─────────────────────────────────────────────────────────────────────────────

async function handleGenerate(url: URL): Promise<Response> {
  const parsed = parseSpecs(url);
  if (!parsed.ok) {
    return jsonResponse({ error: parsed.error, param: parsed.param }, 400);
  }
  const { specs } = parsed;
  const url302 = publicMockupUrl(specs.tenant, specs.shop, specs.product);

  // ─── Cache HIT check : HEAD sur l'URL CDN publique ──────────────────────
  // Si HEAD retourne 200, le PNG existe → 302 redirect vers le CDN.
  try {
    const head = await fetch(url302, { method: "HEAD" });
    if (head.ok) {
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeadersFull,
          Location: url302,
          "X-Mockup-Cache": "HIT",
        },
      });
    }
  } catch (_err) {
    // network err sur HEAD : on tombe en cache MISS (best-effort)
  }

  // ─── Cache MISS : render via S4.1b puis upload write-through ────────────
  let pngBytes: Uint8Array;
  try {
    pngBytes = await renderSvgToPng(
      specs.template,
      {
        width: specs.width,
        height: specs.height,
        productName: specs.productName,
      },
      { primaryColor: specs.primaryColor },
    );
  } catch (err) {
    // Fallback : log + tentative re-render avec specs minimales
    return await handleFallback(specs, err);
  }

  // Upload write-through (best-effort : si fail, on retourne quand meme les bytes).
  let uploadStatus = "OK";
  try {
    const supa = getServiceRoleClient();
    const { error } = await supa.storage
      .from(BUCKET)
      .upload(cacheKey(specs), pngBytes, {
        contentType: "image/png",
        upsert: true,
      });
    if (error) {
      console.error("[mockup-generator] upload failed:", error.message);
      uploadStatus = "FAILED";
    }
  } catch (err) {
    console.error("[mockup-generator] upload exception:", err);
    uploadStatus = "FAILED";
  }

  return new Response(pngBytes as BodyInit, {
    status: 200,
    headers: {
      ...corsHeadersFull,
      "Content-Type": "image/png",
      "X-Mockup-Cache": uploadStatus === "OK" ? "MISS" : "MISS-NO-CACHE",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

/**
 * Fallback path quand renderSvgToPng a leve.
 * Strategie : tenter un render avec specs minimales surs (rectangle gris +
 * texte "Mockup unavailable"). Si meme ca echoue, retourner 503 JSON.
 * Logger l'incident dans llm_usage_events.
 */
async function handleFallback(
  specs: ParsedSpecs,
  err: unknown,
): Promise<Response> {
  const errKind = err instanceof MockupRendererError ? err.kind : "unknown";
  const errMessage = err instanceof Error ? err.message : String(err);
  console.error(
    `[mockup-generator] render failed (${errKind}) for ${specs.tenant}/${specs.shop}/${specs.product}:`,
    errMessage,
  );

  // Logger best-effort dans llm_usage_events (extension : endpoint mockup-generator-fallback)
  try {
    await logLlmUsage({
      userId: null,
      tenantId: specs.tenant,
      endpoint: "mockup-generator-fallback",
      model: "n/a",
      usage: null,
      metadata: {
        reason: "render_failed",
        error_kind: errKind,
        error_message: errMessage.slice(0, 200),
        shop: specs.shop,
        product: specs.product,
      },
    });
  } catch (_logErr) {
    // best-effort
  }

  // Tentative re-render avec specs minimales surs (gris neutre).
  let fallbackBytes: Uint8Array | null = null;
  try {
    fallbackBytes = await renderSvgToPng(
      "flyer",
      { width: 1, height: 1, productName: "Mockup unavailable" },
      { primaryColor: "#CCCCCC" },
    );
  } catch (_err2) {
    // Le fallback render aussi a echoue (WASM init HS, etc.) → 503 JSON.
    return jsonResponse(
      { error: "Mockup rendering unavailable", kind: errKind },
      503,
    );
  }

  return new Response(fallbackBytes as BodyInit, {
    status: 200,
    headers: {
      ...corsHeadersFull,
      "Content-Type": "image/png",
      "X-Mockup-Cache": "FALLBACK",
      "X-Mockup-Fallback": "true",
      "Cache-Control": "no-store",
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /invalidate handler : admin tenant only
// ─────────────────────────────────────────────────────────────────────────────

async function handleInvalidate(url: URL, req: Request): Promise<Response> {
  const shopId = (url.searchParams.get("shop") ?? "").trim();
  if (!shopId) {
    return jsonResponse({ error: "shop query param required" }, 400);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Authorization Bearer JWT required" }, 401);
  }

  // 1. Recuperer le user via le client anon avec le JWT
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !anonKey) {
    return jsonResponse({ error: "Server misconfiguration" }, 500);
  }
  const supaUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await supaUser.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse({ error: "Invalid or expired JWT" }, 401);
  }
  const userId = userData.user.id;

  // 2. Verifier role admin/owner sur le tenant qui possede ce shop
  let admin;
  try {
    admin = getServiceRoleClient();
  } catch (err) {
    return jsonResponse({ error: "Server misconfiguration" }, 500);
  }
  const { data: shop, error: shopErr } = await admin
    .from("shops")
    .select("tenant_id")
    .eq("id", shopId)
    .maybeSingle();
  if (shopErr || !shop) {
    return jsonResponse({ error: "Shop not found" }, 404);
  }

  const { data: membership } = await admin
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", shop.tenant_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role as string)) {
    return jsonResponse(
      { error: "Forbidden: admin or owner role required on tenant" },
      403,
    );
  }

  // 3. List + remove des fichiers sous le prefixe tenant/shop/
  const prefix = `${shop.tenant_id}/${shopId}`;
  const { data: files, error: listErr } = await admin.storage
    .from(BUCKET)
    .list(prefix, { limit: 1000 });
  if (listErr) {
    return jsonResponse({ error: "List failed", details: listErr.message }, 500);
  }
  if (!files || files.length === 0) {
    return jsonResponse({ deleted: 0, shop: shopId, tenant: shop.tenant_id }, 200);
  }
  const paths = files.map((f) => `${prefix}/${f.name}`);
  const { error: removeErr } = await admin.storage.from(BUCKET).remove(paths);
  if (removeErr) {
    return jsonResponse(
      { error: "Remove failed", details: removeErr.message, paths_attempted: paths.length },
      500,
    );
  }

  return jsonResponse(
    { deleted: paths.length, shop: shopId, tenant: shop.tenant_id },
    200,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main router
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handler exporte pour tests Deno (mock fetch + createClient).
 * En prod : Deno.serve(handleRequest).
 */
export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeadersFull });
  }

  const url = new URL(req.url);
  // Strip prefix /mockup-generator si present (path inclus dans l'invocation
  // Supabase Edge Function : /functions/v1/mockup-generator/*).
  const path = url.pathname.replace(/^\/mockup-generator/, "");

  try {
    if (req.method === "GET" && (path === "" || path === "/")) {
      return await handleGenerate(url);
    }
    if (req.method === "POST" && path === "/invalidate") {
      return await handleInvalidate(url, req);
    }
    return jsonResponse({ error: "Not found" }, 404);
  } catch (err) {
    console.error("[mockup-generator] unhandled error:", err);
    return jsonResponse(
      { error: "Internal server error", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}

Deno.serve(handleRequest);
