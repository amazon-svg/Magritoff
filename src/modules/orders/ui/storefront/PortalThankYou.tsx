/**
 * PortalThankYou — Page de confirmation commande boutique B2B.
 *
 * Story S-CONSO-3 (Sprint 4 Phase 2, 2026-05-18, UX Sally validee).
 *
 * Affichee post-submitCart() (S-MIGRATION-ORDERS, ADR-ORDERS-1) :
 * page dediee plutot que alert/toast, artefact visuel persistant pour
 * persona B2B (screenshot, transfert compta).
 *
 * Lit le détail depuis l API Orders par order_id passé en prop. Idempotent au
 * refresh (si order_id state est perdu, redirect
 * vers catalog naturellement via fallback dans PublicShop).
 */

import { useEffect, useRef } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { applyTax } from "@/modules/orders/ui/helpers/tax";
import { TEST_IDS } from "@/shared/presentation/testIds";
import { useStorefrontOrderReceipt } from "@/modules/orders/ui/hooks/useStorefrontOrderReceipt";

interface Props {
  orderId: string;
  taxRate: number;
  userEmail: string;
  onBackToCatalog: () => void;
  onSeeOrders: () => void;
}

/**
 * Helper pur : format des 8 premiers chars de l UUID en uppercase pour
 * usage business (reference commande lisible). Exportable pour testabilite.
 */
export function formatShortOrderId(orderId: string): string {
  if (!orderId || typeof orderId !== "string") return "—";
  return orderId.slice(0, 8).toUpperCase();
}

function formatEuro(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDateLong(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      dateStyle: "long",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function PortalThankYou({ orderId, taxRate, userEmail, onBackToCatalog, onSeeOrders }: Props) {
  const { order, loading, error } = useStorefrontOrderReceipt(orderId);
  const h1Ref = useRef<HTMLHeadingElement | null>(null);

  // A11y : focus auto sur h1 au mount pour annoncer la confirmation au SR
  useEffect(() => {
    h1Ref.current?.focus();
  }, []);

  const shortId = formatShortOrderId(orderId);
  const totalTtc = order?.totalHt ? applyTax(order.totalHt, taxRate) : 0;

  return (
    <div
      data-testid={TEST_IDS.shop.thankYouPage}
      className="mx-auto max-w-2xl px-6 py-16"
      style={{ fontFamily: "var(--font-ui)" }}
    >
      {/* Bloc confirmation principal, role=status + aria-live pour SR */}
      <div role="status" aria-live="polite" className="text-center">
        <CheckCircle2
          className="mx-auto h-16 w-16 text-ok-fg"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <h1
          ref={h1Ref}
          tabIndex={-1}
          className="mt-5 text-ink m-0 outline-none focus:outline-none"
          style={{ fontSize: "28px", fontWeight: 300, letterSpacing: "-0.025em" }}
        >
          Commande confirmée
        </h1>
        <p
          className="mt-2 text-ink-muted font-mono"
          style={{ fontSize: "13.5px", fontVariantNumeric: "tabular-nums" }}
        >
          Référence #{shortId}
        </p>
      </div>

      {loading && (
        <div className="mt-8 flex items-center justify-center gap-2 text-ink-muted">
          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
          <span style={{ fontSize: "13px" }}>Chargement…</span>
        </div>
      )}

      {error && !loading && (
        <div className="mt-8 px-3.5 py-2.5 rounded-lg bg-warn-bg border border-warn-fg/20 text-warn-fg text-center" style={{ fontSize: "13px" }}>
          {error}. Vous pouvez retourner au catalogue.
        </div>
      )}

      {!loading && !error && order && (
        <>
          {/* Bandeau info email confirmation */}
          <div
            className="mt-8 px-4 py-3 rounded-lg bg-bg border border-line text-ink-2 text-center"
            style={{ fontSize: "13px", fontWeight: 400 }}
          >
            Un email de confirmation sera envoyé prochainement à{" "}
            <span className="font-mono text-ink">{userEmail || "—"}</span>.
          </div>

          {/* Recap commande */}
          <div className="mt-8 border-t border-line pt-6">
            <div className="flex justify-between items-baseline mb-4">
              <span
                className="font-mono uppercase text-ink-mute-2"
                style={{ fontSize: "10.5px", letterSpacing: "0.08em", fontWeight: 500 }}
              >
                Date
              </span>
              <span className="text-ink font-mono" style={{ fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>
                {formatDateLong(order.createdAt)}
              </span>
            </div>

            <div className="space-y-2 mb-6">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between items-baseline">
                  <span className="text-ink" style={{ fontSize: "14px" }}>
                    {item.productLabel}{" "}
                    <span className="text-ink-mute-2" style={{ fontSize: "12px" }}>
                      × {item.quantity}
                    </span>
                  </span>
                  <span className="text-ink-2 font-mono" style={{ fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>
                    {formatEuro(item.lineTotalHt)} HT
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-line pt-4 flex justify-between items-baseline">
              <span className="text-ink" style={{ fontSize: "14px", fontWeight: 500 }}>
                Total TTC
              </span>
              <span className="text-ink font-mono" style={{ fontSize: "18px", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                {formatEuro(totalTtc)}
              </span>
            </div>
          </div>
        </>
      )}

      {/* CTAs (toujours visibles, meme si error) */}
      <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
        <button
          data-testid={TEST_IDS.shop.thankYouCtaCatalog}
          onClick={onBackToCatalog}
          className="px-5 py-2.5 rounded-md bg-ink text-paper hover:bg-black transition-colors focus-visible:ring-2 focus-visible:ring-ink-mute-2"
          style={{ fontSize: "14px", fontWeight: 500 }}
        >
          Retour catalogue
        </button>
        <button
          data-testid={TEST_IDS.shop.thankYouCtaOrders}
          onClick={onSeeOrders}
          className="px-5 py-2.5 rounded-md bg-paper text-ink border border-line hover:bg-bg transition-colors focus-visible:ring-2 focus-visible:ring-ink-mute-2"
          style={{ fontSize: "14px", fontWeight: 500 }}
        >
          Voir mes commandes
        </button>
      </div>
    </div>
  );
}
