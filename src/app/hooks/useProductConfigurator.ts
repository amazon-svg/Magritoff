/**
 * S7.2 — Hook useProductConfigurator (Epic 7 gabarit boutique v2).
 *
 * MOTEUR UNIQUE de configuration/prix produit (garde-fou n°1 de l'itération,
 * spec UX § Component Strategy) : extrait de ProductOverlay (S2.4), consommé
 * par l'overlay ET par la page gamme (S7.3). Aucune logique de prix ne doit
 * être dupliquée en dehors de ce fichier.
 *
 * Machine à états : [idle] -> [loading] -> [ready] | [error]
 *  - recalcul debounce 300 ms, timeout 10 s, AbortController anti-course ;
 *  - erreurs Clariprint typées (S1.2) -> repli Prix marché estimé
 *    (`estimateMarketPriceHT`, quantité courante) sauf missing_required_product ;
 *  - `confirm()` matérialise le produit configuré (prix final + payload
 *    clariprintData) sans effet de bord UI.
 *
 * Les helpers computeSuccessPhase / computeErrorPhase / resolveFinalPriceHT /
 * buildConfiguredProduct / isAddDisabled sont PURS et testés unitairement
 * (tests/hooks/useProductConfigurator.test.ts).
 */

import { useEffect, useRef, useState } from "react";
import type { ShopProduct } from "../contexts/ShopsContext";
import { ENABLE_OVERLAY_LIVE_RECALC } from "../lib/featureFlags";
import {
  ClariprintError,
  ClariprintHttpAdapter,
} from "../../server/clariprint/ClariprintAdapter";
import { estimateMarketPriceHT } from "../utils/priceResolver";
import {
  buildClariprintPayload,
  extractInitialOptions,
  type ConfigOptions,
} from "../components/shop/ProductOverlay.helpers";
import { useTenant } from "../contexts/TenantContext";
import { applyTax, getTaxRate } from "../utils/tax";
import { DEFAULT_CURRENCY, type CurrencyCode } from "../utils/currency";
import { useCurrency } from "../contexts/CurrencyContext";

const httpAdapter = new ClariprintHttpAdapter();
export const COMPUTE_PRICE_TIMEOUT_MS = 10_000;
export const RECALC_DEBOUNCE_MS = 300;

export type ConfiguratorPhase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; priceHT: number; priceTTC: number }
  | {
      kind: "error";
      errorKind: ClariprintError["kind"] | "unknown";
      message: string;
      fallbackPriceHT?: number;
      fallbackPriceTTC?: number;
    };

/** Résultat computePrice minimal dont dépend la machine (découplage tests). */
export interface ComputeQuoteLike {
  success: boolean;
  priceHT?: unknown;
}

/** Phase issue d'une réponse computePrice (succès transport). PURE. */
export function computeSuccessPhase(
  quote: ComputeQuoteLike,
  product: ShopProduct,
  quantity: number,
  taxRate: number,
  /** Devise de l imprimeur — zone monetaire du repli Prix marche. */
  currency: CurrencyCode = DEFAULT_CURRENCY,
): ConfiguratorPhase {
  if (quote.success && typeof quote.priceHT === "number") {
    return {
      kind: "ready",
      priceHT: quote.priceHT,
      priceTTC: applyTax(quote.priceHT, taxRate),
    };
  }
  // success=false suite a sanitization (cf. validateClariprintResponse)
  const fallback = estimateMarketPriceHT(product, quantity, currency);
  return {
    kind: "error",
    errorKind: "undefined_field",
    message: "Prix indisponible — utilisation du Prix marché",
    fallbackPriceHT: fallback,
    fallbackPriceTTC: applyTax(fallback, taxRate),
  };
}

/** Phase issue d'une erreur computePrice (typée Clariprint ou réseau). PURE. */
export function computeErrorPhase(
  errorKind: ClariprintError["kind"] | "unknown",
  product: ShopProduct,
  quantity: number,
  taxRate: number,
  /** Devise de l imprimeur — zone monetaire du repli Prix marche. */
  currency: CurrencyCode = DEFAULT_CURRENCY,
): ConfiguratorPhase {
  if (
    errorKind === "negative_price" ||
    errorKind === "nan_price" ||
    errorKind === "undefined_field"
  ) {
    const fallback = estimateMarketPriceHT(product, quantity, currency);
    return {
      kind: "error",
      errorKind,
      message: "Prix indisponible — utilisation du Prix marché",
      fallbackPriceHT: fallback,
      fallbackPriceTTC: applyTax(fallback, taxRate),
    };
  }
  if (errorKind === "missing_required_product") {
    return {
      kind: "error",
      errorKind,
      message: "Configuration non disponible chez cet imprimeur",
    };
  }
  // Erreur reseau / timeout : estimation Prix marché à la quantité choisie
  // (sinon le prix retombait sur product.price_ht fige a la qte par defaut).
  const fallback = estimateMarketPriceHT(product, quantity, currency);
  return {
    kind: "error",
    errorKind,
    message: "Erreur réseau — Prix marché estimé (réessayez)",
    fallbackPriceHT: fallback,
    fallbackPriceTTC: applyTax(fallback, taxRate),
  };
}

/** Cascade prix final : ready > fallback estimation > prix catalogue. PURE. */
export function resolveFinalPriceHT(
  phase: ConfiguratorPhase,
  product: ShopProduct,
): number {
  if (phase.kind === "ready") return phase.priceHT;
  if (phase.kind === "error" && phase.fallbackPriceHT != null) {
    return phase.fallbackPriceHT;
  }
  return product.price_ht;
}

/** Produit configuré prêt pour le panier (prix final + payload). PURE. */
export function buildConfiguredProduct(
  product: ShopProduct,
  options: ConfigOptions,
  phase: ConfiguratorPhase,
): ShopProduct {
  return {
    ...product,
    price_ht: resolveFinalPriceHT(phase, product),
    config: {
      ...(product.config as Record<string, unknown>),
      clariprintData: buildClariprintPayload(options, product.config),
    },
  } as ShopProduct;
}

/** Ajout au panier bloqué : produit indisponible chez l'imprimeur. PURE. */
export function isAddDisabled(phase: ConfiguratorPhase): boolean {
  return (
    phase.kind === "error" && phase.errorKind === "missing_required_product"
  );
}

export interface UseProductConfiguratorOpts {
  /**
   * Recalcule à chaque changement d'option (page gamme S7.3 : true).
   * Défaut : flag ENABLE_OVERLAY_LIVE_RECALC (comportement overlay historique
   * — sans le flag, seul le calcul initial est joué).
   */
  liveRecalc?: boolean;
}

export interface UseProductConfiguratorResult {
  options: ConfigOptions;
  setOptions: React.Dispatch<React.SetStateAction<ConfigOptions>>;
  /** Patch partiel pratique pour les selects. */
  patchOptions: (patch: Partial<ConfigOptions>) => void;
  phase: ConfiguratorPhase;
  /** Relance le calcul (reset idle + retrigger effet). */
  retry: () => void;
  /** Produit configuré au prix final courant + quantité choisie. */
  confirm: () => { productConfigured: ShopProduct; qty: number } | null;
  addDisabled: boolean;
  taxRate: number;
}

export function useProductConfigurator(
  product: ShopProduct | null,
  opts: UseProductConfiguratorOpts = {},
): UseProductConfiguratorResult {
  const liveRecalc = opts.liveRecalc ?? ENABLE_OVERLAY_LIVE_RECALC;
  const { currentTenant } = useTenant();
  const taxRate = getTaxRate(currentTenant);
  // Multi-devise tranche 1 : la devise selectionne la ZONE MONETAIRE du repli
  // Prix marche (arbitrage Arnaud 2026-08-10). Sans zone calibree, le repli
  // vaut 0 et l ecran affiche « Prix sur demande ».
  const currency = useCurrency();

  const [options, setOptions] = useState<ConfigOptions>(() =>
    product
      ? extractInitialOptions(product)
      : extractInitialOptions({ config: {} } as ShopProduct),
  );
  const [phase, setPhase] = useState<ConfiguratorPhase>({ kind: "idle" });

  // Réinitialise options + phase quand le produit change
  useEffect(() => {
    if (product) {
      setOptions(extractInitialOptions(product));
      setPhase({ kind: "idle" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  // Recalcul prix : initial + à chaque changement d'option (debounce)
  const lastComputeRef = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!product) return;
    if (!liveRecalc && phase.kind !== "idle") return;

    const debounceId = setTimeout(() => {
      if (lastComputeRef.current) lastComputeRef.current.abort();
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
          setPhase(
            computeSuccessPhase(quote, product, options.quantity, taxRate, currency),
          );
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          const errorKind: ClariprintError["kind"] | "unknown" =
            err instanceof ClariprintError ? err.kind : "unknown";
          setPhase(
            computeErrorPhase(errorKind, product, options.quantity, taxRate, currency),
          );
        })
        .finally(() => {
          clearTimeout(timeoutId);
        });
    }, RECALC_DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, options]);

  const retry = () => {
    // Force un re-trigger : phase idle puis shallow copy pour relancer l'effet
    setPhase({ kind: "idle" });
    setOptions((o) => ({ ...o }));
  };

  const patchOptions = (patch: Partial<ConfigOptions>) =>
    setOptions((o) => ({ ...o, ...patch }));

  const confirm = () => {
    if (!product) return null;
    return {
      productConfigured: buildConfiguredProduct(product, options, phase),
      qty: options.quantity,
    };
  };

  return {
    options,
    setOptions,
    patchOptions,
    phase,
    retry,
    confirm,
    addDisabled: isAddDisabled(phase),
    taxRate,
  };
}
