/**
 * Edge function : pim-ingest
 * ──────────────────────────
 * Pipeline d'integration automatique des candidats PIM dans le catalogue
 * global Magrit. Appelee par l'admin PIM (bouton "Lancer l'ingestion").
 *
 * Entree : rien de specifique (body.dryRun: bool optionnel).
 * Sortie : rapport JSON detaillant les actions prises par candidat.
 *
 * Pipeline pour chaque candidat `status = 'pending'` :
 *
 *   1. Controle de richesse : le candidat a-t-il les infos minimales ?
 *      - kind (leaflet | folded | book | cover | section) OU derivable
 *      - quantity OU name exploitable
 *      - si rien de substantiel → status='rejected', review_notes
 *
 *   2. Deduplication contre product_definitions :
 *      - On genere un hash sur (gamme_slug + variation_filter canonicalisee)
 *      - Si un product_definition existant match → status='superseded',
 *        merged_into = <id existant>, et on increment order_count + maj
 *        last_ordered_at sur l'existant.
 *
 *   3. Enrichissement via Claude (si pas de match) :
 *      - On devine la gamme via les matching_rules PIM (kind, size_near,
 *        binding_in, folds, size_range)
 *      - On appelle Claude avec un prompt dedie → obtient title_template,
 *        description, SEO, FAQ, benefits, commercial_pitch, schema_org
 *      - On cree une nouvelle product_definition en 'pending' validation
 *        (quality_score null, validated_by='llm') + colonnes commerciales
 *        + technical_spec = raw_config source
 *      - status='merged', merged_into = <nouveau id>
 *
 *   4. Erreurs de pipeline (LLM crash, insert fail…) : status reste
 *      'pending', review_notes log l'erreur, continuent au candidat suivant.
 *
 * Mode dry-run (dryRun=true) : toutes les actions ci-dessus sont simulees,
 * rien n'est ecrit en DB. Rapport identique, avec un flag dryRun.
 */

import { corsHeaders } from "../_shared/cors.ts";
import { anthropicComplete, AnthropicClientError } from "../_shared/anthropicClient.ts";

// Supabase client est accessible via env auto-injectees (SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY pour bypass RLS sur pim_candidates / product_*).
import { createClient } from "npm:@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ANTHROPIC_API_KEY =
  Deno.env.get("ANTHROPIC_API_KEY") ||
  Deno.env.get("Magrit3") ||
  Deno.env.get("MAGRIT");

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

// ─── Types minimalistes ──────────────────────────────────────────────────

interface Candidate {
  id: string;
  source_tenant_id: string | null;
  source_user_id: string | null;
  source_quote_id: string | null;
  raw_config: Record<string, unknown>;
  suggested_kind: string | null;
  suggested_gamme: string | null;
  status: string;
}

interface Gamme {
  slug: string;
  name: string;
  parent_slug: string | null;
  matching_rules: Record<string, unknown>;
  display_order: number;
}

interface Definition {
  id: string;
  gamme_slug: string;
  variation_filter: Record<string, unknown>;
  locale: string;
  name: string | null;
  order_count: number | null;
}

interface IngestReport {
  dryRun: boolean;
  totalCandidates: number;
  matched: Array<{ candidateId: string; matchedTo: string; gamme: string }>;
  rejected: Array<{ candidateId: string; reason: string }>;
  enriched: Array<{ candidateId: string; definitionId: string; gamme: string }>;
  errors: Array<{ candidateId: string; error: string }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Normalise une raw_config en aplatissant les champs techniques. La config
 * Magrit stocke kind/width/height/papers/etc. sous `clariprintData`, mais
 * la UI-level config stocke certains champs au top-level (name, quantity,
 * format, material, weight, finish...). On merge intelligemment pour que
 * le reste du pipeline puisse chercher ses champs au meme niveau.
 *
 * Priorite en cas de collision : top-level > clariprintData (le top-level
 * est la version "resolue" avec les noms humains, clariprintData la version
 * brute API).
 *
 * Les champs techniques clefs (kind, width, height, papers, finishing_*,
 * binding, folds, pages) sont eux toujours pris depuis clariprintData en
 * priorite car c est la source de verite API.
 */
function normalizeRaw(
  raw: Record<string, unknown>
): Record<string, unknown> {
  const cp = (raw.clariprintData ?? raw.clariprint) as Record<string, unknown> | undefined;
  if (!cp || typeof cp !== "object") return raw;

  // On construit un objet qui fusionne les deux niveaux.
  const merged: Record<string, unknown> = { ...raw };

  // Champs API techniques : clariprintData prime.
  const TECHNICAL_KEYS = [
    "kind",
    "width",
    "height",
    "papers",
    "paper",
    "front_colors",
    "back_colors",
    "finishing_front",
    "finishing_back",
    "binding",
    "folds",
    "pages",
    "with_bleeds",
    "labels",
    "reference",
  ];
  for (const k of TECHNICAL_KEYS) {
    if (cp[k] !== undefined) merged[k] = cp[k];
  }
  // Quantity : prend celui du clariprintData si present, sinon le top-level.
  if (cp.quantity !== undefined) merged.quantity = cp.quantity;

  return merged;
}

/**
 * Retourne true si le candidat a assez de contenu pour etre ingere.
 * Critere tres basique : un `name` non vide OU un `kind` ET une dimension.
 */
function isRichEnough(raw: Record<string, unknown>): { ok: boolean; reason?: string } {
  const n = normalizeRaw(raw);
  const name = (n.name as string | undefined)?.trim();
  const kind = (n.kind as string | undefined)?.trim();
  const width = n.width;
  const height = n.height;

  if (kind && (width != null || height != null)) return { ok: true };
  if (kind && (n.quantity != null)) return { ok: true };
  if (name && name.length > 2 && kind) return { ok: true };

  return {
    ok: false,
    reason: "Candidat trop pauvre — manque kind+(dimensions OU quantity)",
  };
}

/**
 * Trouve la gamme qui matche une config Clariprint brute, en appliquant
 * les `matching_rules` de chaque gamme dans l'ordre d'affichage.
 * Logique calquee sur utils/productEnrichment.ts cote frontend.
 */
function resolveGamme(raw: Record<string, unknown>, gammes: Gamme[]): Gamme | null {
  const n = normalizeRaw(raw);
  const kind = (n.kind as string | undefined)?.trim().toLowerCase();
  const w = Number(n.width);
  const h = Number(n.height);
  const maxDim = Math.max(w || 0, h || 0);

  // On sort par display_order desc pour preferer les gammes les plus specifiques
  // (les sous-gammes comme "carte_visite_standard" passent avant "carterie").
  const sorted = [...gammes].sort(
    (a, b) => (b.display_order ?? 0) - (a.display_order ?? 0)
  );

  for (const g of sorted) {
    const rules = g.matching_rules ?? {};

    // kind : string ou array
    const rk = (rules as any).kind;
    if (rk != null) {
      const match = Array.isArray(rk) ? rk.includes(kind) : rk === kind;
      if (!match) continue;
    }

    // size_near : { width, height, tol }
    const sn = (rules as any).size_near;
    if (sn && !isNaN(w) && !isNaN(h)) {
      const tol = sn.tol ?? 5;
      const matchDirect = Math.abs(w - sn.width) <= tol && Math.abs(h - sn.height) <= tol;
      const matchSwap = Math.abs(h - sn.width) <= tol && Math.abs(w - sn.height) <= tol;
      if (!matchDirect && !matchSwap) continue;
    }

    // size_range : { min_dim, max_dim } sur max(w,h)
    const sr = (rules as any).size_range;
    if (sr && maxDim > 0) {
      if (sr.min_dim != null && maxDim < sr.min_dim) continue;
      if (sr.max_dim != null && maxDim > sr.max_dim) continue;
    }

    // binding_in : pour kind=book
    const bi = (rules as any).binding_in;
    if (bi && Array.isArray(bi)) {
      const binding = (n.binding as string | undefined);
      if (!binding || !bi.includes(binding)) continue;
    }

    // folds : pour kind=folded
    const folds = (rules as any).folds;
    if (folds != null) {
      const rf = (n.folds as string | undefined);
      if (rf !== folds) continue;
    }

    return g;
  }

  return null;
}

/**
 * Canonicalise une config pour generer une signature de deduplication.
 * On garde les champs qui impactent la fiche produit (kind, format,
 * paper, finishing, binding, pages). Meme signature → meme product_definition.
 */
function canonicalKey(raw: Record<string, unknown>): string {
  const n = normalizeRaw(raw);
  const paper = n.papers as any;
  const paperKey = paper?.custom
    ? `${paper.custom.quality ?? ''}|${paper.custom.weight ?? ''}`
    : (typeof paper === 'string' ? paper : '');

  const parts = [
    String(n.kind ?? '').toLowerCase(),
    String(n.width ?? ''),
    String(n.height ?? ''),
    paperKey,
    String(n.finishing_front ?? ''),
    String(n.finishing_back ?? ''),
    String(n.binding ?? ''),
    String(n.folds ?? ''),
    String(n.pages ?? ''),
  ];
  return parts.join('|').toLowerCase();
}

/**
 * Cherche une product_definition existante qui matche cette config.
 * On matche sur (gamme_slug + signature canonicalKey stockee dans
 * variation_filter.signature si presente, sinon sur les champs techniques).
 */
function findMatchingDefinition(
  gamme: Gamme,
  raw: Record<string, unknown>,
  definitions: Definition[]
): Definition | null {
  const sig = canonicalKey(raw);
  const candidates = definitions.filter((d) => d.gamme_slug === gamme.slug);

  for (const d of candidates) {
    const vf = d.variation_filter ?? {};
    if ((vf as any).signature === sig) return d;
  }

  // Fallback : si aucune definition n'a encore de signature (ancien PIM),
  // on ne match pas pour forcer la creation d'une nouvelle entry avec
  // signature. On ne veut pas que le pipeline ecrase silencieusement des
  // definitions manuelles.
  return null;
}

// ─── Appel Claude pour l'enrichissement ──────────────────────────────────

const ENRICH_SYSTEM = `Tu es un expert SEO et redacteur e-commerce specialise dans le web-to-print et l'imprimerie francaise. Tu produis des fiches produit riches pour un PIM.

Tu DOIS retourner UNIQUEMENT un objet JSON valide (pas de texte avant/apres, pas de markdown) au format EXACT :

{
  "name": "Nom interne court et descriptif",
  "title_template": "Titre commercial <= 60 caracteres avec placeholders {{format}} {{grammage}} {{quantite}} etc",
  "short_description_template": "Resume 150 caracteres max",
  "description_template": "Description 2-3 paragraphes en markdown, integrant placeholders",
  "h1_template": "H1 SEO avec placeholders",
  "seo_title": "Meta title <= 60 caracteres",
  "seo_description": "Meta description 140-160 caracteres",
  "seo_keywords": ["mot-cle 1", "mot-cle 2", "mot-cle 3", "mot-cle 4", "mot-cle 5"],
  "commercial_pitch": "2 phrases commerciales percutantes",
  "benefits": ["benefice 1", "benefice 2", "benefice 3"],
  "use_cases": [
    {"title": "Usage 1", "description": "Description concrete"},
    {"title": "Usage 2", "description": "..."}
  ],
  "faq": [
    {"question": "Question 1 ?", "answer": "Reponse"},
    {"question": "Question 2 ?", "answer": "Reponse"},
    {"question": "Question 3 ?", "answer": "Reponse"}
  ]
}

Placeholders disponibles : {{format}} {{grammage}} {{papier}} {{quantite}} {{finition}} {{finition_recto}} {{finition_verso}} {{impression_recto}} {{impression_verso}} {{pages}} {{binding}}

Regles qualite :
- Francais naturel et professionnel
- Vocabulaire imprimerie precis (CMJN, pelliculage mat/brillant/soft-touch, dos carre colle, grammage, FSC/PEFC)
- SEO : title <= 60 caracteres, meta 140-160
- Pas de placeholders non resolus dans seo_title, seo_description, commercial_pitch (seulement dans les *_template)`;

async function enrichWithClaude(
  gamme: Gamme,
  raw: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  // Refactor S1.3 (2026-05-09) : utilise le wrapper AnthropicClient unifie.

  const userPrompt = `Genere une fiche PIM pour ce produit imprimerie :

Gamme : ${gamme.name} (slug: ${gamme.slug})
Config Clariprint brute :
${JSON.stringify(raw, null, 2)}

Retourne le JSON strict decrit dans le system prompt.`;

  try {
    const result = await anthropicComplete({
      model: CLAUDE_MODEL,
      prompt: userPrompt,
      system: ENRICH_SYSTEM,
      maxTokens: 2000,
      endpoint: "pim-ingest",
      metadata: { gamme_slug: gamme.slug, raw_kind: (raw as any)?.kind },
    });

    // Extract JSON (Claude peut parfois wrapper)
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[enrichWithClaude] no JSON in response:", result.text.slice(0, 200));
      return null;
    }
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    if (err instanceof AnthropicClientError) {
      console.error("[enrichWithClaude] AnthropicClient", err.kind, err.message);
      return null;
    }
    console.error("[enrichWithClaude] error:", (err as Error).message);
    return null;
  }
}

// ─── Pipeline principal ──────────────────────────────────────────────────

async function runIngestion(dryRun: boolean): Promise<IngestReport> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const report: IngestReport = {
    dryRun,
    totalCandidates: 0,
    matched: [],
    rejected: [],
    enriched: [],
    errors: [],
  };

  // 1. Fetch tous les pending
  const { data: candidates, error: candErr } = await supabase
    .from("pim_candidates")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (candErr) {
    throw new Error(`Fetch candidates failed: ${candErr.message}`);
  }
  report.totalCandidates = candidates?.length ?? 0;
  if (!candidates || candidates.length === 0) return report;

  // 2. Load catalogue PIM (gammes + definitions) une fois pour tout le batch
  const [{ data: gammesData }, { data: defsData }] = await Promise.all([
    supabase.from("product_gammes").select("*"),
    supabase.from("product_definitions").select("id, gamme_slug, variation_filter, locale, name, order_count"),
  ]);
  const gammes: Gamme[] = (gammesData ?? []) as Gamme[];
  const definitions: Definition[] = (defsData ?? []) as Definition[];

  // 3. Pour chaque candidat, applique le pipeline
  for (const c of candidates as Candidate[]) {
    try {
      // 3.a Richesse
      const rich = isRichEnough(c.raw_config);
      if (!rich.ok) {
        report.rejected.push({ candidateId: c.id, reason: rich.reason! });
        if (!dryRun) {
          await supabase
            .from("pim_candidates")
            .update({
              status: "rejected",
              review_notes: rich.reason,
              reviewed_at: new Date().toISOString(),
            })
            .eq("id", c.id);
        }
        continue;
      }

      // 3.b Gamme matching
      const gamme = resolveGamme(c.raw_config, gammes);
      if (!gamme) {
        report.rejected.push({
          candidateId: c.id,
          reason: "Aucune gamme PIM ne matche cette config (kind/size/binding inconnu)",
        });
        if (!dryRun) {
          await supabase
            .from("pim_candidates")
            .update({
              status: "rejected",
              review_notes: "Aucune gamme matchee",
              reviewed_at: new Date().toISOString(),
            })
            .eq("id", c.id);
        }
        continue;
      }

      // 3.c Dedup
      const match = findMatchingDefinition(gamme, c.raw_config, definitions);
      if (match) {
        report.matched.push({
          candidateId: c.id,
          matchedTo: match.id,
          gamme: gamme.slug,
        });
        if (!dryRun) {
          await supabase.rpc("increment_definition_order", {
            p_definition_id: match.id,
          }).catch(async () => {
            // Fallback si RPC pas encore deployee : update direct
            const newCount = (match.order_count ?? 0) + 1;
            await supabase
              .from("product_definitions")
              .update({
                order_count: newCount,
                last_ordered_at: new Date().toISOString(),
              })
              .eq("id", match.id);
          });
          await supabase
            .from("pim_candidates")
            .update({
              status: "superseded",
              merged_into: match.id,
              reviewed_at: new Date().toISOString(),
            })
            .eq("id", c.id);
        }
        continue;
      }

      // 3.d Enrichissement Claude
      const enriched = await enrichWithClaude(gamme, c.raw_config);
      if (!enriched) {
        report.errors.push({
          candidateId: c.id,
          error: "Enrichissement Claude echoue (API key ?)",
        });
        continue;
      }

      // 3.e Insert product_definition
      const signature = canonicalKey(c.raw_config);
      const variationFilter = {
        signature,
        kind: c.raw_config.kind,
        width: c.raw_config.width,
        height: c.raw_config.height,
      };

      if (dryRun) {
        report.enriched.push({
          candidateId: c.id,
          definitionId: "(dry-run)",
          gamme: gamme.slug,
        });
        continue;
      }

      const { data: inserted, error: insErr } = await supabase
        .from("product_definitions")
        .insert({
          gamme_slug: gamme.slug,
          variation_filter: variationFilter,
          locale: "fr",
          name: enriched.name ?? null,
          keywords: enriched.seo_keywords ?? null,
          title_template: enriched.title_template ?? null,
          short_description_template: enriched.short_description_template ?? null,
          description_template: enriched.description_template ?? null,
          h1_template: enriched.h1_template ?? null,
          seo_title: enriched.seo_title ?? null,
          seo_description: enriched.seo_description ?? null,
          seo_keywords: enriched.seo_keywords ?? null,
          schema_org_type: "Product",
          usage_examples: enriched.use_cases ?? [],
          faq: enriched.faq ?? [],
          commercial_pitch: enriched.commercial_pitch ?? null,
          benefits: enriched.benefits ?? null,
          use_cases: enriched.use_cases ?? null,
          technical_spec: c.raw_config,
          quality_score: null,
          generated_by: "llm",
          validated_by: "pending",
          order_count: 1,
          last_ordered_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insErr || !inserted) {
        report.errors.push({
          candidateId: c.id,
          error: `Insert definition failed: ${insErr?.message ?? 'unknown'}`,
        });
        continue;
      }

      report.enriched.push({
        candidateId: c.id,
        definitionId: inserted.id,
        gamme: gamme.slug,
      });

      await supabase
        .from("pim_candidates")
        .update({
          status: "merged",
          merged_into: inserted.id,
          llm_enrichment: enriched,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", c.id);
    } catch (err) {
      report.errors.push({
        candidateId: c.id,
        error: (err as Error).message,
      });
    }
  }

  return report;
}

// ─── Handler HTTP ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = Boolean(body.dryRun);

    const report = await runIngestion(dryRun);

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
