// Edge function Supabase : génère une product_definition riche via Claude.
// Appelée depuis l'admin PIM, reçoit un gamme_slug + locale + variation_filter
// optionnels, renvoie la définition JSON (title, description, SEO, FAQ…)
//
// Story S1.3 (Epic 1, 2026-05-09) : refactor pour utiliser le wrapper unique
// _shared/anthropicClient (S1.1). Suppression de la duplication fetch/parse,
// activation automatique de la limite 25 paramètres anti-hallucination,
// tracking llm_usage_events systématique.

import { corsHeaders } from "../_shared/cors.ts";
import { anthropicComplete, AnthropicClientError } from "../_shared/anthropicClient.ts";

interface RequestBody {
  gamme_slug: string;
  gamme_name?: string;
  gamme_matching_rules?: Record<string, unknown>;
  locale: string;
  variation_filter?: Record<string, unknown>;
  mode?: "generate" | "validate";
  existing?: Record<string, unknown>;
}

const MODELS = "claude-haiku-4-5-20251001";

function buildGeneratePrompt(body: RequestBody): string {
  const { gamme_slug, gamme_name, gamme_matching_rules, locale, variation_filter } = body;
  const localeName = locale === "fr" ? "français" : locale === "en" ? "anglais" : locale;

  return `Tu es un expert SEO et rédacteur e-commerce spécialisé dans le web-to-print et l'imprimerie (FSC, PEFC, quadrichromie, pelliculage, dos carré collé, etc.). Tu produis des fiches produit prêtes à alimenter un CMS e-commerce ET à être indexées par les moteurs de recherche + les IA génératives (SEO/GEO).

CONTEXTE
- Gamme : ${gamme_name ?? gamme_slug} (slug: ${gamme_slug})
- Langue : ${localeName} (${locale})
- Règles de matching Clariprint : ${JSON.stringify(gamme_matching_rules ?? {})}
- Filtre de variation (si présent, à intégrer naturellement dans le contenu) : ${JSON.stringify(variation_filter ?? {})}

TU DOIS retourner UNIQUEMENT un objet JSON valide (pas de texte avant/après, pas de markdown) au format EXACT :

{
  "name": "Nom interne de la définition (court)",
  "keywords": ["mot-clé 1", "mot-clé 2", ...],
  "title_template": "Titre commercial avec placeholders {{format}}, {{grammage}}, {{papier}}, {{finition}}, {{quantite}}",
  "short_description_template": "Résumé ~150 caractères avec 1-2 placeholders max",
  "description_template": "Description riche en markdown, 2-4 paragraphes, intégrant les placeholders pertinents et valorisant les aspects techniques comme commerciaux",
  "h1_template": "H1 optimisé SEO avec placeholders",
  "seo_title": "Meta title < 60 caractères",
  "seo_description": "Meta description 140-160 caractères",
  "usage_examples": [
    {"title": "Usage 1", "description": "Description concrète d'un cas d'utilisation"},
    {"title": "Usage 2", "description": "..."},
    {"title": "Usage 3", "description": "..."}
  ],
  "faq": [
    {"question": "Question fréquente 1 ?", "answer": "Réponse concise et factuelle"},
    {"question": "Question fréquente 2 ?", "answer": "..."},
    {"question": "Question fréquente 3 ?", "answer": "..."},
    {"question": "Question fréquente 4 ?", "answer": "..."}
  ]
}

PLACEHOLDERS DISPONIBLES (utilise-les dans les *_template) :
{{format}} {{grammage}} {{papier}} {{quantite}} {{finition}} {{finition_recto}} {{finition_verso}} {{impression_recto}} {{impression_verso}} {{pages}} {{binding}}

RÈGLES QUALITÉ
- Français/anglais naturel et professionnel, pas de jargon inutile.
- Vocabulaire imprimerie précis : quadrichromie (CMJN), pelliculage mat/brillant/soft-touch, dos carré collé, papier couché/offset, grammage en g/m², labels écologiques FSC/PEFC.
- SEO : titre et meta optimisés autour de la gamme et ses usages, densité de mots-clés naturelle.
- FAQ : questions concrètes d'acheteur B2B (délais, formats, papiers, finitions, quantités minimums).
- Respecter la variation_filter : si elle précise une finition, un papier ou un label, l'intégrer au narratif.`;
}

function buildValidatePrompt(body: RequestBody): string {
  return `Tu es un relecteur éditorial et SEO. Analyse la fiche produit JSON ci-dessous et retourne UNIQUEMENT un objet JSON :

{
  "quality_score": 0.0 à 1.0 (précision décimale),
  "issues": ["liste des problèmes trouvés"],
  "improved": { /* version améliorée avec mêmes clés que l'existant */ }
}

Critères : cohérence avec les règles Clariprint, longueur SEO (title < 60, meta 140-160), naturalité du français, absence de placeholders non résolus dans le contenu final (mais les garder dans les *_template), FAQ pertinente, pas de duplication.

Fiche à évaluer :
${JSON.stringify(body.existing ?? {}, null, 2)}

Contexte gamme : ${body.gamme_name ?? body.gamme_slug} (${body.locale})`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;
    if (!body.gamme_slug || !body.locale) {
      return new Response(
        JSON.stringify({ error: "gamme_slug and locale required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mode = body.mode ?? "generate";
    const prompt = mode === "validate" ? buildValidatePrompt(body) : buildGeneratePrompt(body);

    let result;
    try {
      result = await anthropicComplete({
        model: MODELS,
        prompt,
        endpoint: "pim-generate",
        // userId / tenantId : non-disponibles ici sans auth context, restent undefined
        metadata: { mode, gamme_slug: body.gamme_slug, locale: body.locale },
      });
    } catch (err) {
      if (err instanceof AnthropicClientError) {
        const status = err.kind === "missing_api_key" ? 500 :
                       err.kind === "param_limit_exceeded" ? 400 :
                       err.kind === "api_error" ? 502 : 500;
        console.error("[pim-generate] AnthropicClient", err.kind, err.message);
        return new Response(
          JSON.stringify({ error: err.message, kind: err.kind, details: err.details }),
          { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    }

    // Nettoyer fences markdown éventuels (le wrapper le fait deja dans
    // completeStructured, mais ici on n'a pas de schema Zod, parse manuel)
    const cleaned = result.text
      .replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.error("JSON parse failed", err, cleaned);
      return new Response(
        JSON.stringify({ error: "LLM returned invalid JSON", raw: cleaned }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, mode, generated: parsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("pim-generate error", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
