/**
 * S7.3 — StickyPriceBar : prix + badge source + CTA panier.
 *
 * Desktop (lg+) : bloc collant dans la colonne configurateur.
 * Mobile : barre fixe en bas de viewport (jamais masquée par le contenu).
 * Le prix ne disparaît jamais au scroll (spec UX, indicateur transactionnel).
 */

import { Loader2, Sparkles } from 'lucide-react';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { formatEuro } from '../ProductOverlay.helpers';
import type { ConfiguratorPhase } from '../../../hooks/useProductConfigurator';
import { priceBadgeForPhase } from './gammePage.helpers';

export interface StickyPriceBarProps {
  phase: ConfiguratorPhase;
  /** Prix affichés (repli catalogue si phase idle). */
  priceHT: number | null;
  priceTTC: number | null;
  quantity: number;
  addDisabled: boolean;
  onAddToCart: () => void;
  onAskMagrit: () => void;
  /** Rendu barre basse mobile (true) ou bloc colonne desktop (false). */
  variant: 'column' | 'bottom';
}

export function StickyPriceBar({
  phase,
  priceHT,
  priceTTC,
  quantity,
  addDisabled,
  onAddToCart,
  onAskMagrit,
  variant,
}: StickyPriceBarProps) {
  const badge = priceBadgeForPhase(phase);
  const loading = phase.kind === 'loading';
  const noPrice = badge.kind === 'demande' || (priceHT == null && !loading);

  const priceBlock = (
    <div
      data-testid={TEST_IDS.shop.gammeStickyPrice}
      aria-live="polite"
      aria-atomic="true"
      className="flex flex-col"
    >
      {loading ? (
        <span className="inline-flex items-center gap-1.5 text-ink-mute-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
          <span style={{ fontSize: '12px' }}>Calcul en cours…</span>
        </span>
      ) : noPrice ? (
        <span className="text-ink" style={{ fontSize: '15px', fontWeight: 500 }}>
          Prix sur demande
        </span>
      ) : (
        <>
          <span
            className="font-mono text-ink"
            style={{ fontSize: '20px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
          >
            {formatEuro(priceHT ?? 0)} <span style={{ fontSize: '12px' }}>HT</span>
          </span>
          {priceTTC != null && (
            <span
              className="font-mono text-ink-muted"
              style={{ fontSize: '11.5px', fontVariantNumeric: 'tabular-nums' }}
            >
              {formatEuro(priceTTC)} TTC · {quantity.toLocaleString('fr-FR')} ex.
            </span>
          )}
        </>
      )}
      {badge.kind !== 'none' && (
        <span
          data-testid={TEST_IDS.shop.gammePriceSourceBadge}
          className={`mt-1 inline-flex w-fit items-center rounded px-1.5 py-0.5 font-mono uppercase ${
            badge.kind === 'marche'
              ? 'bg-warn-bg text-warn-fg'
              : badge.kind === 'demande'
                ? 'bg-bg text-ink-muted border border-line-2'
                : 'bg-bg text-ink-muted border border-line'
          }`}
          style={{ fontSize: '9.5px', letterSpacing: '0.06em' }}
        >
          {badge.label}
        </span>
      )}
    </div>
  );

  const actions = (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        data-testid={TEST_IDS.shop.gammeStickyAddBtn}
        onClick={onAddToCart}
        disabled={addDisabled || noPrice}
        className="px-4 py-2.5 rounded-md bg-ink text-paper hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ fontSize: '13.5px', fontWeight: 500 }}
      >
        Ajouter au panier
      </button>
      <button
        type="button"
        data-testid={TEST_IDS.shop.gammeAskMagrit}
        onClick={onAskMagrit}
        className="inline-flex items-center justify-center gap-1.5 text-ink-muted hover:text-ink transition-colors"
        style={{ fontSize: '12px', fontWeight: 500 }}
      >
        <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
        Une question ? Demandez à Magrit
      </button>
    </div>
  );

  if (variant === 'bottom') {
    return (
      <div
        data-testid={TEST_IDS.shop.gammeStickyBar}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper px-4 py-3 flex items-center justify-between gap-3 lg:hidden"
      >
        {priceBlock}
        <div className="shrink-0">{actions}</div>
      </div>
    );
  }

  return (
    <div
      data-testid={TEST_IDS.shop.gammeStickyBar}
      className="sticky top-4 rounded-lg border border-line bg-paper p-4 flex flex-col gap-3"
    >
      {priceBlock}
      {actions}
    </div>
  );
}
