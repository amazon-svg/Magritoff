/**
 * Helpers purs pour ProductPimMarketingTab (Story S-FIX-1, correctif PIM
 * marketing/SEO/GEO sur ProductCard atelier).
 *
 * Surface :
 *  - buildPimJsonExport(enriched) -> string : serialise EnrichedProduct +
 *    Definition en JSON pretty 2-espaces. Filtre les valeurs vides pour
 *    cohérence côté pure player consumer (Shopify / Woo / API CMS).
 *  - hasUsefulPimContent(enriched) -> boolean : true si au moins un champ
 *    marketing non-vide. Utilise par le composant pour decider empty state.
 */

import type { EnrichedProduct } from "../utils/productEnrichment";

/**
 * True si le contenu PIM resolved a au moins un champ marketing non-vide.
 * Sert a distinguer "pas de gamme matchee" vs "gamme matchee mais templates
 * non remplis dans le PIM".
 */
export function hasUsefulPimContent(
  enriched: EnrichedProduct | null,
): boolean {
  if (!enriched) return false;
  const r = enriched.resolved;
  return Boolean(
    r.short_description ||
      r.description ||
      r.h1 ||
      r.seo_title ||
      r.seo_description ||
      (r.keywords && r.keywords.length > 0) ||
      (r.usage_examples && r.usage_examples.length > 0) ||
      (r.faq && r.faq.length > 0),
  );
}

/**
 * Serialise les donnees PIM en JSON pretty 2-espaces, filtrant les champs
 * vides pour minimiser le bruit cote consumer.
 *
 * Inclut :
 *  - resolved.* (9 champs marketing/SEO)
 *  - definition (metadata PIM : schema_org_type, quality_score, validated_by,
 *    locale, generated_by)
 *  - gamme.slug + gamme.name (contexte de matching)
 */
export function buildPimJsonExport(
  enriched: EnrichedProduct | null,
): string {
  if (!enriched) {
    return JSON.stringify({ error: "no PIM match for this product" }, null, 2);
  }
  const r = enriched.resolved;
  const def = enriched.definition;
  const g = enriched.gamme;

  const payload: Record<string, unknown> = {
    gamme: g
      ? {
          slug: g.slug,
          name: g.name,
        }
      : null,
    marketing: {},
    seo: {},
    structured_data: {},
    metadata: {},
  };

  // Marketing : commercial-facing
  const marketing = payload.marketing as Record<string, unknown>;
  if (r.title) marketing.title = r.title;
  if (r.short_description) marketing.short_description = r.short_description;
  if (r.description) marketing.description = r.description;
  if (r.usage_examples && r.usage_examples.length > 0) {
    marketing.usage_examples = r.usage_examples;
  }
  if (r.faq && r.faq.length > 0) marketing.faq = r.faq;

  // SEO : meta tags + H1
  const seo = payload.seo as Record<string, unknown>;
  if (r.h1) seo.h1 = r.h1;
  if (r.seo_title) seo.title = r.seo_title;
  if (r.seo_description) seo.description = r.seo_description;
  if (r.keywords && r.keywords.length > 0) seo.keywords = r.keywords;

  // Structured data (Schema.org pour Google/GEO)
  const structured = payload.structured_data as Record<string, unknown>;
  if (def?.schema_org_type) structured.type = def.schema_org_type;

  // Metadata : qualite, validation, locale, generation
  const meta = payload.metadata as Record<string, unknown>;
  if (def?.quality_score != null) meta.quality_score = def.quality_score;
  if (def?.validated_by) meta.validated_by = def.validated_by;
  if (def?.locale) meta.locale = def.locale;
  if (def?.generated_by) meta.generated_by = def.generated_by;

  // Filtre les sections vides pour cleaner l output
  for (const key of ["marketing", "seo", "structured_data", "metadata"]) {
    const section = payload[key] as Record<string, unknown>;
    if (Object.keys(section).length === 0) {
      delete payload[key];
    }
  }

  return JSON.stringify(payload, null, 2);
}
