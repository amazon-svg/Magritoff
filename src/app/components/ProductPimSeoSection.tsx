/**
 * ProductPimSeoSection — sous-section de l'onglet Fiche dans ProductCard atelier.
 *
 * Story S-FIX-1 (corrigee 2026-05-10 apres faute scope) : enrichit l'onglet
 * Fiche existant avec les champs PIM SEO/GEO manquants (la section "Contenu
 * enrichi PIM" existante ligne ~695 affiche deja short_description /
 * description / usage_examples / faq via enriched.resolved.*).
 *
 * Ajoute :
 *  - h1 SEO
 *  - seo_title + seo_description (meta tags)
 *  - keywords (chips)
 *  - schema_org_type + quality_score + validated_by (badges)
 *  - bouton Copier JSON pour pure players W2P
 *
 * Pas de wrapper card propre (s'imbrique dans l'onglet Fiche existant).
 * Render conditionnel : si aucune des donnees SEO n'est presente, le composant
 * ne rend rien (pas de bruit visuel).
 */

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import type { EnrichedProduct } from "../utils/productEnrichment";
import { TEST_IDS } from "../lib/testIds";
import { buildPimJsonExport } from "./ProductPimMarketingTab.helpers";

interface Props {
  enriched: EnrichedProduct | null;
}

export function ProductPimSeoSection({ enriched }: Props) {
  const [copied, setCopied] = useState(false);

  if (!enriched) return null;

  const { resolved, definition } = enriched;
  const hasH1 = Boolean(resolved.h1);
  const hasSeoMeta = Boolean(resolved.seo_title || resolved.seo_description);
  const hasKeywords = Array.isArray(resolved.keywords) && resolved.keywords.length > 0;
  const hasMeta = Boolean(
    definition?.schema_org_type ||
      definition?.quality_score != null ||
      definition?.validated_by,
  );

  // Si aucun champ SEO/meta dispo, ne rend rien (le contenu enrichi PIM existant
  // dans Fiche couvre deja short_description / description / usage_examples / faq).
  if (!hasH1 && !hasSeoMeta && !hasKeywords && !hasMeta) return null;

  const handleCopy = async () => {
    try {
      const json = buildPimJsonExport(enriched);
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_err) {
      // clipboard refuse (insecure context, permission) — silencieux
    }
  };

  return (
    <div
      data-testid={TEST_IDS.shop.ficheSeoSection}
      className="mt-5 pt-4 border-t border-line space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold uppercase tracking-wider text-brand">
          SEO &amp; GEO
        </span>
        <button
          type="button"
          data-testid={TEST_IDS.shop.ficheCopyJsonBtn}
          onClick={handleCopy}
          aria-label="Copier les donnees PIM au format JSON"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors ${
            copied
              ? "bg-ok-bg text-ok-fg border border-ok-line"
              : "bg-paper text-ink-2 border border-line hover:bg-bg hover:text-ink"
          }`}
        >
          {copied ? (
            <Check className="w-3.5 h-3.5" strokeWidth={1.5} />
          ) : (
            <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
          )}
          {copied ? "Copié" : "Copier JSON"}
        </button>
      </div>

      {/* Badges meta : Schema.org type + quality_score + validated_by */}
      {hasMeta && (
        <div className="flex flex-wrap items-center gap-2">
          {definition?.schema_org_type && (
            <span
              className="font-mono uppercase px-2 py-0.5 border border-line rounded text-ink-mute-2 bg-paper"
              style={{ fontSize: "10px", letterSpacing: "0.06em" }}
            >
              Schema.org · {definition.schema_org_type}
            </span>
          )}
          {definition?.quality_score != null && (
            <span
              className="font-mono uppercase px-2 py-0.5 rounded bg-ink text-paper"
              style={{ fontSize: "10px", letterSpacing: "0.06em" }}
            >
              Qualité · {definition.quality_score}/100
            </span>
          )}
          {definition?.validated_by && (
            <span
              className="font-mono uppercase px-2 py-0.5 border border-line rounded text-ink-2 bg-paper"
              style={{ fontSize: "10px", letterSpacing: "0.06em" }}
            >
              Validé par · {definition.validated_by}
            </span>
          )}
        </div>
      )}

      {/* H1 SEO */}
      {hasH1 && (
        <div>
          <span className="font-mono text-[10px] text-ink-mute-2 uppercase block mb-1">
            &lt;h1&gt;
          </span>
          <p className="text-[14px] font-medium text-ink m-0">{resolved.h1}</p>
        </div>
      )}

      {/* Meta SEO (title + description) */}
      {hasSeoMeta && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {resolved.seo_title && (
            <div>
              <span className="font-mono text-[10px] text-ink-mute-2 uppercase block mb-1">
                &lt;title&gt;
              </span>
              <p className="text-ink m-0" style={{ fontSize: "13px", fontWeight: 500 }}>
                {resolved.seo_title}
              </p>
            </div>
          )}
          {resolved.seo_description && (
            <div>
              <span className="font-mono text-[10px] text-ink-mute-2 uppercase block mb-1">
                &lt;meta name=&quot;description&quot;&gt;
              </span>
              <p
                className="text-ink-muted m-0"
                style={{ fontSize: "12.5px", lineHeight: 1.5 }}
              >
                {resolved.seo_description}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Keywords (chips) */}
      {hasKeywords && (
        <div>
          <span className="font-mono text-[10px] text-ink-mute-2 uppercase block mb-1">
            Mots-clés
          </span>
          <div className="flex flex-wrap gap-1.5">
            {resolved.keywords.map((kw) => (
              <span
                key={kw}
                className="px-2 py-0.5 rounded-full border border-line bg-paper text-ink-2"
                style={{ fontSize: "11.5px", fontWeight: 400 }}
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
