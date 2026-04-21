// Edge function Supabase : génère une product_definition riche via Claude.
// Appelée depuis l'admin PIM, reçoit un gamme_slug + locale + variation_filter
// optionnels, renvoie la définition JSON (title, description, SEO, FAQ…)

import { corsHeaders } from "../_shared/cors.ts";

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

    const anthropicApiKey =
      Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("MAGRIT") || Deno.env.get("Magrit3");
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: "Anthropic API key not configured (ANTHROPIC_API_KEY / MAGRIT)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mode = body.mode ?? "generate";
    const prompt = mode === "validate" ? buildValidatePrompt(body) : buildGeneratePrompt(body);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELS,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Claude error", response.status, text);
      return new Response(
        JSON.stringify({ error: `Claude ${response.status}`, details: text }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const text: string = data?.content?.[0]?.text ?? "";

    // Nettoyer fences markdown éventuels
    const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();

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
