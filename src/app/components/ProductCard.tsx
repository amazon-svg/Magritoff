import { useEffect, useState } from "react";
import {
  ChevronUp, Loader2, RefreshCw, Printer, CheckCircle, AlertTriangle, Lock,
  BookmarkPlus, Check, FileText, Tag, Box, Pencil, Bug, Plus, Heart,
} from "lucide-react";
import { QuoteModal } from "./QuoteModal";
import { useAuth } from "../contexts/AuthContext";
import { useClients } from "../contexts/ClientsContext";
import { useLibrary } from "../contexts/LibraryContext";
import { usePIM } from "../contexts/PIMContext";
import { usePlan } from "../hooks/usePlan";
import { useTenantPath } from "../hooks/useTenantPath";
import { LibraryPickerModal } from "./LibraryPickerModal";
import { enrichProduct } from "../utils/productEnrichment";
import { ProductMockup } from "./brand/ProductMockup";
import { resolveProductImage } from "../utils/productImages";
import { TEST_IDS } from "../lib/testIds";
import { ProductOverlay } from "./shop/ProductOverlay";
import { ProductPimSeoSection } from "./ProductPimSeoSection";
import { useTenant } from "../contexts/TenantContext";
import { applyTax, extractTaxAmount, formatTaxLabel, getTaxRate } from "../utils/tax";
import { useClariprintProduct } from "../hooks/useClariprintProduct";
import { ProductCard3D } from "./product-card/ProductCard3D";
import { ProductCardDebug } from "./product-card/ProductCardDebug";
import type { ShopProduct } from "../contexts/ShopsContext";

interface ClariprintQuoteResult {
  success: boolean;
  credentialsMissing?: boolean;
  message?: string;
  error?: string;
  priceHT?: number;
  costs?: {
    paper?: number;
    print?: number;
    makeready?: number;
    packaging?: number;
    delivery?: number;
    total?: number;
  };
  delais?: number;
  weight?: number;
  fournisseur?: string;
  processDuration?: number;
  details?: string;
}

interface ProductCardProps {
  // E7.7 — index de la ligne dans la grille marguerite-quote-result.
  // Forwarde sur l element racine pour permettre un ciblage par
  // [data-testid="marguerite-quote-line"][data-line-index="N"].
  'data-line-index'?: number;
  product: {
    id?: string;
    name: string;
    quantity?: number;
    dimensions?: { width: number; height: number };
    format?: string;
    material?: string;
    weight?: number;
    printing?: { recto: string; verso: string };
    finish?: string;
    finishRecto?: string;
    finishVerso?: string;
    packaging?: string;
    deliveryInfo?: string;
    deliveryLocation?: string;
    addressProvided?: string;
    price?: number;
    suggestions?: string[];
    description?: string;
    pages?: number;
    incomplete?: boolean;
    claudeResponse?: string;
    // ✅ Données Clariprint brutes (champs API)
    clariprintData?: any;
    client_id?: string | null;
  };
  onProductUpdate?: (updatedProduct: any) => void;
  compact?: boolean;
  // Sélection multiple (externe) pour actions groupées
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
}

type TabType = "sheet" | "pricing" | "mockup" | "form" | "debug" | null;

export function ProductCard({
  product,
  onProductUpdate,
  compact,
  selectable,
  selected,
  onSelectedChange,
  ...rest
}: ProductCardProps) {
  const dataLineIndex = rest['data-line-index'];
  const { user } = useAuth();
  const { clients } = useClients();
  const { addProduct: addToLibrary } = useLibrary();
  const { gammes, definitions } = usePIM();
  const { canUse } = usePlan();
  const tp = useTenantPath();
  const { currentTenant } = useTenant();
  const taxRate = getTaxRate(currentTenant);
  const [localProduct, setLocalProduct] = useState(product);
  const [activeTab, setActiveTab] = useState<TabType>(null);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [libraryState, setLibraryState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  // S2.4b — Overlay configuration produit (atelier deviseur).
  // Le bouton "Editer" (onglet form) bascule de l'ancien form inline vers
  // l'overlay riche avec recalcul prix Clariprint en temps reel (S2.4).
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  // R1 Phase A (fix bug E1 audit refacto §3.1) : synchroniser localProduct
  // avec la prop `product` quand le parent re-render avec un produit different.
  // Avant : `useState(product)` clonait la prop initiale sans jamais resync.
  useEffect(() => {
    setLocalProduct(product);
  }, [product]);

  // Enrichissement PIM (gamme + definition) à partir de la config courante
  const enriched = (() => {
    try {
      return enrichProduct(product as any, gammes, definitions, 'fr');
    } catch {
      return null;
    }
  })();

  // ─── Clariprint (hook extrait R1 Phase A) ───────────────────────────────
  // Le hook gere : fetch via httpAdapter (R3), AbortController flag (fix B5),
  // states quote / loading / lastRequest / lastRawResponse. Cf.
  // useClariprintProduct.ts.
  const {
    quote: clariprintQuote,
    loading: clariprintLoading,
    lastRequest: lastRequestSent,
    lastRawResponse,
    compute: triggerClariprint,
    reset: resetClariprintQuote,
  } = useClariprintProduct();

  const computeClariprintQuote = async () => {
    if (!localProduct.clariprintData) return;
    await triggerClariprint(localProduct.clariprintData);
  };

  const updateProduct = (updates: any) => {
    const updated = { ...localProduct, ...updates };
    setLocalProduct(updated);
    if (onProductUpdate) onProductUpdate(updated);
  };

  const toggleTab = (tab: TabType) => {
    setActiveTab(activeTab === tab ? null : tab);
  };

  const handleAddToLibrary = async (libraryId: string) => {
    setLibraryState('saving');
    const priceHT =
      clariprintQuote?.costs?.total ??
      clariprintQuote?.priceHT ??
      localProduct.price ??
      estimatePrice();
    const added = await addToLibrary({
      library_id: libraryId,
      client_id: (localProduct as any).client_id ?? null,
      name: localProduct.name,
      category: localProduct.clariprintData?.kind || 'Autres',
      description: `${localProduct.quantity ?? ''} · ${localProduct.format ?? ''} · ${localProduct.material ?? ''}`.trim(),
      price_ht: priceHT,
      image_url: '',
      config: localProduct,
      active: true,
    });
    setLibraryState(added ? 'saved' : 'idle');
    if (added) setTimeout(() => setLibraryState('idle'), 2000);
  };

  // (BoldValue retiré : l'édition inline prompt() n'est plus utilisée dans la v2.
  //  Toute modif passe par l'onglet "Éditer" — meilleure UX, cohérent avec la typo.)

  // ─── Prix estimé (fallback si pas Clariprint) ────────────────────────────
  const estimatePrice = (): number => {
    const qty = localProduct.quantity || 500;
    const name = (localProduct.name || "").toLowerCase();
    let base = 0.15;
    if (name.includes("carte") && name.includes("visite")) base = 0.08;
    else if (name.includes("flyer") || name.includes("tract")) base = 0.12;
    else if (name.includes("brochure") || name.includes("catalogue")) base = 1.5;
    else if (name.includes("affiche") || name.includes("poster")) base = 5.0;
    else if (name.includes("dépliant")) base = 0.25;

    let price = base * qty;
    if ((localProduct.weight || 0) > 300) price *= 1.3;
    else if ((localProduct.weight || 0) > 200) price *= 1.15;
    if (localProduct.printing?.verso && localProduct.printing.verso !== "Sans impression") price *= 1.4;
    if (localProduct.finishRecto?.toLowerCase().includes("pelliculage")) price += qty * 0.05;
    if (qty >= 5000) price *= 0.7;
    else if (qty >= 2000) price *= 0.8;
    else if (qty >= 1000) price *= 0.9;
    return Math.round(price * 100) / 100;
  };

  const estimatedPrice = localProduct.price || estimatePrice();

  // Prix final à afficher (Clariprint si dispo, sinon estimé)
  const displayPriceHT =
    clariprintQuote?.success && clariprintQuote.priceHT != null
      ? clariprintQuote.priceHT
      : estimatedPrice;

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      data-testid={TEST_IDS.marguerite.quoteLine}
      data-line-index={dataLineIndex}
      className="w-full h-full flex flex-col"
    >
      {/* CAS : Produit incomplet */}
      {localProduct.incomplete ? (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl shadow-sm p-6 h-full flex flex-col">
          <div className="flex items-start gap-3 mb-4">
            <div className="text-2xl">⚠️</div>
            <div>
              <h3 className="text-lg font-bold text-amber-900 mb-1">Précisions nécessaires</h3>
              <p className="text-base text-amber-700">
                J'ai besoin de plus d'informations pour configurer votre produit.
              </p>
            </div>
          </div>
          <div className="bg-paper rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-ink mb-3">📋 Informations disponibles</h4>
            <div className="grid grid-cols-2 gap-3 text-base">
              <div>
                <span className="text-ink-muted">Produit :</span>
                <span className="font-semibold text-ink ml-2">{localProduct.name}</span>
              </div>
              <div>
                <span className="text-ink-muted">Quantité :</span>
                <span className="font-semibold text-ink ml-2">{localProduct.quantity}</span>
              </div>
            </div>
          </div>
          {localProduct.suggestions && localProduct.suggestions.length > 0 && (
            <div className="bg-paper rounded-lg p-4 flex-1">
              <h4 className="font-semibold text-ink mb-3">❓ Questions à préciser</h4>
              <ul className="space-y-2">
                {localProduct.suggestions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 text-base text-ink-2">
                    <span className="text-amber-600 font-bold">{i + 1}.</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="h-full flex flex-col">
          {/* ══════════════════════════════════════════════════════════
              v2 — carte catalogue stacked : visuel 16/9, meta, title,
              desc, chips, spec-bar 4 champs, tools bar 6 cases.
              Source : .design-handoff/designs/02 - ProductCard.html
              ══════════════════════════════════════════════════════════ */}
          <article
            className={`pc-v2 relative bg-paper border-2 border-line rounded-xl overflow-hidden mb-3 flex-1 flex flex-col shadow-xs ${
              selectable && selected ? "outline outline-2 outline-brand" : ""
            }`}
            style={{ fontFamily: "var(--font-ui)" }}
          >
            {/* Visuel : photo produit via Picsum (seed stable = meme image
                pour le meme produit) ; fallback sur le mockup SVG schematique
                en cas d'echec de chargement ou si product.image_url n'est
                pas defini (futures images custom via bibliotheque). */}
            <div
              className={`relative w-full shrink-0 overflow-hidden border-b border-line bg-bg ${
                compact ? "h-[120px]" : "h-[208px]"
              }`}
            >
              {(() => {
                const src = resolveProductImage({
                  name: localProduct.name,
                  id: localProduct.id,
                  image_url: (localProduct as any).image_url,
                  kind: localProduct.clariprintData?.kind,
                  clariprintData: localProduct.clariprintData,
                  gammes,
                  definitions,
                });
                if (imgError || !src) {
                  return (
                    <ProductMockup
                      name={localProduct.name}
                      kind={localProduct.clariprintData?.kind}
                      category={enriched?.gamme?.name}
                      corner={!selectable ? localProduct.clariprintData?.kind : undefined}
                      className="w-full h-full"
                    />
                  );
                }
                return (
                  <>
                    <img
                      src={src}
                      alt={localProduct.name}
                      onError={() => setImgError(true)}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                    {/* Overlay sombre tres leger pour la lisibilite des badges */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
                    {/* Pill gamme PIM (S-FIX-BADGES-11/05 bug #1 regression Arnaud) :
                        Avant : `clariprintData.kind` brut → "LEAFLET" partout
                        (toutes les gammes Clariprint ont kind="leaflet").
                        Maintenant : `enriched.gamme.name` (gamme PIM resolue
                        type "Carterie", "Flyer A4", "Brochure"...) ;
                        fallback `localProduct.category` si pas de match PIM ;
                        masque si valeur generique "leaflet" / vide. */}
                    {!selectable && (() => {
                      const gammeBadge = enriched?.gamme?.name;
                      const fallbackBadge = localProduct.category;
                      const label = gammeBadge || fallbackBadge;
                      // Ne jamais afficher les kinds Clariprint bruts
                      if (!label || /^(leaflet|folded|book|cover|section)$/i.test(label)) {
                        return null;
                      }
                      return (
                        <div className="absolute top-2 left-2 pointer-events-none">
                          <span
                            className="inline-block font-mono uppercase tracking-wider px-2 py-0.5 rounded text-white"
                            style={{
                              fontSize: "11px",
                              letterSpacing: "0.08em",
                              fontWeight: 500,
                              background: "rgba(10,10,10,0.75)",
                            }}
                          >
                            {label}
                          </span>
                        </div>
                      );
                    })()}
                  </>
                );
              })()}

              {/* Checkbox sélection */}
              {selectable && (
                <label className="absolute top-2 left-2 z-10 bg-paper/90 backdrop-blur-sm rounded p-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!selected}
                    onChange={(e) => onSelectedChange?.(e.target.checked)}
                    className="w-4 h-4 cursor-pointer accent-black"
                    aria-label="Sélectionner ce produit"
                  />
                </label>
              )}

              {/* Fav icon top-right (placeholder pour favoris futurs) */}
              <button
                type="button"
                aria-label="Ajouter aux favoris"
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-paper/85 backdrop-blur-sm grid place-items-center text-ink-muted hover:text-ink transition-colors"
                onClick={(e) => e.preventDefault()}
              >
                <Heart className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>

            {/* Corps : meta, title-row, desc, chips */}
            <div className={`${compact ? "p-3" : "px-5 py-4"} flex-1 flex flex-col`}>
              <div
                className="font-mono uppercase tracking-wider text-ink-muted mb-2"
                style={{ fontSize: "11.5px", letterSpacing: "0.08em", fontWeight: 500 }}
              >
                {enriched?.gamme?.name || localProduct.clariprintData?.kind || "Produit"}
              </div>

              <div className="flex items-baseline justify-between gap-4 mb-1.5">
                <h3
                  className="text-ink m-0 leading-tight line-clamp-2"
                  style={{
                    fontWeight: 400,
                    fontSize: compact ? "16px" : "21px",
                    letterSpacing: "-0.01em",
                  }}
                  title={enriched?.resolved.title || localProduct.name}
                >
                  {/* On prefere le nom court brut ; le title PIM resolu peut
                      etre verbeux et casser la mise en page. */}
                  {localProduct.name || enriched?.resolved.title || "Produit"}
                </h3>
                <div
                  className="text-ink whitespace-nowrap"
                  style={{
                    fontWeight: 500,
                    fontSize: compact ? "17px" : "21px",
                    letterSpacing: "-0.015em",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <span
                    className="font-mono uppercase text-ink-muted mr-1.5"
                    style={{ fontSize: "11.5px", letterSpacing: "0.06em", fontWeight: 500 }}
                  >
                    dès
                  </span>
                  {displayPriceHT.toFixed(0)}
                  <small className="text-ink-muted ml-1" style={{ fontSize: "13px", fontWeight: 400 }}>
                    € /{localProduct.quantity ?? 100} ex.
                  </small>
                </div>
              </div>

              {/* Description courte — clampee a 2 lignes pour ne pas deborder */}
              {!compact && (
                <p
                  className="text-ink-2 m-0 mb-3 max-w-[420px] line-clamp-2"
                  style={{ fontSize: "14.5px", lineHeight: 1.55, fontWeight: 400 }}
                >
                  {enriched?.resolved.short_description ||
                    `${localProduct.material ?? "Papier standard"}${
                      localProduct.finishRecto && localProduct.finishRecto !== "Sans finition"
                        ? ` · ${localProduct.finishRecto.toLowerCase()}`
                        : ""
                    }${
                      localProduct.printing?.verso && localProduct.printing.verso !== "Sans impression"
                        ? " · impression recto/verso"
                        : " · impression recto"
                    }.`}
                </p>
              )}

              {/* Chips variantes */}
              {!compact && (
                <div className="flex gap-1.5 flex-wrap mb-3">
                  <span
                    className="font-mono px-2 py-1 rounded bg-ink text-paper"
                    style={{
                      fontSize: "11.5px",
                      letterSpacing: "0.04em",
                      fontWeight: 500,
                    }}
                  >
                    {localProduct.weight ?? 0}g {localProduct.material?.toLowerCase().split(" ").pop() ?? ""}
                  </span>
                  {localProduct.finishRecto && localProduct.finishRecto !== "Sans finition" && (
                    <span
                      className="font-mono px-2 py-1 rounded"
                      style={{
                        fontSize: "11.5px",
                        letterSpacing: "0.04em",
                        fontWeight: 500,
                        background: "#F5F5F5",
                        color: "var(--ink-2)",
                      }}
                    >
                      {localProduct.finishRecto}
                    </span>
                  )}
                  {localProduct.pages && (
                    <span
                      className="font-mono px-2 py-1 rounded"
                      style={{
                        fontSize: "11.5px",
                        letterSpacing: "0.04em",
                        fontWeight: 500,
                        background: "#F5F5F5",
                        color: "var(--ink-2)",
                      }}
                    >
                      {localProduct.pages} pages
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Spec-bar 4 champs, border-top + border-bottom */}
            {!compact && (
              <div
                className="grid grid-cols-4 border-t border-b border-line"
                style={{ fontFamily: "var(--font-ui)" }}
              >
                {[
                  {
                    k: "Format",
                    v:
                      localProduct.format ||
                      (localProduct.dimensions
                        ? `${localProduct.dimensions.width}×${localProduct.dimensions.height} mm`
                        : "—"),
                  },
                  {
                    k: "Grammage",
                    v: localProduct.weight ? `${localProduct.weight} g/m²` : "—",
                  },
                  {
                    k: "Délai",
                    v:
                      clariprintQuote?.delais != null
                        ? `${clariprintQuote.delais}j`
                        : "72h",
                  },
                  {
                    k: "Min.",
                    v: `${localProduct.quantity ?? 100} ex.`,
                  },
                ].map((cell, i, arr) => (
                  <div
                    key={cell.k}
                    className={`px-4 py-3 ${i < arr.length - 1 ? "border-r border-line" : ""}`}
                  >
                    <div
                      className="font-mono uppercase text-ink-muted mb-1"
                      style={{ fontSize: "11px", letterSpacing: "0.06em", fontWeight: 500 }}
                    >
                      {cell.k}
                    </div>
                    <div
                      className="text-ink"
                      style={{ fontSize: "14px", fontWeight: 500, letterSpacing: "-0.005em" }}
                    >
                      {cell.v}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tools bar : 6 cases (5 tools + 1 primary Ajouter) */}
            <div className="flex border-t border-line">
              {[
                { key: "sheet" as TabType, label: "Fiche", icon: FileText },
                { key: "pricing" as TabType, label: "Prix", icon: Tag },
                { key: "mockup" as TabType, label: "3D", icon: Box },
                { key: "form" as TabType, label: "Éditer", icon: Pencil },
                { key: "debug" as TabType, label: "Debug", icon: Bug },
              ].map(({ key, label, icon: Icon }, idx, arr) => (
                <button
                  key={key}
                  data-testid={key === "form" ? TEST_IDS.shop.productCardEditBtn : undefined}
                  onClick={() => {
                    // S2.4b — l'onglet "Editer" (key=form) ouvre desormais l'overlay
                    // configuration Clariprint riche (S2.4) au lieu d'afficher l'ancien
                    // form inline. L'ancien form est conserve dans le code mais ne
                    // peut plus etre toggle visuellement (sera supprime sprint refacto).
                    if (key === "form") {
                      setOverlayOpen(true);
                    } else {
                      toggleTab(key);
                    }
                  }}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 px-1 transition-colors ${
                    idx < arr.length - 1 ? "border-r border-line" : ""
                  } ${
                    activeTab === key
                      ? "bg-ink text-paper"
                      : "bg-paper text-ink-2 hover:bg-bg hover:text-ink"
                  }`}
                  aria-label={key === "form" ? "Configurer le produit (overlay)" : label}
                >
                  <Icon className="w-4 h-4" strokeWidth={1.5} />
                  <span
                    className="leading-none"
                    style={{ fontSize: "12px", fontWeight: 500, letterSpacing: "-0.005em" }}
                  >
                    {label}
                  </span>
                </button>
              ))}
              {/* CTA primary : Ajouter à la bibliothèque */}
              {user && canUse("library") ? (
                <button
                  onClick={() => setLibraryPickerOpen(true)}
                  disabled={libraryState !== "idle"}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 px-1 border-l border-line transition-colors ${
                    libraryState === "saved"
                      ? "bg-ok-fg text-paper"
                      : "bg-ink text-paper hover:bg-black"
                  }`}
                  aria-label="Ajouter à la bibliothèque"
                >
                  {libraryState === "saving" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : libraryState === "saved" ? (
                    <Check className="w-4 h-4" strokeWidth={1.5} />
                  ) : (
                    <Plus className="w-4 h-4" strokeWidth={1.8} />
                  )}
                  <span
                    className="leading-none"
                    style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "-0.005em" }}
                  >
                    {libraryState === "saved" ? "Ajouté" : "Ajouter"}
                  </span>
                </button>
              ) : (
                <div
                  className="flex-1 flex flex-col items-center gap-1 py-2.5 px-1 border-l border-line bg-bg text-ink-mute-2"
                  aria-hidden="true"
                >
                  <Lock className="w-4 h-4" strokeWidth={1.5} />
                  <span className="leading-none" style={{ fontSize: "12px", fontWeight: 500 }}>
                    Bibli
                  </span>
                </div>
              )}
            </div>
          </article>

          {libraryPickerOpen && (
            <LibraryPickerModal
              preferredClientId={(localProduct as any).client_id ?? null}
              onPick={async (libraryId) => {
                await handleAddToLibrary(libraryId);
              }}
              onClose={() => setLibraryPickerOpen(false)}
            />
          )}

          {/* ── Fiche produit ── */}
          {activeTab === "sheet" && (
            <div className="bg-paper border-2 border-line rounded-xl p-6 mb-3 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-ink">Fiche produit détaillée</h3>
                <button onClick={() => setActiveTab(null)} className="text-ink-muted hover:text-ink">
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2 text-base">
                {[
                  ["Produit", localProduct.name],
                  ["Quantité", localProduct.quantity || 0],
                  [
                    "Format",
                    localProduct.format ||
                      `${localProduct.dimensions?.width || 0} × ${localProduct.dimensions?.height || 0} mm`,
                  ],
                  ["Papier", localProduct.material || "—"],
                  ["Grammage", `${localProduct.weight || 0} g/m²`],
                  [
                    "Impression",
                    `${localProduct.printing?.recto || "Quadrichromie"} / ${localProduct.printing?.verso || "Sans impression"}`,
                  ],
                  ["Finition recto", localProduct.finishRecto || localProduct.finish || "Sans finition"],
                  ["Finition verso", localProduct.finishVerso || "Sans finition"],
                  ...(localProduct.pages ? [["Pages", localProduct.pages]] : []),
                  ...(localProduct.clariprintData?.kind
                    ? [["Type Clariprint", localProduct.clariprintData.kind]]
                    : []),
                  ...(localProduct.client_id
                    ? [[
                        "Client",
                        clients.find((c) => c.id === localProduct.client_id)?.company || "—",
                      ]]
                    : []),
                ].map(([label, value], i, arr) => (
                  <div
                    key={String(label)}
                    className={`flex justify-between py-2 ${i < arr.length - 1 ? "border-b border-line" : ""}`}
                  >
                    <span className="text-ink-muted">{label}</span>
                    <span className="font-semibold">{String(value)}</span>
                  </div>
                ))}
              </div>

              {/* Contenu enrichi PIM */}
              {enriched?.definition && (
                <div className="mt-5 pt-4 border-t border-line space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold uppercase tracking-wider text-brand">
                      Fiche commerciale
                    </span>
                    {enriched.gamme && (
                      <span className="text-[10px] bg-blue-50 text-brand border border-blue-200 px-1.5 py-0.5 rounded">
                        {enriched.gamme.name}
                      </span>
                    )}
                  </div>
                  {enriched.resolved.short_description && (
                    <p className="text-base text-ink-2 italic">{enriched.resolved.short_description}</p>
                  )}
                  {enriched.resolved.description && (
                    <div className="text-base text-ink-2 whitespace-pre-line">
                      {enriched.resolved.description}
                    </div>
                  )}
                  {enriched.resolved.usage_examples.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-ink-2 mb-1">Cas d'usage</p>
                      <ul className="space-y-1 text-sm text-ink-muted">
                        {enriched.resolved.usage_examples.map((ex, i) => (
                          <li key={i}>
                            <span className="font-medium text-ink">{ex.title}</span>
                            {ex.description ? <span> — {ex.description}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {enriched.resolved.faq.length > 0 && (
                    <details>
                      <summary className="text-sm font-semibold text-ink-2 cursor-pointer hover:text-ink">
                        FAQ ({enriched.resolved.faq.length})
                      </summary>
                      <div className="mt-2 space-y-2">
                        {enriched.resolved.faq.map((qa, i) => (
                          <div key={i} className="text-sm">
                            <p className="font-medium text-ink">{qa.question}</p>
                            <p className="text-ink-muted mt-0.5">{qa.answer}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}

              {/* S-FIX-1 — Section SEO/GEO complementaire (h1, meta, keywords, schema_org, quality_score, copier JSON) */}
              <ProductPimSeoSection enriched={enriched} />

              {/* Config Clariprint brute */}
              {localProduct.clariprintData && (
                <details className="mt-4">
                  <summary className="text-sm text-ink-muted cursor-pointer hover:text-ink">
                    🔧 Voir la config Clariprint (JSON API)
                  </summary>
                  <pre className="mt-2 p-3 bg-bg rounded-lg text-sm text-ink-muted overflow-auto max-h-48">
                    {JSON.stringify(localProduct.clariprintData, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* ── Prix & Devis ── */}
          {activeTab === "pricing" && (
            <div className="bg-paper border-2 border-line rounded-xl p-6 mb-3 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-ink">Tarification</h3>
                <button onClick={() => setActiveTab(null)} className="text-ink-muted hover:text-ink">
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>

              {/* ─ Prix estimé (floutés si non-authentifié) ─ */}
              {!user && (
                <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-base text-amber-800">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>Connectez-vous pour voir les prix.</span>
                </div>
              )}
              <div className="space-y-2 text-base mb-4">
                <div className="flex justify-between py-2 border-b border-line">
                  <span className="text-ink-muted text-sm">
                    {clariprintQuote?.success ? "Prix Clariprint HT" : "Prix estimé HT"}
                  </span>
                  <span className={`font-semibold ${!user ? "blur-sm select-none" : ""}`}>
                    {displayPriceHT.toFixed(2)} €
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-line">
                  <span className="text-ink-muted">TVA ({formatTaxLabel(taxRate)})</span>
                  <span className={`font-semibold ${!user ? "blur-sm select-none" : ""}`}>
                    {extractTaxAmount(displayPriceHT, taxRate).toFixed(2)} €
                  </span>
                </div>
                <div
                  className="flex justify-between items-center py-3 bg-gray-900 text-white px-4 rounded-lg mt-1 cursor-pointer hover:bg-gray-800 transition-colors"
                  onClick={() => setIsQuoteModalOpen(true)}
                  title="Cliquer pour le devis"
                >
                  <span className="font-semibold text-base">Total TTC</span>
                  <span className={`text-xl font-bold ${!user ? "blur-sm select-none" : ""}`}>
                    {applyTax(displayPriceHT, taxRate).toFixed(2)} €
                  </span>
                </div>
              </div>

              {/* ─ Section Clariprint ─ */}
              {localProduct.clariprintData && (
                <div className="border-t border-line pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Printer className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-base font-semibold text-ink">Prix réel Clariprint</h4>
                    </div>
                    {/* Bouton debug */}
                    <button
                      onClick={() => setShowDebug((v) => !v)}
                      className={`text-sm px-2 py-1 rounded border transition-colors ${
                        showDebug
                          ? "bg-gray-800 text-white border-gray-800"
                          : "text-ink-mute-2 border-line hover:border-gray-400 hover:text-ink-muted"
                      }`}
                      title="Afficher / masquer la requête envoyée à Clariprint"
                    >
                      {showDebug ? "Masquer debug" : "🔍 Debug"}
                    </button>
                  </div>

                  {/* ─ Panneau debug : requête + réponse brute ─ */}
                  {showDebug && (
                    <div className="mb-4 space-y-3">
                      {/* Requête envoyée */}
                      <div className="bg-slate-900 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-mono font-bold text-slate-300">
                            📤 POST /optimproject/json.wcl
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(
                                JSON.stringify(
                                  { clariprint_product: localProduct.clariprintData },
                                  null,
                                  2
                                )
                              );
                            }}
                            className="text-sm text-slate-400 hover:text-white transition-colors"
                          >
                            Copier
                          </button>
                        </div>
                        <pre className="text-sm text-green-300 overflow-auto max-h-64 leading-relaxed">
                          {JSON.stringify({ clariprint_product: localProduct.clariprintData }, null, 2)}
                        </pre>
                      </div>

                      {/* Réponse brute reçue */}
                      {lastRawResponse && (
                        <div className="bg-slate-800 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-mono font-bold text-slate-300">
                              📩 Réponse Clariprint (brute)
                            </span>
                            <button
                              onClick={() => navigator.clipboard.writeText(lastRawResponse)}
                              className="text-sm text-slate-400 hover:text-white transition-colors"
                            >
                              Copier
                            </button>
                          </div>
                          <pre className="text-sm text-yellow-200 overflow-auto max-h-64 leading-relaxed">
                            {lastRawResponse}
                          </pre>
                        </div>
                      )}

                      {!lastRawResponse && !clariprintLoading && (
                        <p className="text-sm text-slate-400 italic">
                          La réponse brute s'affichera ici après l'appel.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Loading */}
                  {clariprintLoading && (
                    <div
                      data-testid={TEST_IDS.quote.priceLoading}
                      className="flex items-center gap-2 text-indigo-600 text-base py-3"
                    >
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Calcul en cours auprès des imprimeurs...</span>
                    </div>
                  )}

                  {/* Credentials manquants */}
                  {!clariprintLoading && clariprintQuote?.credentialsMissing && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-base">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-amber-800 mb-1">Credentials non configurés</p>
                          <p className="text-amber-700 text-sm">
                            Ajoutez <code className="bg-amber-100 px-1 rounded">CLARIPRINT_LOGIN</code> et{" "}
                            <code className="bg-amber-100 px-1 rounded">CLARIPRINT_PASSWORD</code> dans vos secrets Supabase.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={computeClariprintQuote}
                        className="mt-3 text-sm text-amber-700 underline hover:no-underline"
                      >
                        Réessayer
                      </button>
                    </div>
                  )}

                  {/* Succès Clariprint */}
                  {!clariprintLoading && clariprintQuote?.success && (
                    <div
                      data-testid={TEST_IDS.quote.priceDisplay}
                      className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2 text-base"
                    >
                      <div className="flex items-center gap-1 mb-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700">
                          Prix obtenu depuis le réseau Clariprint
                        </span>
                      </div>

                      {/* Détail des coûts */}
                      {clariprintQuote.costs && (
                        <div className="space-y-1 text-sm">
                          {[
                            ["Papier", clariprintQuote.costs.paper],
                            ["Impression", clariprintQuote.costs.print],
                            ["Calage / Make-ready", clariprintQuote.costs.makeready],
                            ["Conditionnement", clariprintQuote.costs.packaging],
                            ["Livraison", clariprintQuote.costs.delivery],
                          ]
                            .filter(([, v]) => v != null && (v as number) > 0)
                            .map(([label, val]) => (
                              <div key={String(label)} className="flex justify-between text-ink-muted">
                                <span>{label}</span>
                                <span className={!user ? "blur-sm select-none" : ""}>{(val as number).toFixed(2)} €</span>
                              </div>
                            ))}
                          <div className="flex justify-between font-semibold text-green-800 border-t border-green-200 pt-1 mt-1">
                            <span>Total HT</span>
                            <span className={!user ? "blur-sm select-none" : ""}>{(clariprintQuote.costs.total || clariprintQuote.priceHT || 0).toFixed(2)} €</span>
                          </div>
                        </div>
                      )}

                      {/* Total TTC */}
                      <div className="flex justify-between bg-green-700 text-white px-3 py-2 rounded-lg font-bold text-base">
                        <span>Total TTC</span>
                        <span className={!user ? "blur-sm select-none" : ""}>
                          {applyTax(
                            clariprintQuote.costs?.total || clariprintQuote.priceHT || 0,
                            taxRate,
                          ).toFixed(2)}{" "}
                          €
                        </span>
                      </div>

                      {/* Infos complémentaires */}
                      <div className="grid grid-cols-2 gap-2 pt-1 text-sm text-green-700">
                        {clariprintQuote.delais != null && (
                          <div className="bg-white rounded-lg p-2 border border-green-100">
                            <div className="text-ink-muted mb-0.5">Délai estimé</div>
                            <div className="font-semibold">
                              {clariprintQuote.delais} jour{clariprintQuote.delais > 1 ? "s" : ""}
                            </div>
                          </div>
                        )}
                        {clariprintQuote.weight != null && (
                          <div className="bg-white rounded-lg p-2 border border-green-100">
                            <div className="text-ink-muted mb-0.5">Poids</div>
                            <div className="font-semibold">{clariprintQuote.weight.toFixed(2)} kg</div>
                          </div>
                        )}
                        {clariprintQuote.fournisseur && (
                          <div className="bg-white rounded-lg p-2 border border-green-100 col-span-2">
                            <div className="text-ink-muted mb-0.5">Imprimeur sélectionné</div>
                            <div className="font-semibold">{clariprintQuote.fournisseur}</div>
                          </div>
                        )}
                      </div>

                      {/* Recalculer */}
                      <button
                        data-testid={TEST_IDS.quote.refreshBtn}
                        onClick={computeClariprintQuote}
                        className="w-full mt-1 flex items-center justify-center gap-1.5 text-sm text-green-700 hover:text-green-900 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Recalculer
                      </button>
                    </div>
                  )}

                  {/* Erreur Clariprint */}
                  {!clariprintLoading &&
                    clariprintQuote &&
                    !clariprintQuote.success &&
                    !clariprintQuote.credentialsMissing && (
                      <div
                        data-testid={TEST_IDS.quote.priceErrorBanner}
                        className="bg-red-50 border border-red-200 rounded-xl p-3 text-base"
                      >
                        <p className="text-red-700 font-medium mb-1">❌ Erreur Clariprint</p>
                        <p className="text-red-600 text-sm mb-1">
                          {clariprintQuote.message || clariprintQuote.error || "Erreur inconnue"}
                        </p>
                        {clariprintQuote.details && (
                          <details className="mt-1">
                            <summary className="text-sm text-red-500 cursor-pointer hover:text-red-700">
                              Voir les détails techniques
                            </summary>
                            <pre className="mt-1 p-2 bg-red-100 rounded text-sm text-red-700 overflow-auto max-h-32 whitespace-pre-wrap">
                              {clariprintQuote.details}
                            </pre>
                          </details>
                        )}
                        <button
                          onClick={computeClariprintQuote}
                          className="mt-2 text-sm text-red-600 underline hover:no-underline"
                        >
                          Réessayer
                        </button>
                      </div>
                    )}

                  {/* Bouton initial */}
                  {!clariprintLoading && !clariprintQuote && (
                    <button
                      onClick={computeClariprintQuote}
                      className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 text-base"
                    >
                      <Printer className="w-4 h-4" />
                      Obtenir le prix réel Clariprint
                    </button>
                  )}
                </div>
              )}

              {/* ─ Bouton devis/panier ─ */}
              <button
                onClick={() => setIsQuoteModalOpen(true)}
                className="w-full mt-4 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
              >
                Imprimer le devis / Ajouter au panier
              </button>
            </div>
          )}

          {/* ── Mockup & 3D ── (R1 Phase B : extrait dans ProductCard3D.tsx) */}
          {activeTab === "mockup" && <ProductCard3D onClose={() => setActiveTab(null)} />}

          {/* ── Formulaire d'édition ── */}
          {activeTab === "form" && (
            <div className="bg-paper border-2 border-line rounded-xl p-6 mb-3 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-ink">Éditer la configuration</h3>
                <button onClick={() => setActiveTab(null)} className="text-ink-muted hover:text-ink">
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-base font-medium text-ink-2 mb-1">
                    Client associé
                  </label>
                  {user ? (
                    clients.length === 0 ? (
                      <p className="text-sm text-ink-muted bg-bg border border-line rounded-lg px-3 py-2">
                        Aucun client enregistré. Créez-en un depuis{" "}
                        <a href={tp('/dashboard/users')} className="text-brand hover:underline">
                          le tableau de bord
                        </a>
                        .
                      </p>
                    ) : (
                      <select
                        value={(localProduct as any).client_id || ""}
                        onChange={(e) => updateProduct({ client_id: e.target.value || null })}
                        className="w-full px-3 py-2 border border-line-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— Aucun —</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.company}
                            {c.contact_name ? ` — ${c.contact_name}` : ""}
                          </option>
                        ))}
                      </select>
                    )
                  ) : (
                    <p className="text-sm text-ink-muted bg-bg border border-line rounded-lg px-3 py-2">
                      Connectez-vous pour associer ce produit à un client.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-base font-medium text-ink-2 mb-1">Quantité</label>
                  <input
                    data-testid={TEST_IDS.marguerite.quoteLineQuantityInput}
                    type="number"
                    value={localProduct.quantity || 0}
                    onChange={(e) => updateProduct({ quantity: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-line-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-base font-medium text-ink-2 mb-1">Type de papier</label>
                  <input
                    type="text"
                    value={localProduct.material || ""}
                    onChange={(e) => updateProduct({ material: e.target.value })}
                    className="w-full px-3 py-2 border border-line-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-base font-medium text-ink-2 mb-1">Grammage (g/m²)</label>
                  <input
                    type="number"
                    value={localProduct.weight || 0}
                    onChange={(e) => updateProduct({ weight: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-line-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => {
                    resetClariprintQuote(); // Reset le prix Clariprint si on modifie
                    setActiveTab(null);
                  }}
                  className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                >
                  Sauvegarder et fermer
                </button>
              </div>
            </div>
          )}

          {/* ── Onglet Debug Clariprint ── */}
          {activeTab === "debug" && (
            <ProductCardDebug
              clariprintData={localProduct.clariprintData}
              lastRawResponse={lastRawResponse}
              clariprintLoading={clariprintLoading}
              onClose={() => setActiveTab(null)}
            />
          )}

          {/* Modal devis */}
          <QuoteModal
            isOpen={isQuoteModalOpen}
            onClose={() => setIsQuoteModalOpen(false)}
            product={{
              ...localProduct,
              price: displayPriceHT,
              clariprintQuote: clariprintQuote?.success ? clariprintQuote : undefined,
            }}
            onClientChange={(clientId) => updateProduct({ client_id: clientId })}
          />
        </div>
      )}

      {/* S2.4b — Overlay configuration produit (atelier deviseur).
          Bouton "Editer" ouvre cet overlay au lieu de l'ancien form inline.
          shop=null -> fallback brand Magrit + tenant_id 'atelier' (cf. ProductOverlay). */}
      <ProductOverlay
        product={
          overlayOpen
            ? ({
                id: localProduct.id ?? `atelier-${Date.now()}`,
                shop_id: 'atelier',
                product_id: null,
                name: localProduct.name ?? 'Produit',
                category: localProduct.clariprintData?.kind ?? 'Atelier',
                description: localProduct.description ?? '',
                price_ht: displayPriceHT,
                image_url: '',
                config: {
                  ...(localProduct as any),
                  clariprintData: localProduct.clariprintData ?? localProduct,
                },
                display_order: 0,
              } as ShopProduct)
            : null
        }
        shop={null}
        confirmLabel="Mettre à jour"
        onClose={() => setOverlayOpen(false)}
        onConfirm={(productConfigured) => {
          // Reinjecte la config Clariprint mise a jour dans le localProduct atelier
          const updatedClariprint = (productConfigured.config as any)?.clariprintData ?? {};
          const merged = {
            ...localProduct,
            ...updatedClariprint,
            price: productConfigured.price_ht,
            clariprintData: updatedClariprint,
          };
          setLocalProduct(merged);
          if (onProductUpdate) onProductUpdate(merged);
          setOverlayOpen(false);
        }}
      />
    </div>
  );
}