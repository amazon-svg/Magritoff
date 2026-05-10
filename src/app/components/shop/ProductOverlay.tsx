/**
 * ProductOverlay — Story S2.4 (Epic 2 Boutique B2B Premium).
 *
 * Panneau lateral droit (Sheet shadcn side=right, 420px desktop) pour
 * configurer un produit avant ajout au panier :
 *  - 6 <select> HTML natifs : format, papier, finition recto, finition verso,
 *    impression (recto / recto-verso), dorure
 *  - Quantite : <input type="number"> avec min/max (50/100000)
 *  - Mini mockup MockupImage parametrique (S4.3 + S4.2 templates)
 *  - Prix HT + TTC tabular-nums mono, recalcul en temps reel via
 *    httpAdapter.computePrice() (debounce 300ms, timeout 10s)
 *  - Gestion ClariprintError typee (S1.2) avec UI graceful (banner +
 *    fallback Prix marche, bouton Reessayer, jamais de spinner infini)
 *  - Footer sticky : Ajouter au panier / Annuler
 *
 * State machine : [idle] -> [loading] -> [ready] | [error]
 * Transitions : ouverture / change option (debounce) / retry / close.
 *
 * Wiring : appele par PortalCatalog quand l'acheteur clique le bouton
 * Configurer (testid product-card-configure-btn) sur une ShopProductCard.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import type { Shop, ShopProduct } from "../../contexts/ShopsContext";
import { TEST_IDS } from "../../lib/testIds";
import { ENABLE_OVERLAY_LIVE_RECALC } from "../../lib/featureFlags";
import { Sheet, SheetContent, SheetTitle } from "../ui/sheet";
import { MockupImage } from "../mockup/MockupImage";
import {
  ClariprintError,
  ClariprintHttpAdapter,
} from "../../../server/clariprint/ClariprintAdapter";
import { estimateMarketPriceHT } from "../../utils/priceResolver";
import {
  resolveMockupTemplate,
  resolveProductDimensions,
} from "./ShopProductCard.helpers";
import {
  buildClariprintPayload,
  extractInitialOptions,
  formatEuro,
  type ConfigOptions,
  DORURES,
  FINISHINGS,
  FORMATS,
  PAPERS,
  PRINTINGS,
  QUANTITIES,
} from "./ProductOverlay.helpers";

const httpAdapter = new ClariprintHttpAdapter();
const COMPUTE_PRICE_TIMEOUT_MS = 10_000;
const RECALC_DEBOUNCE_MS = 300;

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; priceHT: number; priceTTC: number; isMarketPrice?: boolean }
  | {
      kind: "error";
      errorKind: ClariprintError["kind"] | "unknown";
      message: string;
      fallbackPriceHT?: number;
      fallbackPriceTTC?: number;
    };

export interface ProductOverlayProps {
  product: ShopProduct | null;
  /** Boutique consommatrice (theming + tenant scoping mockup). Optionnel : fallback brand Magrit + tenant_id 'atelier' si absent (cas atelier deviseur S2.4b). */
  shop?: Shop | null;
  onClose: () => void;
  /** Callback de validation : "Ajouter au panier" boutique OU "Mettre a jour" atelier. */
  onConfirm: (productConfigured: ShopProduct, qty: number) => void;
  /** Libelle du bouton primary. Default "Ajouter au panier" (boutique). Atelier passe "Mettre a jour". */
  confirmLabel?: string;
}

const DEFAULT_BRAND_PRIMARY = "#1e3a8a"; // brand Magrit fallback hors contexte boutique
const ATELIER_TENANT_FALLBACK = "atelier";
const ATELIER_SHOP_FALLBACK = "atelier";

export function ProductOverlay({
  product,
  shop,
  onClose,
  onConfirm,
  confirmLabel = "Ajouter au panier",
}: ProductOverlayProps) {
  const open = product !== null;

  // Reset state quand product change (ouverture/fermeture/changement)
  const [options, setOptions] = useState<ConfigOptions>(() =>
    product ? extractInitialOptions(product) : extractInitialOptions({ config: {} } as ShopProduct),
  );
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  // Reinitialise les options + phase quand le produit change
  useEffect(() => {
    if (product) {
      setOptions(extractInitialOptions(product));
      setPhase({ kind: "idle" });
    }
  }, [product?.id]);

  // Recalcul prix : initial a l'ouverture + a chaque change d'option (debounce)
  const lastComputeRef = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!product) return;
    if (!ENABLE_OVERLAY_LIVE_RECALC && phase.kind !== "idle") return;

    const debounceId = setTimeout(() => {
      // Annuler la requete precedente si encore en vol
      if (lastComputeRef.current) {
        lastComputeRef.current.abort();
      }
      const controller = new AbortController();
      lastComputeRef.current = controller;
      const timeoutId = setTimeout(
        () => controller.abort(),
        COMPUTE_PRICE_TIMEOUT_MS,
      );

      setPhase({ kind: "loading" });

      const payload = buildClariprintPayload(options, product.config);

      httpAdapter
        .computePrice({ clariprint: payload })
        .then((quote) => {
          if (controller.signal.aborted) return;
          if (quote.success && typeof quote.priceHT === "number") {
            setPhase({
              kind: "ready",
              priceHT: quote.priceHT,
              priceTTC: quote.priceHT * 1.2,
            });
          } else {
            // success=false suite a sanitization (cf. validateClariprintResponse)
            const fallback = estimateMarketPriceHT(product);
            setPhase({
              kind: "error",
              errorKind: "undefined_field",
              message: "Prix indisponible — utilisation du Prix marché",
              fallbackPriceHT: fallback,
              fallbackPriceTTC: fallback * 1.2,
            });
          }
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          const errorKind: ClariprintError["kind"] | "unknown" =
            err instanceof ClariprintError ? err.kind : "unknown";

          if (
            errorKind === "negative_price" ||
            errorKind === "nan_price" ||
            errorKind === "undefined_field"
          ) {
            const fallback = estimateMarketPriceHT(product);
            setPhase({
              kind: "error",
              errorKind,
              message: "Prix indisponible — utilisation du Prix marché",
              fallbackPriceHT: fallback,
              fallbackPriceTTC: fallback * 1.2,
            });
          } else if (errorKind === "missing_required_product") {
            setPhase({
              kind: "error",
              errorKind,
              message: "Configuration non disponible chez cet imprimeur",
            });
          } else {
            setPhase({
              kind: "error",
              errorKind,
              message: "Erreur réseau — réessayez",
            });
          }
        })
        .finally(() => {
          clearTimeout(timeoutId);
        });
    }, RECALC_DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceId);
    };
  }, [product?.id, options]);

  const retry = () => {
    // Force un re-trigger : on reset phase a idle puis l'effet recalcule
    setPhase({ kind: "idle" });
    setOptions((o) => ({ ...o })); // shallow copy pour declencher useEffect
  };

  const handleAdd = () => {
    if (!product) return;
    const finalPriceHT =
      phase.kind === "ready"
        ? phase.priceHT
        : phase.kind === "error"
          ? phase.fallbackPriceHT ?? product.price_ht
          : product.price_ht;
    const productConfigured: ShopProduct = {
      ...product,
      price_ht: finalPriceHT,
      config: {
        ...(product.config as Record<string, unknown>),
        clariprintData: buildClariprintPayload(options, product.config),
      },
    };
    onConfirm(productConfigured, options.quantity);
    onClose();
  };

  // Determine si on bloque l'ajout au panier (cas missing_required_product)
  const addDisabled =
    phase.kind === "error" && phase.errorKind === "missing_required_product";

  // Mini mockup props (memoise pour eviter recreation a chaque render).
  // S2.4b : shop optionnel -> fallbacks atelier (tenant_id='atelier', shop_id='atelier',
  // primaryColor=brand Magrit). Le mockup engine accepte ces sentinelles ;
  // le cache CDN se construira sous {atelier}/{atelier}/{productId}.png.
  const mockupProps = useMemo(() => {
    if (!product) return null;
    const dims = resolveProductDimensions(product);
    const template = resolveMockupTemplate(product);
    const tenantNamespace =
      (shop as (Shop & { tenant_id?: string }) | null | undefined)?.tenant_id ??
      shop?.id ??
      ATELIER_TENANT_FALLBACK;
    const shopId = shop?.id ?? ATELIER_SHOP_FALLBACK;
    const primaryColor = shop?.theme?.primaryColor ?? DEFAULT_BRAND_PRIMARY;
    return {
      tenantId: tenantNamespace,
      shopId,
      productId: product.id,
      width: dims.width,
      height: dims.height,
      productName: product.name,
      primaryColor,
      template,
      alt: `Mockup ${product.name}`,
    };
  }, [product, shop]);

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent
        side="right"
        data-testid={TEST_IDS.shop.productOverlay}
        className="w-full sm:w-[420px] sm:max-w-[420px] flex flex-col p-0"
      >
        {product && mockupProps && (
          <>
            {/* Header sticky */}
            <div className="px-5 pt-5 pb-3 border-b border-line">
              <SheetTitle className="text-[15px] font-medium text-ink m-0">
                {product.name}
              </SheetTitle>
              <p
                className="text-ink-muted m-0 mt-1"
                style={{ fontSize: "12px", fontWeight: 400 }}
              >
                Configurez puis ajoutez au panier
              </p>
            </div>

            {/* Body scrollable */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
              {/* Mini mockup */}
              <div
                className="aspect-[4/3] overflow-hidden rounded-lg"
                style={{ background: "#F5F5F5" }}
              >
                <MockupImage {...mockupProps} className="w-full h-full" />
              </div>

              {/* Bloc options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <OverlayField label="Quantité">
                  <input
                    type="number"
                    data-testid={TEST_IDS.shop.overlayOptionQuantity}
                    min={50}
                    max={100000}
                    step={options.quantity < 1000 ? 50 : 500}
                    value={options.quantity}
                    onChange={(e) =>
                      setOptions((o) => ({
                        ...o,
                        quantity: Math.max(
                          50,
                          Math.min(100000, parseInt(e.target.value, 10) || 50),
                        ),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-md border border-line-2 bg-paper text-ink text-[13px] focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </OverlayField>

                <OverlayField label="Format">
                  <select
                    data-testid={TEST_IDS.shop.overlayOptionFormat}
                    value={options.format}
                    onChange={(e) =>
                      setOptions((o) => ({ ...o, format: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-md border border-line-2 bg-paper text-ink text-[13px] focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {FORMATS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </OverlayField>

                {options.format === "Custom" && (
                  <>
                    <OverlayField label="Largeur (mm)">
                      <input
                        type="number"
                        min={10}
                        max={2000}
                        value={options.customWidth ?? 100}
                        onChange={(e) =>
                          setOptions((o) => ({
                            ...o,
                            customWidth: parseInt(e.target.value, 10) || 100,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-md border border-line-2 bg-paper text-ink text-[13px] focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </OverlayField>
                    <OverlayField label="Hauteur (mm)">
                      <input
                        type="number"
                        min={10}
                        max={2000}
                        value={options.customHeight ?? 100}
                        onChange={(e) =>
                          setOptions((o) => ({
                            ...o,
                            customHeight: parseInt(e.target.value, 10) || 100,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-md border border-line-2 bg-paper text-ink text-[13px] focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </OverlayField>
                  </>
                )}

                <OverlayField label="Papier">
                  <select
                    data-testid={TEST_IDS.shop.overlayOptionPaper}
                    value={options.paper}
                    onChange={(e) =>
                      setOptions((o) => ({ ...o, paper: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-md border border-line-2 bg-paper text-ink text-[13px] focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {PAPERS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </OverlayField>

                <OverlayField label="Impression">
                  <select
                    data-testid={TEST_IDS.shop.overlayOptionPrinting}
                    value={options.printing}
                    onChange={(e) =>
                      setOptions((o) => ({
                        ...o,
                        printing: e.target.value as ConfigOptions["printing"],
                      }))
                    }
                    className="w-full px-3 py-2 rounded-md border border-line-2 bg-paper text-ink text-[13px] focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {PRINTINGS.map((p) => (
                      <option key={p} value={p}>
                        {p === "recto" ? "Recto" : "Recto-verso"}
                      </option>
                    ))}
                  </select>
                </OverlayField>

                <OverlayField label="Finition recto">
                  <select
                    data-testid={TEST_IDS.shop.overlayOptionFinishingFront}
                    value={options.finishingFront}
                    onChange={(e) =>
                      setOptions((o) => ({
                        ...o,
                        finishingFront: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-md border border-line-2 bg-paper text-ink text-[13px] focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {FINISHINGS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </OverlayField>

                {options.printing === "recto-verso" && (
                  <OverlayField label="Finition verso">
                    <select
                      data-testid={TEST_IDS.shop.overlayOptionFinishingVerso}
                      value={options.finishingVerso}
                      onChange={(e) =>
                        setOptions((o) => ({
                          ...o,
                          finishingVerso: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-md border border-line-2 bg-paper text-ink text-[13px] focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      {FINISHINGS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </OverlayField>
                )}

                <OverlayField label="Dorure">
                  <select
                    data-testid={TEST_IDS.shop.overlayOptionDorure}
                    value={options.dorure}
                    onChange={(e) =>
                      setOptions((o) => ({ ...o, dorure: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-md border border-line-2 bg-paper text-ink text-[13px] focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {DORURES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </OverlayField>
              </div>

              {/* Banner erreur si phase=error */}
              {phase.kind === "error" && (
                <div
                  data-testid={TEST_IDS.shop.overlayErrorBanner}
                  className="flex items-start gap-2 px-3 py-2.5 rounded-md bg-warn-bg border border-warn-fg/20 text-warn-fg"
                  style={{ fontSize: "12.5px", fontWeight: 400 }}
                >
                  <AlertTriangle
                    className="w-4 h-4 shrink-0 mt-0.5"
                    strokeWidth={1.5}
                  />
                  <div className="flex-1">
                    <p className="m-0">{phase.message}</p>
                    {(phase.errorKind === "network" ||
                      phase.errorKind === "timeout" ||
                      phase.errorKind === "unknown") && (
                      <button
                        type="button"
                        data-testid={TEST_IDS.shop.overlayRetryBtn}
                        onClick={retry}
                        className="inline-flex items-center gap-1.5 mt-1.5 text-warn-fg hover:underline"
                        style={{ fontSize: "12px", fontWeight: 500 }}
                      >
                        <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
                        Réessayer
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer sticky : prix + actions */}
            <div className="border-t border-line bg-paper px-5 py-4 flex flex-col gap-3">
              <div
                aria-live="polite"
                aria-atomic="true"
                className="flex items-baseline justify-between"
              >
                <span
                  className="text-ink-muted"
                  style={{ fontSize: "12px", fontWeight: 400 }}
                >
                  Prix HT / TTC
                  {phase.kind === "loading" && (
                    <span
                      data-testid={TEST_IDS.shop.overlayPriceLoading}
                      className="ml-2 inline-flex items-center gap-1 text-ink-mute-2"
                    >
                      <Loader2
                        className="w-3 h-3 animate-spin"
                        strokeWidth={1.5}
                      />
                      Recalcul...
                    </span>
                  )}
                  {phase.kind === "error" && phase.fallbackPriceHT != null && (
                    <span
                      className="ml-2 font-mono uppercase text-warn-fg"
                      style={{ fontSize: "9.5px", letterSpacing: "0.06em" }}
                    >
                      ⚠️ ESTIMATION
                    </span>
                  )}
                </span>
                <div
                  data-testid={TEST_IDS.shop.overlayPriceDisplay}
                  className="text-right"
                >
                  <div
                    className="font-mono text-ink"
                    style={{
                      fontSize: "18px",
                      fontWeight: 500,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {phase.kind === "ready"
                      ? formatEuro(phase.priceHT)
                      : phase.kind === "error" && phase.fallbackPriceHT != null
                        ? formatEuro(phase.fallbackPriceHT)
                        : phase.kind === "loading"
                          ? "—"
                          : formatEuro(product.price_ht)}
                  </div>
                  <div
                    className="font-mono text-ink-muted"
                    style={{
                      fontSize: "11.5px",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {phase.kind === "ready"
                      ? `${formatEuro(phase.priceTTC)} TTC`
                      : phase.kind === "error" && phase.fallbackPriceTTC != null
                        ? `${formatEuro(phase.fallbackPriceTTC)} TTC`
                        : phase.kind === "loading"
                          ? "—"
                          : `${formatEuro(product.price_ht * 1.2)} TTC`}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid={TEST_IDS.shop.overlayCancelBtn}
                  onClick={onClose}
                  className="flex-1 px-3 py-2 rounded-md border border-line-2 bg-paper text-ink hover:bg-bg transition-colors"
                  style={{ fontSize: "13px", fontWeight: 500 }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  data-testid={TEST_IDS.shop.overlayAddBtn}
                  onClick={handleAdd}
                  disabled={addDisabled}
                  className="flex-[2] px-3 py-2 rounded-md bg-ink text-paper hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontSize: "13px", fontWeight: 500 }}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function OverlayField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="font-mono uppercase text-ink-mute-2"
        style={{ fontSize: "10px", letterSpacing: "0.08em", fontWeight: 500 }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
