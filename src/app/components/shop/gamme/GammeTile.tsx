/**
 * S7.6 — GammeTile : tuile « Top Produits » de la home vitrine.
 *
 * Mockup gamme (image PIM si disponible, sinon identité famille picto +
 * tonalité), nom, compteur produits, « dès X € HT » badgé source (ADR §4.18 :
 * la source suit le prix, jamais « 0 € ») ou « Prix à la configuration ».
 * États : défaut / hover / sans-prix / skeleton. Clic → page gamme /g/:slug.
 */

import { TEST_IDS } from '@/shared/presentation/testIds';
import { resolveRootFamilyIdentity } from '../../../utils/shopFamilyIdentity';
import type { PriceResolution } from '../../../utils/priceResolver';
import { formatEuro } from '../ProductOverlay.helpers';

export interface GammeTileProps {
  slug: string;
  name: string;
  imageUrl?: string | null;
  productCount: number;
  /** Résolution min de la gamme (S7.6) — absent = « Prix à la configuration ». */
  floor?: PriceResolution | null;
  onOpen: (slug: string) => void;
  skeleton?: boolean;
}

export function GammeTile({
  slug,
  name,
  imageUrl,
  productCount,
  floor,
  onOpen,
  skeleton = false,
}: GammeTileProps) {
  if (skeleton) {
    return (
      <div
        data-testid={TEST_IDS.shop.gammeTile}
        aria-hidden="true"
        className="rounded-lg border border-line bg-paper overflow-hidden animate-pulse"
      >
        <div className="aspect-[4/3] bg-bg" />
        <div className="p-3 flex flex-col gap-2">
          <div className="h-4 w-2/3 rounded bg-bg" />
          <div className="h-3 w-1/3 rounded bg-bg" />
        </div>
      </div>
    );
  }

  const identity = resolveRootFamilyIdentity(slug, name);
  const Icon = identity.icon;
  const isMarket = floor?.isMarketPrice === true;

  return (
    <button
      type="button"
      data-testid={TEST_IDS.shop.gammeTile}
      data-gamme-slug={slug}
      onClick={() => onOpen(slug)}
      className="group text-left rounded-lg border border-line bg-paper overflow-hidden transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent"
      style={{ minHeight: '44px' }}
      aria-label={`${name} — ${
        floor ? `dès ${formatEuro(floor.priceHT)} HT` : 'prix à la configuration'
      }`}
    >
      <div
        className="aspect-[4/3] overflow-hidden grid place-items-center"
        style={{ background: imageUrl ? '#F5F5F5' : `${identity.tone}14` }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            className="w-full h-full object-contain transition-transform group-hover:scale-[1.03]"
          />
        ) : (
          <Icon
            className="w-10 h-10 transition-transform group-hover:scale-110"
            strokeWidth={1.25}
            style={{ color: identity.tone }}
          />
        )}
      </div>
      <div className="p-3 flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-ink" style={{ fontSize: '14px', fontWeight: 500 }}>
            {name}
          </span>
          <span
            className="text-ink-mute-2 font-mono shrink-0"
            style={{ fontSize: '10.5px' }}
          >
            {productCount} produit{productCount > 1 ? 's' : ''}
          </span>
        </div>
        {floor ? (
          <div
            data-testid={TEST_IDS.shop.gammeTileFloorPrice}
            className="flex items-center gap-1.5"
          >
            <span
              className="font-mono text-ink"
              style={{ fontSize: '13px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
            >
              dès {formatEuro(floor.priceHT)} HT
            </span>
            {isMarket && (
              <span
                className="font-mono uppercase rounded px-1 py-0.5 bg-warn-bg text-warn-fg"
                style={{ fontSize: '8.5px', letterSpacing: '0.05em' }}
                title="Estimation prix marché — prix réel à la configuration"
              >
                ⚠️ marché
              </span>
            )}
          </div>
        ) : (
          <span
            data-testid={TEST_IDS.shop.gammeTileNoPrice}
            className="text-ink-muted"
            style={{ fontSize: '12px' }}
          >
            Prix à la configuration
          </span>
        )}
      </div>
    </button>
  );
}
