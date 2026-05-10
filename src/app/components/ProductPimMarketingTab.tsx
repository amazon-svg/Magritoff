/**
 * ProductPimMarketingTab — Story S-FIX-1 (correctif PIM marketing/SEO/GEO).
 *
 * Onglet "Marketing" du ProductCard atelier (6e onglet apres Fiche/Prix/3D/
 * Editer/Debug). Affiche les 9 champs PIM commerciaux + SEO + structured data
 * pour permettre aux pure players W2P (persona tertiaire) de vendre le
 * produit en ligne avec contenu editorial riche et indexable.
 *
 * Source : EnrichedProduct retourne par enrichProduct(config, gammes,
 * definitions) — deja calcule cote ProductCard ligne ~106.
 *
 * UX : panneau inline coherent avec les autres onglets atelier (bg-paper
 * border-2 border-line rounded-xl p-6 mb-3). Sections empilees verticalement,
 * details/summary HTML natifs pour usage_examples + faq (a11y native).
 *
 * Bouton "Copier en JSON" : exporte le payload complet dans le presse-papier
 * pour copier-coller dans Shopify / Woo / API CMS pure player MVP-friendly.
 */

import { useState } from "react";
import { Megaphone, Copy, Check, ChevronUp } from "lucide-react";
import type { EnrichedProduct } from "../utils/productEnrichment";
import { TEST_IDS } from "../lib/testIds";
import {
  buildPimJsonExport,
  hasUsefulPimContent,
} from "./ProductPimMarketingTab.helpers";

interface Props {
  enriched: EnrichedProduct | null;
  productName: string;
  onClose?: () => void;
}

export function ProductPimMarketingTab({ enriched, productName, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const json = buildPimJsonExport(enriched);
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_err) {
      // Clipboard refuse (insecure context, permission) — fallback silencieux
    }
  };

  const useful = hasUsefulPimContent(enriched);

  return (
    <div
      data-testid={TEST_IDS.shop.marketingPanel}
      className="bg-paper border-2 border-line rounded-xl p-6 mb-3 shadow-sm"
    >
      {/* Header avec titre + actions */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-ink" strokeWidth={1.5} />
          <h3 className="text-base font-semibold text-ink m-0">
            Marketing &amp; SEO — {productName}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid={TEST_IDS.shop.marketingCopyJsonBtn}
            onClick={handleCopy}
            aria-label="Copier les donnees PIM au format JSON"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
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
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-ink-muted hover:text-ink"
              aria-label="Fermer l onglet Marketing"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Empty state si pas de matching PIM */}
      {!enriched && (
        <p className="text-[13px] text-ink-muted m-0 italic">
          Pas de données PIM pour ce produit. Les <code>matching_rules</code> des
          gammes souscrites ne reconnaissent pas <code>kind/dimensions</code> de
          ce produit. Vérifier le PIM admin (DashboardAdminPIM) ou les
          souscriptions tenant.
        </p>
      )}

      {enriched && !useful && (
        <p className="text-[13px] text-warn-fg m-0">
          Gamme <strong>{enriched.gamme?.name}</strong> matchée mais les
          templates marketing du PIM sont vides. Demander à l&apos;admin Magrit
          d&apos;enrichir la <code>ProductDefinition</code> pour cette gamme.
        </p>
      )}

      {enriched && useful && (
        <div className="flex flex-col gap-5">
          {/* Badges meta : Schema.org + quality_score + validated_by */}
          <div className="flex flex-wrap items-center gap-2">
            {enriched.definition?.schema_org_type && (
              <span
                className="font-mono uppercase px-2 py-0.5 border border-line rounded text-ink-mute-2 bg-paper"
                style={{ fontSize: "10px", letterSpacing: "0.06em" }}
              >
                Schema.org · {enriched.definition.schema_org_type}
              </span>
            )}
            {enriched.definition?.quality_score != null && (
              <span
                className="font-mono uppercase px-2 py-0.5 rounded bg-ink text-paper"
                style={{ fontSize: "10px", letterSpacing: "0.06em" }}
              >
                Qualité · {enriched.definition.quality_score}/100
              </span>
            )}
            {enriched.definition?.validated_by && (
              <span
                className="font-mono uppercase px-2 py-0.5 border border-line rounded text-ink-2 bg-paper"
                style={{ fontSize: "10px", letterSpacing: "0.06em" }}
              >
                Validé par · {enriched.definition.validated_by}
              </span>
            )}
            <span
              className="font-mono uppercase px-2 py-0.5 border border-line rounded text-ink-mute-2 bg-paper"
              style={{ fontSize: "10px", letterSpacing: "0.06em" }}
            >
              Gamme · {enriched.gamme?.slug ?? "—"}
            </span>
          </div>

          {/* 1. Titre commercial */}
          <Section
            label="Titre commercial"
            sectionName="title"
            empty={!enriched.resolved.title}
          >
            <h4
              className="text-ink m-0"
              style={{ fontSize: "18px", fontWeight: 600, letterSpacing: "-0.015em" }}
            >
              {enriched.resolved.title || "—"}
            </h4>
          </Section>

          {/* 2. Accroche commerciale */}
          {enriched.resolved.short_description && (
            <Section label="Accroche commerciale" sectionName="short_description">
              <p
                className="text-ink-2 italic m-0"
                style={{ fontSize: "14px", lineHeight: 1.55 }}
              >
                {enriched.resolved.short_description}
              </p>
            </Section>
          )}

          {/* 3. Description longue */}
          {enriched.resolved.description && (
            <Section label="Description longue" sectionName="description">
              <div
                className="text-ink m-0 prose prose-sm max-w-none"
                style={{ fontSize: "13.5px", lineHeight: 1.6 }}
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: enriched.resolved.description }}
              />
            </Section>
          )}

          {/* 4. H1 SEO */}
          {enriched.resolved.h1 && (
            <Section label="H1 SEO" sectionName="h1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-ink-mute-2 uppercase">
                  &lt;h1&gt;
                </span>
                <span className="text-[14px] font-medium text-ink">
                  {enriched.resolved.h1}
                </span>
              </div>
            </Section>
          )}

          {/* 5. Meta SEO (title + description) */}
          {(enriched.resolved.seo_title || enriched.resolved.seo_description) && (
            <Section label="Meta SEO" sectionName="seo">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {enriched.resolved.seo_title && (
                  <div>
                    <span className="font-mono text-[10px] text-ink-mute-2 uppercase block mb-1">
                      &lt;title&gt;
                    </span>
                    <p
                      className="text-ink m-0"
                      style={{ fontSize: "13px", fontWeight: 500 }}
                    >
                      {enriched.resolved.seo_title}
                    </p>
                  </div>
                )}
                {enriched.resolved.seo_description && (
                  <div>
                    <span className="font-mono text-[10px] text-ink-mute-2 uppercase block mb-1">
                      &lt;meta name=&quot;description&quot;&gt;
                    </span>
                    <p
                      className="text-ink-muted m-0"
                      style={{ fontSize: "12.5px", lineHeight: 1.5 }}
                    >
                      {enriched.resolved.seo_description}
                    </p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* 6. Keywords */}
          {enriched.resolved.keywords && enriched.resolved.keywords.length > 0 && (
            <Section label="Mots-clés (keywords)" sectionName="keywords">
              <div className="flex flex-wrap gap-1.5">
                {enriched.resolved.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="px-2 py-0.5 rounded-full border border-line bg-paper text-ink-2"
                    style={{ fontSize: "11.5px", fontWeight: 400 }}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* 7. Cas d usage */}
          {enriched.resolved.usage_examples &&
            enriched.resolved.usage_examples.length > 0 && (
              <Section label="Cas d usage" sectionName="usage_examples">
                <div className="flex flex-col gap-2">
                  {enriched.resolved.usage_examples.map((u, i) => (
                    <details
                      key={i}
                      className="border border-line rounded-md p-3 [&>summary]:cursor-pointer"
                    >
                      <summary
                        className="text-ink"
                        style={{ fontSize: "13px", fontWeight: 500 }}
                      >
                        {u.title}
                      </summary>
                      <p
                        className="text-ink-muted m-0 mt-2"
                        style={{ fontSize: "12.5px", lineHeight: 1.5 }}
                      >
                        {u.description}
                      </p>
                    </details>
                  ))}
                </div>
              </Section>
            )}

          {/* 8. FAQ */}
          {enriched.resolved.faq && enriched.resolved.faq.length > 0 && (
            <Section label="FAQ" sectionName="faq">
              <div className="flex flex-col gap-2">
                {enriched.resolved.faq.map((q, i) => (
                  <details
                    key={i}
                    className="border border-line rounded-md p-3 [&>summary]:cursor-pointer"
                  >
                    <summary
                      className="text-ink"
                      style={{ fontSize: "13px", fontWeight: 500 }}
                    >
                      {q.question}
                    </summary>
                    <p
                      className="text-ink-muted m-0 mt-2"
                      style={{ fontSize: "12.5px", lineHeight: 1.5 }}
                    >
                      {q.answer}
                    </p>
                  </details>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

interface SectionProps {
  label: string;
  sectionName: string;
  empty?: boolean;
  children: React.ReactNode;
}

function Section({ label, sectionName, empty, children }: SectionProps) {
  return (
    <div
      data-testid={TEST_IDS.shop.marketingSection}
      data-section-name={sectionName}
    >
      <span
        className="font-mono uppercase text-ink-mute-2 block mb-2"
        style={{ fontSize: "10px", letterSpacing: "0.08em", fontWeight: 500 }}
      >
        {label}
      </span>
      {empty ? (
        <p className="text-ink-muted italic m-0" style={{ fontSize: "12.5px" }}>
          —
        </p>
      ) : (
        children
      )}
    </div>
  );
}
