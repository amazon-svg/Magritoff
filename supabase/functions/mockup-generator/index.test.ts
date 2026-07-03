/**
 * Tests Deno pour l'edge function mockup-generator (Story S4.1c, Epic 4).
 *
 * Lancer :
 *   deno test --allow-net --allow-env --allow-read --allow-write --node-modules-dir=auto supabase/functions/mockup-generator/index.test.ts
 *
 * Strategie :
 *   - Monkey-patch globalThis.fetch pour simuler HEAD CDN (cache HIT vs MISS).
 *   - Fournir un Mock SUPABASE_URL pour eviter les hits reels.
 *   - Pas de mock createClient/storage : les tests cache MISS appellent
 *     vraiment renderSvgToPng (S4.1b) qui fonctionne avec npm:@resvg/resvg-wasm.
 *     L'upload Storage echoue silencieusement (best-effort, retourne MISS-NO-CACHE).
 *
 * 5 cas couverts :
 *   1. OPTIONS preflight -> 200 + CORS headers
 *   2. GET specs invalides (width negatif, primaryColor mal forme) -> 400
 *   3. GET cache MISS (HEAD 404) -> 200 PNG + X-Mockup-Cache: MISS ou MISS-NO-CACHE
 *   4. GET cache HIT (HEAD 200) -> 302 + X-Mockup-Cache: HIT
 *   5. POST invalidate sans Authorization -> 401
 */

import {
  assertEquals,
  assertStringIncludes,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRequest } from "./index.ts";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const ORIGINAL_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const ORIGINAL_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function setupEnv() {
  Deno.env.set("SUPABASE_URL", "https://test-project.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");
  // Pas de SERVICE_ROLE_KEY → upload tombe en MISS-NO-CACHE silencieux
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
}

function restoreEnv() {
  if (ORIGINAL_SUPABASE_URL !== undefined) Deno.env.set("SUPABASE_URL", ORIGINAL_SUPABASE_URL);
  else Deno.env.delete("SUPABASE_URL");
  if (ORIGINAL_ANON_KEY !== undefined) Deno.env.set("SUPABASE_ANON_KEY", ORIGINAL_ANON_KEY);
  else Deno.env.delete("SUPABASE_ANON_KEY");
  if (ORIGINAL_SERVICE_KEY !== undefined) Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", ORIGINAL_SERVICE_KEY);
  else Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  globalThis.fetch = ORIGINAL_FETCH;
}

/**
 * Mock fetch qui :
 *  - Retourne `headStatus` pour les HEAD sur l'URL CDN du bucket
 *  - Delegue au fetch original pour tout le reste (notamment le download
 *    du WASM resvg via unpkg, necessaire au render).
 */
function installMockFetch(headStatus: number) {
  const realFetch = ORIGINAL_FETCH;
  globalThis.fetch = ((input: Request | string | URL, init?: RequestInit) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    const method = init?.method ?? (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET");

    // Intercepter les HEAD vers le bucket public CDN
    if (
      method === "HEAD" &&
      url.includes("/storage/v1/object/public/product_mockups/")
    ) {
      return Promise.resolve(new Response(null, { status: headStatus }));
    }
    // Tout le reste → fetch reel (necessaire pour le download WASM resvg)
    return realFetch(input as RequestInfo | URL, init);
  }) as typeof fetch;
}

const VALID_QS = new URLSearchParams({
  tenant: "test-tenant",
  shop: "test-shop",
  product: "test-product-1",
  width: "148",
  height: "210",
  productName: "Flyer A5 Test",
  primaryColor: "#FF6B35",
}).toString();

Deno.test("mockup-generator OPTIONS preflight -> 200 + CORS", async () => {
  setupEnv();
  try {
    const res = await handleRequest(
      new Request("https://test-project.supabase.co/mockup-generator", {
        method: "OPTIONS",
      }),
    );
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
    assert(
      res.headers.get("Access-Control-Allow-Methods")?.includes("POST") ?? false,
      "Allow-Methods doit inclure POST",
    );
  } finally {
    restoreEnv();
  }
});

Deno.test("mockup-generator GET specs invalides (width negatif) -> 400", async () => {
  setupEnv();
  try {
    const qs = new URLSearchParams({
      tenant: "t",
      shop: "s",
      product: "p",
      width: "-1",
      height: "210",
      productName: "Flyer",
      primaryColor: "#FF6B35",
    }).toString();
    const res = await handleRequest(
      new Request(`https://test-project.supabase.co/mockup-generator?${qs}`),
    );
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.param, "width");
  } finally {
    restoreEnv();
  }
});

Deno.test("mockup-generator GET specs invalides (primaryColor mal forme) -> 400", async () => {
  setupEnv();
  try {
    const qs = new URLSearchParams({
      tenant: "t",
      shop: "s",
      product: "p",
      width: "148",
      height: "210",
      productName: "Flyer",
      primaryColor: "not-a-color",
    }).toString();
    const res = await handleRequest(
      new Request(`https://test-project.supabase.co/mockup-generator?${qs}`),
    );
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.param, "primaryColor");
  } finally {
    restoreEnv();
  }
});

Deno.test("mockup-generator GET cache HIT (HEAD 200) -> 302 redirect", async () => {
  setupEnv();
  installMockFetch(200); // CDN HEAD retourne 200 → cache HIT
  try {
    const res = await handleRequest(
      new Request(`https://test-project.supabase.co/mockup-generator?${VALID_QS}`),
    );
    assertEquals(res.status, 302);
    assertEquals(res.headers.get("X-Mockup-Cache"), "HIT");
    const location = res.headers.get("Location") ?? "";
    assertStringIncludes(location, "/storage/v1/object/public/product_mockups/test-tenant/test-shop/test-product-1.png");
  } finally {
    restoreEnv();
  }
});

Deno.test("mockup-generator GET cache MISS (HEAD 404) -> 200 PNG + bytes valides", async () => {
  setupEnv();
  installMockFetch(404); // CDN HEAD retourne 404 → cache MISS, va render
  try {
    const res = await handleRequest(
      new Request(`https://test-project.supabase.co/mockup-generator?${VALID_QS}`),
    );
    assertEquals(res.status, 200);
    // Status MISS-NO-CACHE car SERVICE_ROLE_KEY absent → upload skip
    const cacheStatus = res.headers.get("X-Mockup-Cache");
    assert(
      cacheStatus === "MISS" || cacheStatus === "MISS-NO-CACHE",
      `X-Mockup-Cache attendu MISS ou MISS-NO-CACHE, recu ${cacheStatus}`,
    );
    assertEquals(res.headers.get("Content-Type"), "image/png");
    const buf = new Uint8Array(await res.arrayBuffer());
    assert(buf.length > 100, `bytes trop courts : ${buf.length}`);
    // Magic PNG check
    assertEquals(buf[0], 0x89);
    assertEquals(buf[1], 0x50);
    assertEquals(buf[2], 0x4e);
    assertEquals(buf[3], 0x47);
  } finally {
    restoreEnv();
  }
});

Deno.test("mockup-generator POST /invalidate sans Authorization -> 401", async () => {
  setupEnv();
  try {
    const res = await handleRequest(
      new Request(
        "https://test-project.supabase.co/mockup-generator/invalidate?shop=test-shop",
        { method: "POST" },
      ),
    );
    assertEquals(res.status, 401);
    const body = await res.json();
    assertStringIncludes(body.error, "Authorization");
  } finally {
    restoreEnv();
  }
});

Deno.test("mockup-generator POST /invalidate sans shop param -> 400", async () => {
  setupEnv();
  try {
    const res = await handleRequest(
      new Request("https://test-project.supabase.co/mockup-generator/invalidate", {
        method: "POST",
        headers: { Authorization: "Bearer fake-jwt" },
      }),
    );
    assertEquals(res.status, 400);
    const body = await res.json();
    assertStringIncludes(body.error, "shop");
  } finally {
    restoreEnv();
  }
});

Deno.test("mockup-generator route inconnue -> 404", async () => {
  setupEnv();
  try {
    const res = await handleRequest(
      new Request("https://test-project.supabase.co/mockup-generator/unknown-route", {
        method: "GET",
      }),
    );
    assertEquals(res.status, 404);
  } finally {
    restoreEnv();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// S4.2 — query param `template` (default flyer si absent, validation contre
// SUPPORTED_TEMPLATES, dispatch vers le bon template Svg).
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("mockup-generator GET template=carteVisite valide -> 200 PNG (cache MISS)", async () => {
  setupEnv();
  installMockFetch(404); // CDN HEAD 404 -> cache MISS, render avec carteVisite
  try {
    const qs = new URLSearchParams({
      tenant: "t-cv",
      shop: "s-cv",
      product: "p-cv",
      width: "85",
      height: "55",
      productName: "Carte Pro",
      primaryColor: "#FF6B35",
      template: "carteVisite",
    }).toString();
    const res = await handleRequest(
      new Request(`https://test-project.supabase.co/mockup-generator?${qs}`),
    );
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("Content-Type"), "image/png");
    const buf = new Uint8Array(await res.arrayBuffer());
    assert(buf.length > 100, `bytes trop courts : ${buf.length}`);
    assertEquals(buf[0], 0x89);
    assertEquals(buf[1], 0x50);
  } finally {
    restoreEnv();
  }
});

Deno.test("mockup-generator GET sans template -> fallback flyer (retro-compat S4.3)", async () => {
  setupEnv();
  installMockFetch(404);
  try {
    // VALID_QS ne contient pas template -> doit utiliser flyer par defaut
    const res = await handleRequest(
      new Request(`https://test-project.supabase.co/mockup-generator?${VALID_QS}`),
    );
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("Content-Type"), "image/png");
    const buf = new Uint8Array(await res.arrayBuffer());
    // Magic PNG present : la generation a bien tourne avec flyer (template valide)
    assertEquals(buf[0], 0x89);
  } finally {
    restoreEnv();
  }
});

Deno.test("mockup-generator GET template=tshirt invalide -> 400 + message liste templates", async () => {
  setupEnv();
  try {
    const qs = new URLSearchParams({
      tenant: "t",
      shop: "s",
      product: "p",
      width: "148",
      height: "210",
      productName: "Flyer",
      primaryColor: "#FF6B35",
      template: "tshirt",
    }).toString();
    const res = await handleRequest(
      new Request(`https://test-project.supabase.co/mockup-generator?${qs}`),
    );
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.param, "template");
    assertStringIncludes(body.error, "flyer");
    assertStringIncludes(body.error, "carteVisite");
    assertStringIncludes(body.error, "kakemono");
  } finally {
    restoreEnv();
  }
});

Deno.test("mockup-generator GET template vide -> fallback flyer", async () => {
  setupEnv();
  installMockFetch(404);
  try {
    const qs = new URLSearchParams({
      tenant: "t-empty",
      shop: "s-empty",
      product: "p-empty",
      width: "148",
      height: "210",
      productName: "Flyer",
      primaryColor: "#FF6B35",
      template: "", // string vide doit etre traite comme absent
    }).toString();
    const res = await handleRequest(
      new Request(`https://test-project.supabase.co/mockup-generator?${qs}`),
    );
    // Pas 400 (template vide = absent = fallback flyer)
    assertEquals(res.status, 200);
  } finally {
    restoreEnv();
  }
});
