/**
 * S7.12 — CheckoutPage : ≤ 2 écrans entre panier et confirmation (ADR §4.20).
 *
 * Une seule route `/checkout`, deux blocs :
 *  - sans session boutique → identification via le BFF storefront ;
 *  - loggé → Récap (packs forfaitaires S-FIX-PANIER, totaux HT/TVA/TTC) +
 *    « Commander » → submitCart existant → PortalThankYou.
 * Erreurs inline, jamais de modal (Feedback Patterns spec UX).
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Shop } from '../../../contexts/ShopsContext';
import type { CartLine } from './types';
import { applyTax } from '../../../utils/tax';
import { formatEuro } from '../ProductOverlay.helpers';
import { TEST_IDS } from '../../../lib/testIds';
import type { StorefrontSession } from '../../../../modules/shop-customers';
import { StorefrontLoginForm } from '../StorefrontLoginForm';

export interface CheckoutPageProps {
  shop: Shop;
  cart: CartLine[];
  taxRate: number;
  canCreateOrder: boolean;
  createOrderBlockedMessage: string;
  storefrontSession: StorefrontSession | null;
  onStorefrontAuthenticated(session: StorefrontSession): void;
  /** Soumet la commande (submitCart PublicShop) — navigue vers ThankYou. */
  onSubmit: () => Promise<void> | void;
  onGoCatalog: () => void;
}

export function CheckoutPage({
  shop,
  cart,
  taxRate,
  canCreateOrder,
  createOrderBlockedMessage,
  storefrontSession,
  onStorefrontAuthenticated,
  onSubmit,
  onGoCatalog,
}: CheckoutPageProps) {
  const hasStorefrontSession = storefrontSession?.identity.shopId === shop.id;
  const [submitting, setSubmitting] = useState(false);

  const totalHT = cart.reduce((s, l) => s + l.product.price_ht * l.qty, 0);
  const totalTTC = applyTax(totalHT, taxRate);

  if (cart.length === 0) {
    return (
      <div className="px-5 lg:px-9 py-10 text-center">
        <p className="text-ink-muted m-0 mb-3" style={{ fontSize: '13.5px' }}>
          Votre panier est vide.
        </p>
        <button
          type="button"
          onClick={onGoCatalog}
          className="px-4 py-2 rounded-md bg-ink text-paper hover:bg-black transition-colors"
          style={{ fontSize: '13px', fontWeight: 500 }}
        >
          Parcourir le catalogue
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid={TEST_IDS.shop.checkoutPage}
      className="px-5 lg:px-9 py-6 grid grid-cols-1 lg:grid-cols-5 gap-6 items-start"
    >
      <div className="lg:col-span-3 flex flex-col gap-4">
        <h1
          className="text-ink m-0"
          style={{ fontSize: '24px', fontWeight: 300, letterSpacing: '-0.02em' }}
        >
          {hasStorefrontSession ? 'Récapitulatif de votre commande' : 'Identifiez-vous pour commander'}
        </h1>

        {!hasStorefrontSession && (
          <CheckoutIdentification shop={shop} onAuthenticated={onStorefrontAuthenticated} />
        )}

        {/* Récap lignes (toujours visible : l'acheteur voit ce qu'il commande) */}
        <div className="bg-paper border border-line rounded-xl overflow-hidden">
          {cart.map((l) => {
            const qtyEx = Number(
              (l.product.config as Record<string, unknown> | undefined)?.quantity ?? l.qty,
            );
            return (
              <div
                key={l.product.id}
                className="flex items-baseline justify-between gap-4 px-4 py-3 border-b border-line last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-ink m-0 truncate" style={{ fontSize: '13.5px', fontWeight: 500 }}>
                    {l.product.name}
                  </p>
                  <p className="text-ink-muted m-0" style={{ fontSize: '12px' }}>
                    {qtyEx.toLocaleString('fr-FR')} exemplaire{qtyEx > 1 ? 's' : ''}
                    {l.qty > 1 ? ` × ${l.qty} packs` : ''}
                  </p>
                </div>
                <span
                  className="font-mono text-ink shrink-0"
                  style={{ fontSize: '13.5px', fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatEuro(l.product.price_ht * l.qty)} HT
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Totaux + CTA */}
      <div className="lg:col-span-2 lg:sticky lg:top-4 bg-paper border border-line rounded-xl p-4 flex flex-col gap-3">
        <Row label="Sous-total HT" value={formatEuro(totalHT)} />
        <Row label={`TVA (${Math.round(taxRate * 100)} %)`} value={formatEuro(totalTTC - totalHT)} />
        <div className="border-t border-line pt-2">
          <Row label="Total TTC" value={formatEuro(totalTTC)} strong />
        </div>
        <button
          type="button"
          data-testid={TEST_IDS.shop.checkoutSubmitBtn}
          disabled={!hasStorefrontSession || !canCreateOrder || submitting}
          onClick={async () => {
            setSubmitting(true);
            try {
              await onSubmit();
            } finally {
              setSubmitting(false);
            }
          }}
          className="mt-1 px-4 py-2.5 rounded-md bg-ink text-paper hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          style={{ fontSize: '13.5px', fontWeight: 500 }}
        >
          {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />}
          Commander
        </button>
        {!hasStorefrontSession && (
          <p className="text-ink-mute-2 m-0 text-center" style={{ fontSize: '11.5px' }}>
            Identifiez-vous ci-contre pour valider la commande.
          </p>
        )}
        {hasStorefrontSession && !canCreateOrder && (
          <p
            data-testid={TEST_IDS.shop.cartNoCreateOrderHint}
            className="m-0 text-center text-err-fg"
            style={{ fontSize: '11.5px', lineHeight: 1.45 }}
          >
            {createOrderBlockedMessage}
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-ink-muted" style={{ fontSize: '12.5px' }}>
        {label}
      </span>
      <span
        className="font-mono text-ink"
        style={{ fontSize: strong ? '16px' : '13px', fontWeight: strong ? 500 : 400, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Identification (écran 1, même page) ────────────────────────────────────

function CheckoutIdentification({
  shop,
  onAuthenticated,
}: {
  shop: Shop;
  onAuthenticated: (session: StorefrontSession) => void;
}) {
  return (
    <div
      data-testid={TEST_IDS.shop.checkoutIdentification}
      className="bg-paper border border-line rounded-xl p-4 flex flex-col gap-3"
    >
      <p className="text-ink-muted m-0" style={{ fontSize: '12.5px' }}>
        Utilisez le compte propre à cette boutique. Aucun compte Magrit n’est créé ou réutilisé.
      </p>
      <StorefrontLoginForm
        shopSlug={shop.slug}
        contactEmail={shop.contact_email}
        allowRegistration={shop.access_mode === 'self_signup'}
        onAuthenticated={onAuthenticated}
      />
    </div>
  );
}
