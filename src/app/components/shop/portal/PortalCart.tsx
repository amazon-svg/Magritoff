import { X, Plus, Minus, MapPin } from 'lucide-react';
import type { CartLine, BudgetInfo } from './types';
import { resolveProductImage } from '../../../utils/productImages';
import type { Gamme, ProductDefinition } from '../../../utils/productEnrichment';
import { ProductMockup } from '../../brand/ProductMockup';
import { TEST_IDS } from '../../../lib/testIds';
import { resolvePrice } from '../../../utils/priceResolver';

interface Props {
  cart: CartLine[];
  budget?: BudgetInfo;
  onUpdateQty: (productId: string, delta: number) => void;
  onRemove: (productId: string) => void;
  onSubmit: () => void;
  onContinue: () => void;
  pimGammes?: Gamme[];
  pimDefinitions?: ProductDefinition[];
  /**
   * Mode compact pour drawer (Sheet 420px). S-FIX-6 :
   *  - 1 colonne (vs 2-col page entiere)
   *  - padding reduit (p-4 vs p-9)
   *  - header reduit
   *  - panneau workflow N+1 droite masque
   *  - pas de min-h plein ecran
   */
  compact?: boolean;
}

// F4 — Panier + workflow validation N+1
// Design source : .design-handoff/designs/05 - Portail B2B.html (section .f4)
// S-FIX-6 : mode compact pour drawer slide-right (S-REWORK-1).
export function PortalCart({
  cart,
  budget,
  onUpdateQty,
  onRemove,
  onSubmit,
  onContinue,
  pimGammes,
  pimDefinitions,
  compact = false,
}: Props) {
  // Resolution unifiee du prix par ligne via priceResolver (decision Arnaud
  // 2026-05-09 fix prix marche). Une ligne en "prix marche" devient
  // hasMarketPriceLine=true → on affiche un badge global "Prix marche" en
  // bas du panier pour informer l acheteur que le total est indicatif.
  const cartLines = cart.map((l) => {
    const clariprintQuote = (l.product.config as any)?.clariprintQuote ?? null;
    const resolution = resolvePrice(l.product, clariprintQuote);
    const lineTotal = resolution.priceHT * l.qty;
    return { line: l, resolution, lineTotal };
  });
  const subtotalHT = cartLines.reduce((s, c) => s + c.lineTotal, 0);
  const tva = subtotalHT * 0.2;
  const totalFinal = subtotalHT + tva;
  const hasMarketPriceLine = cartLines.some((c) => c.resolution.isMarketPrice);

  const budgetPctAfter = budget
    ? Math.min(100, Math.round(((budget.used + totalFinal) / budget.total) * 100))
    : 0;

  return (
    <div
      data-testid={TEST_IDS.shop.cartDrawer}
      className={
        compact
          ? "flex flex-col gap-4 p-4 bg-bg"
          : "grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-7 p-9 bg-bg min-h-[calc(100vh-200px)]"
      }
      style={{ fontFamily: 'var(--font-ui)' }}
    >
      {/* Panier + workflow */}
      <div>
        {!compact && (
          <h3
            className="text-ink m-0 mb-4"
            style={{ fontSize: '26px', fontWeight: 400, letterSpacing: '-0.02em' }}
          >
            Panier
            <span
              className="ml-3 text-ink-muted"
              style={{ fontSize: '14px', fontWeight: 400 }}
            >
              {cart.length} ligne{cart.length > 1 ? 's' : ''}
            </span>
          </h3>
        )}

        {/* Lignes panier */}
        <section className="bg-paper border border-line rounded-xl overflow-hidden">
          {cart.length === 0 ? (
            <div className="px-7 py-16 text-center">
              <p
                className="text-ink-muted m-0 mb-4"
                style={{ fontSize: '14px', fontWeight: 400 }}
              >
                Votre panier est vide.
              </p>
              <button
                onClick={onContinue}
                className="px-4 py-2 rounded-md bg-ink text-paper hover:bg-black"
                style={{ fontSize: '13px', fontWeight: 500 }}
              >
                Parcourir le catalogue
              </button>
            </div>
          ) : (
            cart.map((line, i) => {
              const imgSrc = resolveProductImage({
                name: line.product.name,
                id: line.product.id,
                image_url: line.product.image_url,
                kind: (line.product.config as any)?.kind,
                clariprintData: line.product.config,
                gammes: pimGammes,
                definitions: pimDefinitions,
              });
              return (
                <div
                  key={line.product.id}
                  className={`grid grid-cols-[72px_1fr_auto_auto_28px] gap-4.5 items-center px-5.5 py-4.5 ${
                    i < cart.length - 1 ? 'border-b border-line' : ''
                  }`}
                >
                  <div className="w-[72px] h-[60px] rounded-lg overflow-hidden shrink-0">
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <ProductMockup
                        name={line.product.name}
                        kind={(line.product.config as any)?.kind}
                        category={line.product.category}
                        className="w-full h-full"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h5
                      className="text-ink m-0 mb-1 truncate"
                      style={{ fontSize: '14px', fontWeight: 500 }}
                    >
                      {line.product.name}
                    </h5>
                    <div
                      className="text-ink-muted font-mono"
                      style={{ fontSize: '12px', fontWeight: 400, lineHeight: 1.5 }}
                    >
                      {(line.product.config as any)?.format
                        ?? `${(line.product.config as any)?.width ?? '?'}×${(line.product.config as any)?.height ?? '?'} mm`}
                      {line.product.category && <> · {line.product.category}</>}
                    </div>
                    <div
                      className="flex items-center gap-1.5 text-ink-muted mt-1.5"
                      style={{ fontSize: '12px', fontWeight: 400 }}
                    >
                      <MapPin className="w-3 h-3" strokeWidth={1.5} />
                      <span className="text-ink-2" style={{ fontWeight: 500 }}>
                        Livraison :
                      </span>
                      Siège social · Paris
                    </div>
                  </div>
                  <div className="inline-flex items-center border border-line rounded-md bg-paper overflow-hidden">
                    <button
                      onClick={() => onUpdateQty(line.product.id, -1)}
                      className="px-2.5 py-1 text-ink-2 hover:bg-bg"
                      aria-label="Diminuer"
                    >
                      <Minus className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                    <span
                      className="px-3 font-mono text-ink tabular-nums min-w-[40px] text-center"
                      style={{ fontSize: '13px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {line.qty}
                    </span>
                    <button
                      onClick={() => onUpdateQty(line.product.id, 1)}
                      className="px-2.5 py-1 text-ink-2 hover:bg-bg"
                      aria-label="Augmenter"
                    >
                      <Plus className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                  </div>
                  <div
                    className="font-mono text-ink text-right tabular-nums"
                    style={{ fontSize: '14px', fontWeight: 500, fontVariantNumeric: 'tabular-nums', minWidth: '80px' }}
                  >
                    {(line.product.price_ht * line.qty * 1.2).toFixed(2)}€
                  </div>
                  <button
                    onClick={() => onRemove(line.product.id)}
                    className="w-7 h-7 rounded-md text-ink-mute-2 hover:bg-bg hover:text-ink grid place-items-center"
                    aria-label="Retirer"
                  >
                    <X className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              );
            })
          )}
        </section>

        {/* Workflow de validation N+1 : retiré tant que le backend B2B
            correspondant n'est pas implémenté. Sera réintégré quand on
            câblera le circuit Panier → N+1 → Achats → Magrit. */}
      </div>

      {/* Summary : sticky en page entiere, inline en mode drawer compact */}
      <aside
        className={
          compact
            ? "bg-paper border border-line rounded-xl p-4"
            : "bg-paper border border-line rounded-xl p-5.5 self-start sticky top-5"
        }
      >
        <h5
          className="text-ink m-0 mb-3.5"
          style={{ fontSize: '14.5px', fontWeight: 500 }}
        >
          Récapitulatif
        </h5>
        <div className="flex flex-col">
          {[
            { label: 'Sous-total HT', value: `${subtotalHT.toFixed(2)}€` },
            { label: 'TVA (20%)', value: `${tva.toFixed(2)}€` },
            { label: 'Livraison', value: 'Offerte' },
          ].map((row) => (
            <div
              key={row.label}
              className="flex justify-between py-2 text-ink-muted"
              style={{ fontSize: '13px', fontWeight: 400 }}
            >
              <span>{row.label}</span>
              <span
                className={`font-mono ${row.neg ? 'text-ok-fg' : 'text-ink'}`}
                style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
              >
                {row.value}
              </span>
            </div>
          ))}
          <div
            className="flex justify-between pt-3.5 pb-1.5 mt-2 border-t border-line text-ink"
            style={{ fontSize: '14px', fontWeight: 500 }}
          >
            <span>Total TTC</span>
            <span
              className="font-mono"
              style={{
                fontSize: '20px',
                fontWeight: 500,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.015em',
              }}
            >
              {totalFinal.toFixed(2)}€
            </span>
          </div>
          {hasMarketPriceLine && (
            <div
              className="mt-3 px-3 py-2 bg-orange-50 border border-orange-200 rounded text-orange-800"
              style={{ fontSize: '12px', lineHeight: '1.4' }}
            >
              ⚠️ <strong>Prix marché</strong> — au moins une ligne utilise une estimation Magrit (Clariprint pas encore intégré). Le prix réel sera confirmé à la validation par l&apos;imprimeur.
            </div>
          )}
        </div>

        {/* Impact budget corporate */}
        {budget && cart.length > 0 && (
          <div
            className="mt-4 px-3.5 py-3 bg-bg border border-line rounded-lg"
            style={{ fontSize: '12.5px', fontWeight: 400 }}
          >
            <div className="text-ink-muted">
              Impact sur le budget {budget.label}
            </div>
            <div
              className="text-ink font-mono mt-0.5"
              style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
            >
              {(budget.used + totalFinal).toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€ /{' '}
              {budget.total.toLocaleString('fr-FR')}€
              <span
                className="ml-2 text-ink-muted"
                style={{ fontWeight: 400 }}
              >
                ({budgetPctAfter}%)
              </span>
            </div>
            <div className="h-1.5 bg-line rounded mt-2 overflow-hidden">
              <div
                className="h-full rounded"
                style={{
                  width: `${budgetPctAfter}%`,
                  background: budgetPctAfter > 90 ? 'var(--warn-fg)' : 'var(--brand)',
                }}
              />
            </div>
          </div>
        )}

        <button
          data-testid={TEST_IDS.shop.checkoutBtn}
          disabled={cart.length === 0}
          onClick={onSubmit}
          className="w-full mt-4 py-3.5 rounded-lg bg-ink text-paper hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          style={{ fontSize: '14.5px', fontWeight: 500, fontFamily: 'var(--font-ui)' }}
        >
          Passer commande
        </button>
        <p
          className="m-0 mt-2.5 text-ink-muted text-center"
          style={{ fontSize: '12px', fontWeight: 400, lineHeight: 1.5 }}
        >
          Vous recevrez un email de confirmation.
        </p>
      </aside>
    </div>
  );
}
