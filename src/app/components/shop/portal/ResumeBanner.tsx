/**
 * S7.9 — ResumeBanner : bandeau « Reprendre » riche (home) + compact (gammes).
 *
 * Décision D3 : les affordances de l'acheteur récurrent sont disponibles
 * partout. Chips DÉRIVÉS de la donnée réelle, bandeau absent si tout est vide
 * (jamais de bloc vide). Le chip « Devis en attente » arrive avec AccountHub
 * (S7.10) — les devis ne sont pas exposés côté portail aujourd'hui.
 */

import { History, RotateCcw, ShoppingCart } from 'lucide-react';
import { TEST_IDS } from '../../../lib/testIds';
import { formatEuro } from '../ProductOverlay.helpers';

/** Dernière commande de l'acheteur sur la boutique (fetch PublicShop). */
export interface ResumeLastOrder {
  id: string;
  status: string;
  total_ht: number;
  created_at: string;
  source: string;
}

export interface ResumeChip {
  key: 'cart' | 'renew' | 'track';
  label: string;
}

/** Chips à afficher — PUR, testé. Vide → le bandeau ne se rend pas. */
export function buildResumeChips(args: {
  cartCount: number;
  cartTotalHT: number;
  lastOrder: ResumeLastOrder | null;
}): ResumeChip[] {
  const chips: ResumeChip[] = [];
  if (args.cartCount > 0) {
    chips.push({
      key: 'cart',
      label:
        args.cartTotalHT > 0
          ? `Reprendre mon panier · ${formatEuro(args.cartTotalHT)} HT`
          : 'Reprendre mon panier',
    });
  }
  if (args.lastOrder) {
    const date = formatOrderDate(args.lastOrder.created_at);
    if (args.lastOrder.source === 'v1_1') {
      chips.push({
        key: 'renew',
        label: `Renouveler la commande du ${date} · ${formatEuro(args.lastOrder.total_ht)} HT`,
      });
    }
    chips.push({
      key: 'track',
      label: `Suivre ma dernière commande (${statusLabel(args.lastOrder.status)})`,
    });
  }
  return chips;
}

function formatOrderDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'brouillon',
  validated: 'validée',
  in_production: 'en production',
  shipped: 'expédiée',
  delivered: 'livrée',
  cancelled: 'annulée',
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

const CHIP_ICONS = {
  cart: ShoppingCart,
  renew: RotateCcw,
  track: History,
} as const;

const CHIP_TESTIDS = {
  cart: TEST_IDS.shop.resumeChipCart,
  renew: TEST_IDS.shop.resumeChipRenew,
  track: TEST_IDS.shop.resumeChipTrack,
} as const;

export interface ResumeBannerProps {
  chips: ResumeChip[];
  onChip: (key: ResumeChip['key']) => void;
  variant: 'rich' | 'compact';
}

export function ResumeBanner({ chips, onChip, variant }: ResumeBannerProps) {
  if (chips.length === 0) return null;

  if (variant === 'compact') {
    return (
      <nav
        data-testid={TEST_IDS.shop.resumeBanner}
        aria-label="Reprendre"
        className="flex items-center gap-3 px-5 lg:px-9 py-1.5 border-b border-line bg-bg overflow-x-auto whitespace-nowrap"
        style={{ fontSize: '12px' }}
      >
        {chips.map((chip) => {
          const Icon = CHIP_ICONS[chip.key];
          return (
            <button
              key={chip.key}
              type="button"
              data-testid={CHIP_TESTIDS[chip.key]}
              onClick={() => onChip(chip.key)}
              className="inline-flex items-center gap-1.5 shrink-0 text-ink-muted hover:text-ink hover:underline"
            >
              <Icon className="w-3 h-3" strokeWidth={1.5} aria-hidden="true" />
              {chip.label}
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      data-testid={TEST_IDS.shop.resumeBanner}
      aria-label="Reprendre"
      className="px-5 lg:px-9 pt-7 bg-bg"
    >
      <div className="bg-paper border border-line rounded-xl px-5 py-4 max-w-[1100px]">
        <p
          className="font-mono uppercase text-ink-mute-2 m-0 mb-2.5"
          style={{ fontSize: '10px', letterSpacing: '0.08em', fontWeight: 500 }}
        >
          Reprendre où vous en étiez
        </p>
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => {
            const Icon = CHIP_ICONS[chip.key];
            return (
              <button
                key={chip.key}
                type="button"
                data-testid={CHIP_TESTIDS[chip.key]}
                onClick={() => onChip(chip.key)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-line-2 bg-paper text-ink hover:border-ink transition-colors"
                style={{ fontSize: '13px', fontWeight: 500, minHeight: '40px' }}
              >
                <Icon className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.5} aria-hidden="true" />
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{chip.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
