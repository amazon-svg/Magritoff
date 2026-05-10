/**
 * Tests Deno pour le pipeline mockup renderer (Story S4.1b, Epic 4).
 *
 * Lancer :
 *   deno test --allow-net --allow-read --allow-write supabase/functions/_shared/mockup/renderer.test.ts
 *
 * Permissions necessaires :
 *   --allow-net  : resvg_wasm telecharge le WASM au premier appel
 *   --allow-read : lecture du fichier snapshot SVG (T4.6)
 *   --allow-write: ecriture initiale du snapshot si absent
 *
 * 5 cas couverts :
 *   1. happy path flyer -> magic number PNG OK
 *   2. dimensions PNG IHDR -> 1024x1024
 *   3. template inconnu -> MockupRendererError(unsupported_template)
 *   4. specs invalides -> MockupRendererError(invalid_specs)
 *   5. snapshot SVG verrouillage du rendu de reference
 */

import {
  assertEquals,
  assertRejects,
  assert,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  renderSvgToPng,
  SUPPORTED_TEMPLATES,
  isMockupTemplate,
} from "./renderer.ts";
import { flyerSvg } from "./templates/flyer.ts";
import { carteVisiteSvg } from "./templates/carteVisite.ts";
import { brochureSvg } from "./templates/brochure.ts";
import { etiquetteSvg } from "./templates/etiquette.ts";
import { kakemonoSvg } from "./templates/kakemono.ts";
import { MockupRendererError, type MockupTemplate } from "./types.ts";

const SNAPSHOT_PATH = new URL("./templates/flyer.snapshot.svg", import.meta.url);

const SAMPLE_SPECS = {
  width: 148,
  height: 210,
  productName: "Flyer A5",
};
const SAMPLE_THEMING = { primaryColor: "#FF6B35" };

Deno.test("renderSvgToPng flyer happy path -> bytes PNG avec magic number", async () => {
  const png = await renderSvgToPng("flyer", SAMPLE_SPECS, SAMPLE_THEMING);
  assert(png instanceof Uint8Array, "result doit etre Uint8Array");
  assert(png.length > 100, `bytes trop courts : ${png.length}`);
  // Magic PNG : 89 50 4E 47 0D 0A 1A 0A
  assertEquals(png[0], 0x89);
  assertEquals(png[1], 0x50);
  assertEquals(png[2], 0x4e);
  assertEquals(png[3], 0x47);
  assertEquals(png[4], 0x0d);
  assertEquals(png[5], 0x0a);
  assertEquals(png[6], 0x1a);
  assertEquals(png[7], 0x0a);
});

Deno.test("renderSvgToPng PNG IHDR dimensions = 1024x1024", async () => {
  const png = await renderSvgToPng("flyer", SAMPLE_SPECS, SAMPLE_THEMING);
  // IHDR chunk commence a l'offset 8 (apres magic) avec 4 bytes length + "IHDR" + width(4) + height(4)
  // Offset 16 = debut du IHDR data : width sur 4 bytes big-endian
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const width = view.getUint32(16, false); // big-endian
  const height = view.getUint32(20, false);
  assertEquals(width, 1024, `width attendu 1024, recu ${width}`);
  assertEquals(height, 1024, `height attendu 1024, recu ${height}`);
});

Deno.test("renderSvgToPng template inconnu -> MockupRendererError(unsupported_template)", async () => {
  const err = (await assertRejects(
    () =>
      renderSvgToPng(
        "not_a_template" as unknown as "flyer",
        SAMPLE_SPECS,
        SAMPLE_THEMING,
      ),
    MockupRendererError,
  )) as MockupRendererError;
  assertEquals(err.kind, "unsupported_template");
});

Deno.test("renderSvgToPng specs invalides -> MockupRendererError(invalid_specs)", async () => {
  // width negatif
  const err1 = (await assertRejects(
    () =>
      renderSvgToPng(
        "flyer",
        { width: -1, height: 210, productName: "Flyer" },
        SAMPLE_THEMING,
      ),
    MockupRendererError,
  )) as MockupRendererError;
  assertEquals(err1.kind, "invalid_specs");

  // productName vide
  const err2 = (await assertRejects(
    () =>
      renderSvgToPng(
        "flyer",
        { width: 148, height: 210, productName: "" },
        SAMPLE_THEMING,
      ),
    MockupRendererError,
  )) as MockupRendererError;
  assertEquals(err2.kind, "invalid_specs");

  // theming primaryColor absent
  const err3 = (await assertRejects(
    () =>
      renderSvgToPng(
        "flyer",
        SAMPLE_SPECS,
        {} as { primaryColor: string },
      ),
    MockupRendererError,
  )) as MockupRendererError;
  assertEquals(err3.kind, "invalid_specs");
});

Deno.test("flyerSvg snapshot string SVG (verrouille le rendu de reference)", async () => {
  // Specs deterministes (pas de Date.now ni de random) pour snapshot stable
  const svg = flyerSvg(
    { width: 148, height: 210, productName: "Flyer A5 Test" },
    { primaryColor: "#FF6B35" },
  );
  assert(svg.startsWith("<svg"), "doit commencer par <svg");
  assert(svg.endsWith("</svg>"), "doit finir par </svg>");
  assert(svg.includes("Flyer A5 Test"), "doit contenir le productName");
  assert(svg.includes("#FF6B35"), "doit contenir la primaryColor");

  // Snapshot file-based : si absent, le creer ; si present, comparer.
  let snapshot: string | null = null;
  try {
    snapshot = await Deno.readTextFile(SNAPSHOT_PATH);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      // Premier run : creer le snapshot
      await Deno.writeTextFile(SNAPSHOT_PATH, svg);
      console.log(`[snapshot] cree initialement : ${SNAPSHOT_PATH.pathname}`);
      return;
    }
    throw err;
  }
  if (snapshot.trim() !== svg.trim()) {
    throw new Error(
      `flyerSvg differe du snapshot. Si volontaire, supprime ${SNAPSHOT_PATH.pathname} et relance pour regenerer.\n\nDiff (premier 200 chars) :\nattendu: ${snapshot.slice(0, 200)}\nrecu  : ${svg.slice(0, 200)}`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// S4.2 — 4 nouveaux templates MVP : carteVisite / brochure / etiquette / kakemono
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper factorise pour tester un snapshot SVG (cree au 1er run, compare ensuite).
 */
async function checkSnapshot(snapshotName: string, svg: string) {
  const snapshotPath = new URL(`./templates/${snapshotName}`, import.meta.url);
  let snapshot: string | null = null;
  try {
    snapshot = await Deno.readTextFile(snapshotPath);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      await Deno.writeTextFile(snapshotPath, svg);
      console.log(`[snapshot] cree initialement : ${snapshotPath.pathname}`);
      return;
    }
    throw err;
  }
  if (snapshot.trim() !== svg.trim()) {
    throw new Error(
      `${snapshotName} differe du snapshot. Si volontaire, supprime ${snapshotPath.pathname} et relance pour regenerer.\n\nDiff (premier 200 chars) :\nattendu: ${snapshot.slice(0, 200)}\nrecu  : ${svg.slice(0, 200)}`,
    );
  }
}

const BUSINESS_CARD_SPECS = { width: 85, height: 55, productName: "Carte Pro" };
const BROCHURE_SPECS = { width: 210, height: 297, productName: "Brochure A4" };
const ETIQUETTE_SPECS = { width: 60, height: 40, productName: "Etiquette" };
const KAKEMONO_SPECS = { width: 850, height: 2000, productName: "Roll-up Magrit" };

// ─── carteVisite ─────────────────────────────────────────────────────────────

Deno.test("renderSvgToPng carteVisite happy path -> bytes PNG 1024x1024", async () => {
  const png = await renderSvgToPng("carteVisite", BUSINESS_CARD_SPECS, SAMPLE_THEMING);
  assert(png instanceof Uint8Array);
  assert(png.length > 100);
  assertEquals(png[0], 0x89);
  assertEquals(png[1], 0x50);
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  assertEquals(view.getUint32(16, false), 1024);
  assertEquals(view.getUint32(20, false), 1024);
});

Deno.test("carteVisiteSvg snapshot string SVG", async () => {
  const svg = carteVisiteSvg(BUSINESS_CARD_SPECS, { primaryColor: "#FF6B35" });
  assert(svg.startsWith("<svg"), "doit commencer par <svg");
  assert(svg.endsWith("</svg>"), "doit finir par </svg>");
  assert(svg.includes("Carte Pro"), "doit contenir le productName");
  assert(svg.includes("#FF6B35"), "doit contenir la primaryColor");
  await checkSnapshot("carteVisite.snapshot.svg", svg);
});

// ─── brochure ────────────────────────────────────────────────────────────────

Deno.test("renderSvgToPng brochure happy path -> bytes PNG 1024x1024", async () => {
  const png = await renderSvgToPng("brochure", BROCHURE_SPECS, SAMPLE_THEMING);
  assert(png instanceof Uint8Array);
  assert(png.length > 100);
  assertEquals(png[0], 0x89);
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  assertEquals(view.getUint32(16, false), 1024);
  assertEquals(view.getUint32(20, false), 1024);
});

Deno.test("brochureSvg snapshot string SVG", async () => {
  const svg = brochureSvg(BROCHURE_SPECS, { primaryColor: "#FF6B35" });
  assert(svg.startsWith("<svg"));
  assert(svg.endsWith("</svg>"));
  assert(svg.includes("Brochure A4"));
  assert(svg.includes("#FF6B35"));
  await checkSnapshot("brochure.snapshot.svg", svg);
});

// ─── etiquette ───────────────────────────────────────────────────────────────

Deno.test("renderSvgToPng etiquette happy path -> bytes PNG 1024x1024", async () => {
  const png = await renderSvgToPng("etiquette", ETIQUETTE_SPECS, SAMPLE_THEMING);
  assert(png instanceof Uint8Array);
  assert(png.length > 100);
  assertEquals(png[0], 0x89);
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  assertEquals(view.getUint32(16, false), 1024);
  assertEquals(view.getUint32(20, false), 1024);
});

Deno.test("etiquetteSvg snapshot string SVG", async () => {
  const svg = etiquetteSvg(ETIQUETTE_SPECS, { primaryColor: "#FF6B35" });
  assert(svg.startsWith("<svg"));
  assert(svg.endsWith("</svg>"));
  assert(svg.includes("Etiquette"));
  assert(svg.includes("#FF6B35"));
  await checkSnapshot("etiquette.snapshot.svg", svg);
});

// ─── kakemono ────────────────────────────────────────────────────────────────

Deno.test("renderSvgToPng kakemono happy path -> bytes PNG 1024x1024", async () => {
  const png = await renderSvgToPng("kakemono", KAKEMONO_SPECS, SAMPLE_THEMING);
  assert(png instanceof Uint8Array);
  assert(png.length > 100);
  assertEquals(png[0], 0x89);
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  assertEquals(view.getUint32(16, false), 1024);
  assertEquals(view.getUint32(20, false), 1024);
});

Deno.test("kakemonoSvg snapshot string SVG", async () => {
  const svg = kakemonoSvg(KAKEMONO_SPECS, { primaryColor: "#FF6B35" });
  assert(svg.startsWith("<svg"));
  assert(svg.endsWith("</svg>"));
  assert(svg.includes("Roll-up Magrit"));
  assert(svg.includes("#FF6B35"));
  await checkSnapshot("kakemono.snapshot.svg", svg);
});

// ─── Sentinelle SUPPORTED_TEMPLATES ──────────────────────────────────────────

Deno.test("SUPPORTED_TEMPLATES expose exactement les 5 templates MVP S4.2", () => {
  assertEquals(SUPPORTED_TEMPLATES.length, 5);
  const expected: MockupTemplate[] = [
    "flyer",
    "carteVisite",
    "brochure",
    "etiquette",
    "kakemono",
  ];
  for (const t of expected) {
    assert(
      SUPPORTED_TEMPLATES.includes(t),
      `SUPPORTED_TEMPLATES doit inclure "${t}"`,
    );
  }
});

Deno.test("isMockupTemplate type guard valide les 5 templates et rejette le reste", () => {
  for (const t of SUPPORTED_TEMPLATES) {
    assert(isMockupTemplate(t), `isMockupTemplate doit accepter "${t}"`);
  }
  assert(!isMockupTemplate("tshirt"), "isMockupTemplate doit rejeter tshirt");
  assert(!isMockupTemplate(""), "isMockupTemplate doit rejeter string vide");
  assert(!isMockupTemplate("FLYER"), "isMockupTemplate est case-sensitive");
});

Deno.test("renderSvgToPng template inconnu -> message d'erreur liste les 5 templates", async () => {
  const err = (await assertRejects(
    () =>
      renderSvgToPng(
        "tshirt" as unknown as MockupTemplate,
        SAMPLE_SPECS,
        SAMPLE_THEMING,
      ),
    MockupRendererError,
  )) as MockupRendererError;
  assertEquals(err.kind, "unsupported_template");
  // Le message doit lister les 5 templates supportes (verifie la regression
  // si on oublie d'en ajouter un dans SUPPORTED_TEMPLATES).
  for (const t of SUPPORTED_TEMPLATES) {
    assertStringIncludes(err.message, t);
  }
});
