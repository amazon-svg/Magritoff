import { useEffect, useState } from "react";
import {
  Loader2, Lock,
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
import { useTenant } from "../contexts/TenantContext";
import { getTaxRate } from "../utils/tax";
import { useClariprintProduct } from "../hooks/useClariprintProduct";
import { ProductCard3D } from "./product-card/ProductCard3D";
import { ProductCardDebug } from "./product-card/ProductCardDebug";
import { ProductCardEditer } from "./product-card/ProductCardEditer";
import { ProductCardFiche } from "./product-card/ProductCardFiche";
import { ProductCardPrix } from "./product-card/ProductCardPrix";
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

          {/* ── Fiche produit ── (R1-bis : extrait dans ProductCardFiche.tsx) */}
          {activeTab === "sheet" && (
            <ProductCardFiche
              localProduct={localProduct}
              enriched={enriched}
              clients={clients}
              onClose={() => setActiveTab(null)}
            />
          )}

          {/* ── Prix & Devis ── (R1-bis : extrait dans ProductCardPrix.tsx) */}
          {activeTab === "pricing" && (
            <ProductCardPrix
              localProduct={localProduct}
              displayPriceHT={displayPriceHT}
              taxRate={taxRate}
              user={user}
              clariprintQuote={clariprintQuote}
              clariprintLoading={clariprintLoading}
              lastRawResponse={lastRawResponse}
              onCompute={computeClariprintQuote}
              onOpenQuoteModal={() => setIsQuoteModalOpen(true)}
              onClose={() => setActiveTab(null)}
            />
          )}

          {/* ── Mockup & 3D ── (R1 Phase B : extrait dans ProductCard3D.tsx) */}
          {activeTab === "mockup" && <ProductCard3D onClose={() => setActiveTab(null)} />}

          {/* ── Formulaire d'édition ── (R1-bis : extrait dans ProductCardEditer.tsx) */}
          {activeTab === "form" && (
            <ProductCardEditer
              localProduct={localProduct}
              clients={clients}
              user={user}
              tp={tp}
              updateProduct={updateProduct}
              resetClariprintQuote={resetClariprintQuote}
              onClose={() => setActiveTab(null)}
            />
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
